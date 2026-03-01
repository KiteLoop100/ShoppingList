import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeName } from "@/lib/products/normalize";
import { findExistingProduct } from "@/lib/products/find-existing";
import { claudeRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaude, ClaudeApiError, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";

export const maxDuration = 300;

const RECEIPT_PROMPT = `Du analysierst Fotos eines Kassenzettels von ALDI SÜD (Deutschland) oder Hofer (Österreich).
Falls mehrere Fotos vorliegen, gehören alle zum SELBEN Kassenzettel. Kombiniere die Daten zu einem vollständigen Kassenzettel.

Extrahiere ALLE folgenden Informationen:

1. KOPFDATEN:
- store_name: Name des Ladens (z.B. "ALDI SÜD", "Hofer")
- store_address: Adresse des Ladens (falls sichtbar)
- purchase_date: Datum im Format YYYY-MM-DD
- purchase_time: Uhrzeit im Format HH:MM
- receipt_number: Bonnummer (falls sichtbar)
- cashier: Kassennummer oder Kassierer (falls sichtbar)
- payment_method: Zahlungsart (z.B. "BAR", "EC-Karte", "Kreditkarte", "Maestro")

2. PRODUKTE – extrahiere JEDE Produktzeile:
- position: Reihenfolge auf dem Kassenzettel (1, 2, 3, ...)
- article_number: Die Nummer ganz LINKS auf jeder Zeile (4-7 stellig)
- receipt_name: Der abgekürzte Produktname auf dem Kassenzettel (exakt wie gedruckt, z.B. "MILS.FETT.MI", "BIO TRINKM")
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
- Die Artikelnummer steht am ANFANG jeder Produktzeile (links).
- Unterscheide Produktzeilen von Summenzeilen, Steuerzeilen und Zahlungszeilen.
- Wenn ein Produkt mit Rabatt erscheint, extrahiere den Endpreis.
- Pfand-Positionen (PFAND, LEERGUT) auch als Produkt extrahieren.
- Das aktuelle Jahr ist 2026. Falls kein Jahr auf dem Bon steht, verwende 2026.

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
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

    const products = ocrResult.products || [];
    const now = new Date().toISOString();

    // Insert receipt record
    const { data: receiptRow, error: receiptErr } = await supabase
      .from("receipts")
      .insert({
        user_id: userId,
        store_name: ocrResult.store_name || null,
        store_address: ocrResult.store_address || null,
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

    // Process each product line: link to existing products, update prices
    const receiptItems: {
      receipt_id: string;
      position: number;
      article_number: string | null;
      receipt_name: string;
      product_id: string | null;
      quantity: number;
      unit_price: number | null;
      total_price: number | null;
      is_weight_item: boolean;
      weight_kg: number | null;
      tax_category: string | null;
    }[] = [];

    let pricesUpdated = 0;

    for (const p of products) {
      const articleNumber = p.article_number?.trim() || null;
      const receiptName = (p.receipt_name || "").trim();
      if (!receiptName) continue;

      const quantity =
        typeof p.quantity === "number" && p.quantity > 0 ? p.quantity : 1;
      const unitPrice =
        typeof p.unit_price === "number" ? p.unit_price : null;
      const totalPrice =
        typeof p.total_price === "number" ? p.total_price : null;
      const effectivePrice = unitPrice ?? totalPrice;

      const nameNorm = normalizeName(receiptName);
      const found = await findExistingProduct(supabase, {
        article_number: articleNumber,
        name_normalized: nameNorm,
      }, { select: "product_id, price, price_updated_at" });

      let productId: string | null = found?.product_id ?? null;

      if (found && effectivePrice != null && ocrResult.purchase_date) {
        const shouldUpdatePrice = found.matched_by === "article_number" || !articleNumber;
        if (shouldUpdatePrice) {
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
      }

      receiptItems.push({
        receipt_id: receiptId,
        position: p.position || receiptItems.length + 1,
        article_number: articleNumber,
        receipt_name: receiptName,
        product_id: productId,
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

    return NextResponse.json({
      receipt_id: receiptId,
      store_name: ocrResult.store_name,
      purchase_date: ocrResult.purchase_date,
      purchase_time: ocrResult.purchase_time,
      total_amount: ocrResult.total_amount,
      items_count: receiptItems.length,
      prices_updated: pricesUpdated,
      items_linked: receiptItems.filter((i) => i.product_id).length,
    });
  } catch (err) {
    log.error("[process-receipt] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

