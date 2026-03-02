import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeName, normalizeArticleNumber } from "@/lib/products/normalize";
import { findProductByArticleNumber } from "@/lib/products/find-existing";
import { claudeRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaude, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";
import {
  isHomeRetailer,
  normalizeRetailerName,
  SUPPORTED_RETAILER_NAMES,
} from "@/lib/retailers/retailers";
import type { SupabaseClient } from "@supabase/supabase-js";

const NON_PRODUCT_PATTERN = /^(PFAND|LEERGUT|EINWEG|MEHRWEG|EC-ZAHLUNG|SUMME|ZWISCHENSUMME|RABATT|NACHLASS|TREUEPUNKTE|PAYBACK)/i;

export const maxDuration = 300;

const SUPPORTED_LIST = SUPPORTED_RETAILER_NAMES.join(", ");

const RECEIPT_PROMPT = `Du analysierst Fotos und prüfst ob es sich um einen Kassenzettel eines unterstützten Händlers handelt.

UNTERSTÜTZTE HÄNDLER: ${SUPPORTED_LIST}
Varianten wie "ALDI SÜD", "ALDI Nord", "Hofer" gelten als ALDI.

SCHRITT 1 – VALIDIERUNG:
Prüfe zuerst:
- Ist das Bild ein Kassenzettel/Bon? Falls NEIN → status = "not_a_receipt"
- Ist der Händler in der Liste oben? Falls NEIN → status = "unsupported_retailer"
- Falls JA → status = "valid"

Bei status "not_a_receipt": Antworte NUR mit:
{"status": "not_a_receipt", "retailer": null, "store_name": null}

Bei status "unsupported_retailer": Antworte NUR mit:
{"status": "unsupported_retailer", "retailer": null, "store_name": "Name des Händlers falls erkennbar"}

SCHRITT 2 – NUR bei status "valid", extrahiere ALLE folgenden Informationen:

1. KOPFDATEN:
- retailer: Normalisierter Händlername aus der Liste oben (z.B. "ALDI", "LIDL", "REWE"). Für ALDI SÜD/Nord/Hofer immer "ALDI".
- store_name: Voller Name wie auf dem Bon gedruckt (z.B. "ALDI SÜD", "REWE City")
- store_address: Adresse des Ladens (falls sichtbar)
- purchase_date: Datum im Format YYYY-MM-DD
- purchase_time: Uhrzeit im Format HH:MM
- receipt_number: Bonnummer (falls sichtbar)
- cashier: Kassennummer oder Kassierer (falls sichtbar)
- payment_method: Zahlungsart (z.B. "BAR", "EC-Karte", "Kreditkarte", "Maestro")

2. PRODUKTE – extrahiere JEDE Produktzeile:
- position: Reihenfolge auf dem Kassenzettel (1, 2, 3, ...)
- article_number: Artikelnummer falls vorhanden (bei manchen Händlern links auf der Zeile, bei anderen gar nicht vorhanden – dann null)
- receipt_name: Der abgekürzte Produktname auf dem Kassenzettel (exakt wie gedruckt)
- quantity: Anzahl (Standard 1, falls Stückzahl angegeben wie "2x" dann 2)
- unit_price: Preis pro Stück
- total_price: Gesamtpreis für diese Zeile
- is_weight_item: true falls nach Gewicht (kg) abgerechnet (erkennbar an kg-Angabe)
- weight_kg: Gewicht in kg (falls Gewichtsartikel)
- tax_category: Steuerklasse-Buchstabe (A, B etc. falls am Zeilenende sichtbar)

3. FUSS:
- subtotal: Zwischensumme
- total_amount: Gesamtbetrag (SUMME / TOTAL)
- tax_details: Array mit {category, rate, net, tax, gross} für jede Steuerklasse
- currency: "EUR"
- extra_info: Weitere interessante Informationen als Key-Value-Objekt (z.B. TSE-Signatur, Steuernummer, Kundenkarte, Treuepunkte, Rabatte, Pfand-Rückgabe)

WICHTIG:
- Ignoriere KEINE Produktzeile. Extrahiere ALLE Produkte.
- Nicht alle Händler haben Artikelnummern. Falls keine vorhanden, setze article_number auf null.
- Unterscheide Produktzeilen von Summenzeilen, Steuerzeilen und Zahlungszeilen.
- Wenn ein Produkt mit Rabatt erscheint, extrahiere den Endpreis.
- Pfand-Positionen (PFAND, LEERGUT) auch als Produkt extrahieren.
- Das aktuelle Jahr ist 2026. Falls kein Jahr auf dem Bon steht, verwende 2026.

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "status": "valid",
  "retailer": "string",
  "store_name": "string or null",
  "store_address": "string or null",
  "purchase_date": "YYYY-MM-DD or null",
  "purchase_time": "HH:MM or null",
  "receipt_number": "string or null",
  "cashier": "string or null",
  "payment_method": "string or null",
  "total_amount": number or null,
  "currency": "EUR",
  "products": [
    {
      "position": 1,
      "article_number": "string or null",
      "receipt_name": "string",
      "quantity": 1,
      "unit_price": number or null,
      "total_price": number or null,
      "is_weight_item": false,
      "weight_kg": null,
      "tax_category": "string or null"
    }
  ],
  "tax_details": [{"category": "A", "rate": "19%", "net": 0.00, "tax": 0.00, "gross": 0.00}],
  "extra_info": {}
}`;

interface ReceiptProduct {
  position: number;
  article_number?: string | null;
  receipt_name: string;
  quantity?: number;
  unit_price?: number | null;
  total_price?: number | null;
  is_weight_item?: boolean;
  weight_kg?: number | null;
  tax_category?: string | null;
}

interface ReceiptOcrResult {
  status: "valid" | "unsupported_retailer" | "not_a_receipt";
  retailer?: string | null;
  store_name?: string | null;
  store_address?: string | null;
  purchase_date?: string | null;
  purchase_time?: string | null;
  receipt_number?: string | null;
  cashier?: string | null;
  payment_method?: string | null;
  total_amount?: number | null;
  currency?: string;
  products?: ReceiptProduct[];
  tax_details?: unknown[];
  extra_info?: Record<string, unknown>;
}

const processReceiptSchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(5),
  photo_paths: z.array(z.string()).optional(),
});

/** Delete uploaded receipt photos from storage (fire-and-forget). */
function cleanupPhotos(supabase: SupabaseClient, photoPaths: string[]) {
  if (photoPaths.length === 0) return;
  supabase.storage
    .from("receipt-photos")
    .remove(photoPaths)
    .then(({ error }) => {
      if (error) log.error("[process-receipt] Photo cleanup failed:", error.message);
    });
}

/**
 * Find or create a competitor product by name_normalized, return its product_id.
 * Uses admin client (server-side) to bypass RLS created_by requirements.
 */
async function findOrCreateCompetitorProductServer(
  supabase: SupabaseClient,
  receiptName: string,
  country: string,
  userId: string,
): Promise<string | null> {
  const nameNorm = normalizeName(receiptName);

  const { data: existing } = await supabase
    .from("competitor_products")
    .select("product_id")
    .eq("name_normalized", nameNorm)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing) return existing.product_id;

  const { data: created, error } = await supabase
    .from("competitor_products")
    .insert({
      name: receiptName,
      name_normalized: nameNorm,
      country,
      created_by: userId,
    })
    .select("product_id")
    .single();

  if (error) {
    log.error("[process-receipt] Failed to create competitor product:", error.message);
    return null;
  }
  return created.product_id;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.id;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = processReceiptSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { photo_urls, photo_paths } = parsed.data;

    const rateLimitResponse = await checkRateLimit(
      claudeRateLimit,
      userId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = requireSupabaseAdmin();
    if (supabase instanceof NextResponse) return supabase;

    const apiKeyCheck = requireApiKey();
    if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

    const imageContent = photo_urls.map((url) => ({
      type: "image" as const,
      source: {
        type: "url" as const,
        url,
      },
    }));

    let rawText: string;
    try {
      rawText = await callClaude({
        model: CLAUDE_MODEL_SONNET,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              ...imageContent,
              { type: "text", text: RECEIPT_PROMPT },
            ],
          },
        ],
      });
    } catch (err) {
      log.error("[process-receipt] Claude API error:", err);
      return NextResponse.json(
        { error: "OCR processing failed" },
        { status: 502 }
      );
    }

    let ocrResult: ReceiptOcrResult;
    try {
      ocrResult = parseClaudeJsonResponse<ReceiptOcrResult>(rawText);
    } catch (e) {
      log.error("[process-receipt] Failed to parse receipt OCR:", e);
      return NextResponse.json(
        { error: "Failed to parse receipt data", raw: rawText.slice(0, 1000) },
        { status: 422 }
      );
    }

    // --- Validation: reject non-receipts and unsupported retailers ---

    if (ocrResult.status === "not_a_receipt") {
      cleanupPhotos(supabase, photo_paths || []);
      return NextResponse.json(
        { error: "not_a_receipt", store_name: null },
        { status: 422 }
      );
    }

    if (ocrResult.status === "unsupported_retailer") {
      cleanupPhotos(supabase, photo_paths || []);
      return NextResponse.json(
        { error: "unsupported_retailer", store_name: ocrResult.store_name || null },
        { status: 422 }
      );
    }

    // --- Valid receipt: determine retailer ---

    const retailerRaw = ocrResult.retailer || ocrResult.store_name || "";
    const retailerNormalized = normalizeRetailerName(retailerRaw);
    const isAldi = retailerNormalized ? isHomeRetailer(retailerNormalized) : false;

    const products = ocrResult.products || [];
    const now = new Date().toISOString();

    // Insert receipt record
    const { data: receiptRow, error: receiptErr } = await supabase
      .from("receipts")
      .insert({
        user_id: userId,
        store_name: ocrResult.store_name || null,
        store_address: ocrResult.store_address || null,
        retailer: retailerNormalized,
        purchase_date: ocrResult.purchase_date || null,
        purchase_time: ocrResult.purchase_time || null,
        total_amount:
          typeof ocrResult.total_amount === "number"
            ? ocrResult.total_amount
            : null,
        payment_method: ocrResult.payment_method || null,
        currency: ocrResult.currency || "EUR",
        photo_urls: photo_paths || photo_urls,
        raw_ocr_data: ocrResult,
        extra_info: ocrResult.extra_info || null,
        items_count: products.length,
        created_at: now,
      })
      .select("receipt_id")
      .single();

    if (receiptErr || !receiptRow) {
      log.error("[process-receipt] Receipt insert error:", receiptErr);
      return NextResponse.json(
        { error: "Failed to save receipt" },
        { status: 500 }
      );
    }

    const receiptId = receiptRow.receipt_id;

    // Process each product line
    const receiptItems: {
      receipt_id: string;
      position: number;
      article_number: string | null;
      receipt_name: string;
      product_id: string | null;
      competitor_product_id: string | null;
      quantity: number;
      unit_price: number | null;
      total_price: number | null;
      is_weight_item: boolean;
      weight_kg: number | null;
      tax_category: string | null;
    }[] = [];

    let pricesUpdated = 0;
    const competitorProductIds: string[] = [];

    for (const p of products) {
      const receiptName = (p.receipt_name || "").trim();
      if (!receiptName) continue;

      const isNonProduct = NON_PRODUCT_PATTERN.test(receiptName);
      const articleNumber = normalizeArticleNumber(p.article_number);

      const quantity =
        typeof p.quantity === "number" && p.quantity > 0 ? p.quantity : 1;
      const unitPrice =
        typeof p.unit_price === "number" ? p.unit_price : null;
      const totalPrice =
        typeof p.total_price === "number" ? p.total_price : null;
      const effectivePrice = unitPrice ?? totalPrice;

      let productId: string | null = null;
      let competitorProductId: string | null = null;

      if (!isNonProduct) {
        if (isAldi) {
          // ALDI: match against products table by article_number
          const found = await findProductByArticleNumber(
            supabase,
            articleNumber,
            "product_id, price, price_updated_at",
          );

          productId = found?.product_id ?? null;

          if (found && effectivePrice != null && ocrResult.purchase_date) {
            const receiptDate = new Date(ocrResult.purchase_date);
            const lastPriceDate = found.price_updated_at
              ? new Date(String(found.price_updated_at))
              : new Date(0);

            if (receiptDate >= lastPriceDate) {
              await supabase
                .from("products")
                .update({
                  price: effectivePrice,
                  price_updated_at: ocrResult.purchase_date,
                  updated_at: now,
                })
                .eq("product_id", productId!);
              pricesUpdated++;
            }
          }
        } else if (retailerNormalized) {
          // Competitor retailer: find or create in competitor_products
          competitorProductId = await findOrCreateCompetitorProductServer(
            supabase,
            receiptName,
            "DE",
            userId,
          );

          if (competitorProductId && effectivePrice != null) {
            await supabase
              .from("competitor_product_prices")
              .insert({
                product_id: competitorProductId,
                retailer: retailerNormalized,
                price: effectivePrice,
                observed_at: ocrResult.purchase_date || now,
                observed_by: userId,
              });
            pricesUpdated++;
            competitorProductIds.push(competitorProductId);
          }
        }
      }

      receiptItems.push({
        receipt_id: receiptId,
        position: p.position || receiptItems.length + 1,
        article_number: articleNumber,
        receipt_name: receiptName,
        product_id: productId,
        competitor_product_id: competitorProductId,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        is_weight_item: p.is_weight_item || false,
        weight_kg:
          typeof p.weight_kg === "number" ? p.weight_kg : null,
        tax_category: p.tax_category || null,
      });
    }

    // Batch insert receipt items
    if (receiptItems.length > 0) {
      const { error: itemsErr } = await supabase
        .from("receipt_items")
        .insert(receiptItems);

      if (itemsErr) {
        log.error("[process-receipt] Receipt items insert error:", itemsErr);
      }
    }

    // Upsert competitor_product_stats for purchase tracking (fire-and-forget)
    if (competitorProductIds.length > 0 && retailerNormalized) {
      const uniqueIds = [...new Set(competitorProductIds)];
      for (const cpId of uniqueIds) {
        supabase
          .from("competitor_product_stats")
          .upsert(
            {
              competitor_product_id: cpId,
              retailer: retailerNormalized,
              user_id: userId,
              purchase_count: 1,
              last_purchased_at: now,
            },
            { onConflict: "competitor_product_id,retailer,user_id" }
          )
          .then(({ error }) => {
            if (error) log.error("[process-receipt] Stats upsert failed:", error.message);
          });
      }
    }

    const itemsLinked = receiptItems.filter(
      (i) => i.product_id || i.competitor_product_id
    ).length;

    return NextResponse.json({
      receipt_id: receiptId,
      retailer: retailerNormalized,
      store_name: ocrResult.store_name,
      purchase_date: ocrResult.purchase_date,
      purchase_time: ocrResult.purchase_time,
      total_amount: ocrResult.total_amount,
      items_count: receiptItems.length,
      prices_updated: pricesUpdated,
      items_linked: itemsLinked,
    });
  } catch (err) {
    log.error("[process-receipt] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
