/**
 * F13/F14: Process uploaded photo with Claude Vision. Detect type, extract data, optionally call Open Food Facts, upsert products.
 * Thumbnails: product_front = Claude bounding box + Sharp; product_back = center crop.
 * PDF flyers: Split with pdf-lib into single-page PDFs, store in flyer-pages bucket, one Claude call per page (max 5 pages in initial request; rest via POST /api/process-flyer-page).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { DEMAND_GROUPS_INSTRUCTION } from "@/lib/products/demand-groups-prompt";
import { getDemandGroupFallback } from "@/lib/products/demand-group-fallback";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
/** Max pages to process in the initial API call (Vercel ~60s timeout). Rest via process-flyer-page. */
const PDF_PAGES_INITIAL_MAX = 5;

const FLYER_PDF_FIRST_PAGE_PROMPT = `Dies ist die ERSTE Seite eines ALDI SÜD Aktions-Handzettels. Extrahiere: (1) Handzettel-Titel (flyer_title, z.B. "KW 09 – Angebote ab 24.02."), (2) Gültigkeitszeitraum (special_valid_from, special_valid_to, YYYY-MM-DD), (3) JEDEN Aktionsartikel auf dieser Seite.
Das aktuelle Jahr ist 2026. Wenn auf dem Handzettel kein Jahr angegeben ist, verwende 2026 für alle Datumsangaben.
Pro Produkt: article_number (falls sichtbar), name (vollständiger Produktname), price (Aktionspreis), weight_or_quantity (Gewicht/Menge falls angegeben), brand (Marke falls sichtbar), special_start_date, special_end_date (YYYY-MM-DD), demand_group, demand_sub_group.

${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photo_type": "flyer_pdf",
  "flyer_title": "string",
  "special_valid_from": "YYYY-MM-DD or null",
  "special_valid_to": "YYYY-MM-DD or null",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "weight_or_quantity": "string or null", "brand": "string or null", "special_start_date": "YYYY-MM-DD or null", "special_end_date": "YYYY-MM-DD or null", "demand_group": "string or null", "demand_sub_group": "string or null" }
  ]
}`;

const FLYER_PDF_PAGE_PROMPT = `Dies ist eine Seite eines ALDI SÜD Aktions-Handzettels (nicht die erste). Extrahiere JEDEN Aktionsartikel auf dieser Seite.
Das aktuelle Jahr ist 2026. Wenn auf dem Handzettel kein Jahr angegeben ist, verwende 2026 für alle Datumsangaben.
Pro Produkt: article_number (falls sichtbar), name (vollständiger Produktname), price (Aktionspreis), weight_or_quantity (Gewicht/Menge falls angegeben), brand (Marke falls sichtbar), special_start_date, special_end_date (YYYY-MM-DD), demand_group, demand_sub_group.

${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photo_type": "flyer_pdf",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "weight_or_quantity": "string or null", "brand": "string or null", "special_start_date": "YYYY-MM-DD or null", "special_end_date": "YYYY-MM-DD or null", "demand_group": "string or null", "demand_sub_group": "string or null" }
  ]
}`;

const VISION_PROMPT = `You are analyzing a photo from a grocery shopping context. Classify the photo type and extract structured data.

${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks, kein zusätzlicher Text. Jedes Produkt MUSS demand_group und demand_sub_group haben (string oder null; null nur wenn wirklich unklar).

Photo types: product_front (single product front), product_back (product back with barcode/nutrition), receipt (supermarket receipt), flyer (promo flyer), shelf (store shelf with multiple products).

For RECEIPTS (ALDI/Hofer): The number on the far LEFT of each line is article_number. Extract EVERY line as one product. Return {article_number, name, price, demand_group, demand_sub_group} per product. Even for abbreviated receipt names (e.g. MILS.FETT.MI, BIO TRINKM) try to infer demand_group (e.g. Milchprodukte). Ignore payment lines, tax summaries, totals, subtotals, card details, TSE data, store address, and footer text. Only extract actual product purchase lines. If name is unclear use raw receipt text.

For non-receipt photos use the full shape below.

Respond with a single JSON object, no markdown:
{
  "photo_type": "product_front" | "product_back" | "receipt" | "flyer" | "shelf",
  "products": [
    { "article_number": "string or null", "name": "string", "price": number or null, "demand_group": "string or null", "demand_sub_group": "string or null" }
  ],
  "receipt_date": "YYYY-MM-DD or null if receipt",
  "special_valid_from": "YYYY-MM-DD or null if flyer",
  "special_valid_to": "YYYY-MM-DD or null if flyer"
}

For receipts each product has article_number, name, price, demand_group, demand_sub_group. For other photo types add brand, ean_barcode etc. Keep JSON compact.`;

const CROP_PROMPT = `Identify the main product in this image. Return the bounding box of the product as JSON: { "crop_x", "crop_y", "crop_width", "crop_height" } in pixels. The bounding box should tightly contain only the product, excluding background, shelves, hands, and other objects. Also return the image dimensions as { "image_width", "image_height" }.

Reply with ONLY a single JSON object, no markdown, no backticks. Example: {"crop_x":100,"crop_y":50,"crop_width":300,"crop_height":400,"image_width":800,"image_height":600}`;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ALDI/Hofer: article number is usually at the start of the line (digits). Extract it from receipt line text. */
function extractArticleNumberFromReceiptLine(name: string): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  const match = trimmed.match(/^(\d{4,})/);
  return match ? match[1] : null;
}

/**
 * If JSON is truncated, repair by keeping up to the last complete product object and closing the JSON.
 * Finds last "}," (end of a product) or "}]" (end of array) or lone "}" (last product); cuts there, closes with "]}" or "}".
 */
function tryRepairTruncatedReceiptJson(cleaned: string): string | null {
  const trimmed = cleaned.trimEnd();
  const lastCloseBraceComma = trimmed.lastIndexOf("},");
  const lastCloseBraceBracket = trimmed.lastIndexOf("}]");
  if (lastCloseBraceBracket >= 0 && lastCloseBraceBracket > lastCloseBraceComma) {
    return trimmed.slice(0, lastCloseBraceBracket + 2) + "}";
  }
  if (lastCloseBraceComma >= 0) {
    return trimmed.slice(0, lastCloseBraceComma + 1) + "]}";
  }
  if (trimmed.endsWith("}")) {
    return trimmed + "]}";
  }
  return null;
}

async function fetchOpenFoodFacts(ean: string): Promise<{
  name?: string;
  brand?: string;
  nutrition_info?: Record<string, unknown>;
  ingredients?: string;
  allergens?: string;
} | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,nutriments,ingredients_text,allergens`,
      { headers: { "User-Agent": "DigitalShoppingList/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.product) return null;
    const p = data.product;
    const nutriments = p.nutriments as Record<string, unknown> | undefined;
    return {
      name: p.product_name ?? undefined,
      brand: p.brands ?? undefined,
      nutrition_info: nutriments ?? undefined,
      ingredients: p.ingredients_text ?? undefined,
      allergens: p.allergens ?? undefined,
    };
  } catch {
    return null;
  }
}

interface ExtractedProduct {
  article_number?: string | null;
  name?: string;
  brand?: string | null;
  ean_barcode?: string | null;
  price?: number | null;
  weight_or_quantity?: string | null;
  nutrition_info?: Record<string, unknown> | null;
  ingredients?: string | null;
  allergens?: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
  special_start_date?: string | null;
  special_end_date?: string | null;
}

interface ClaudeResponse {
  photo_type?: string;
  products?: ExtractedProduct[];
  receipt_date?: string | null;
  special_valid_from?: string | null;
  special_valid_to?: string | null;
  flyer_title?: string | null;
}

/** Extracted product with optional F14 flyer page number. */
interface ExtractedProductWithPage extends ExtractedProduct {
  flyer_page?: number;
}

/** Call Claude with a single-page PDF (base64) and the given prompt; parse and return ClaudeResponse. */
async function callClaudeWithPdf(
  apiKey: string,
  pdfBase64: string,
  prompt: string
): Promise<ClaudeResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "document" as const,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: pdfBase64,
              },
            },
            { type: "text" as const, text: prompt },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("No response from Claude");
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned) as ClaudeResponse;
}

/** Ask Claude for product bounding box. Returns null on failure or invalid response. */
async function getProductBoundingBox(
  apiKey: string,
  imageBase64: string,
  mediaType: string,
  imageWidth: number,
  imageHeight: number
): Promise<{ crop_x: number; crop_y: number; crop_width: number; crop_height: number } | null> {
  try {
    const prompt = `${CROP_PROMPT}\n\nThe image is ${imageWidth} x ${imageHeight} pixels.`;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                  data: imageBase64,
                },
              },
              { type: "text" as const, text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text;
    if (!text) return null;
    const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      crop_x?: number;
      crop_y?: number;
      crop_width?: number;
      crop_height?: number;
      image_width?: number;
      image_height?: number;
    };
    const crop_x = Math.max(0, Math.floor(Number(parsed.crop_x) ?? 0));
    const crop_y = Math.max(0, Math.floor(Number(parsed.crop_y) ?? 0));
    const crop_width = Math.max(1, Math.floor(Number(parsed.crop_width) ?? 0));
    const crop_height = Math.max(1, Math.floor(Number(parsed.crop_height) ?? 0));
    if (crop_x + crop_width > imageWidth || crop_y + crop_height > imageHeight) return null;
    return { crop_x, crop_y, crop_width, crop_height };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  console.log("[process-photo] POST received");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[process-photo] ANTHROPIC_API_KEY not set");
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let body: { upload_id?: string; photo_url?: string; is_pdf?: boolean };
  try {
    body = await request.json();
  } catch {
    console.log("[process-photo] Invalid request JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { upload_id, photo_url, is_pdf } = body;
  console.log("[process-photo] upload_id:", upload_id, "photo_url length:", photo_url?.length ?? 0, "is_pdf:", is_pdf);
  if (!upload_id || !photo_url) {
    console.log("[process-photo] Missing upload_id or photo_url");
    return NextResponse.json({ error: "upload_id and photo_url required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    console.log("[process-photo] Supabase admin not configured");
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

  const now = new Date().toISOString();
  /** F14: Set when processing flyer_pdf; used to set flyer_id/flyer_page on products. */
  let flyerIdForProducts: string | null = null;
  /** When flyer has >5 pages: after product upsert, set status "processing" and return process_remaining_pages. */
  let flyerRemainingPages: { flyer_id: string; total_pages: number; pages_processed: number } | null = null;

  // Timeout cleanup: mark uploads stuck in 'processing' for > 5 minutes as 'error'
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("photo_uploads")
    .update({
      status: "error",
      error_message: "Timeout: Verarbeitung dauerte zu lange (> 5 Minuten).",
      processed_at: now,
    })
    .eq("status", "processing")
    .lt("created_at", fiveMinutesAgo);

  const { error: updateProcessing } = await supabase
    .from("photo_uploads")
    .update({ status: "processing" })
    .eq("upload_id", upload_id);

  if (updateProcessing) {
    console.log("[process-photo] Failed to update status to processing:", updateProcessing.message);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
  console.log("[process-photo] Status set to processing for", upload_id);

  let imageBase64: string;
  let mediaType = "image/jpeg";
  let imageBuffer: Buffer | null = null;
  let pdfByteLength = 0;
  let pdfBuf: ArrayBuffer | null = null;
  try {
    const imageRes = await fetch(photo_url);
    if (!imageRes.ok) throw new Error(`Fetch: ${imageRes.status}`);
    const buf = await imageRes.arrayBuffer();
    mediaType = imageRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const isPdfContent = mediaType === "application/pdf" || is_pdf === true;
    if (isPdfContent) {
      pdfByteLength = buf.byteLength;
      pdfBuf = buf;
      imageBase64 = Buffer.from(buf).toString("base64");
    } else {
      imageBuffer = Buffer.from(buf);
      const resized = await sharp(imageBuffer)
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      imageBuffer = resized;
      mediaType = "image/jpeg";
      imageBase64 = resized.toString("base64");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    console.log("[process-photo] Fetch failed:", msg);
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", upload_id);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
  const isPdfFromContent = mediaType === "application/pdf";
  const isPdf = is_pdf === true || isPdfFromContent;
  if (isPdf) {
    const sizeMB = (pdfByteLength / (1024 * 1024)).toFixed(1);
    console.log("[process-photo] PDF size:", sizeMB, "MB");
  }
  if (isPdfFromContent && !is_pdf) {
    console.log("[process-photo] Detected PDF from content-type, processing as flyer");
  }
  console.log("[process-photo] Fetched, is_pdf:", is_pdf, "isPdf:", isPdf, "calling Claude");

  let claudeJson: ClaudeResponse;

  if (isPdf && pdfBuf) {
    try {
      const pdfBytes = new Uint8Array(pdfBuf);
      const sourceDoc = await PDFDocument.load(pdfBytes);
      const totalPages = sourceDoc.getPageCount();
      console.log("[process-photo] Flyer PDF: total pages:", totalPages);

      // Placeholder flyer (title/validity updated after page 1)
      const today = new Date().toISOString().slice(0, 10);
      const { data: flyerRow, error: flyerErr } = await supabase
        .from("flyers")
        .insert({
          title: "Handzettel",
          valid_from: today,
          valid_until: today,
          country: "DE",
          pdf_url: photo_url,
          total_pages: totalPages,
          status: "active",
          created_at: now,
        })
        .select("flyer_id")
        .single();
      if (flyerErr || !flyerRow) {
        console.log("[process-photo] Flyer insert failed:", flyerErr?.message);
        await supabase
          .from("photo_uploads")
          .update({
            status: "error",
            error_message: "Flyer anlegen fehlgeschlagen",
            processed_at: now,
          })
          .eq("upload_id", upload_id);
        return NextResponse.json({ error: "Failed to create flyer" }, { status: 502 });
      }
      flyerIdForProducts = flyerRow.flyer_id as string;

      // Split into single-page PDFs and upload to flyer-pages bucket; create flyer_pages rows
      for (let n = 1; n <= totalPages; n++) {
        const pageDoc = await PDFDocument.create();
        const [page] = await pageDoc.copyPages(sourceDoc, [n - 1]);
        pageDoc.addPage(page);
        const pagePdfBytes = await pageDoc.save();
        const path = `${flyerIdForProducts}/page-${n}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("flyer-pages")
          .upload(path, pagePdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) {
          console.log("[process-photo] Flyer page PDF upload failed:", upErr.message);
        } else {
          const { data: urlData } = supabase.storage.from("flyer-pages").getPublicUrl(path);
          await supabase.from("flyer_pages").insert({
            flyer_id: flyerIdForProducts,
            page_number: n,
            image_url: urlData.publicUrl,
          });
        }
      }

      let validFrom = today;
      let validUntil = today;
      let title = "Handzettel";
      const allProducts: ExtractedProductWithPage[] = [];
      const pagesToProcessInInitial = Math.min(totalPages, PDF_PAGES_INITIAL_MAX);

      // Page 1: Claude for title, validity, products
      const firstPageDoc = await PDFDocument.create();
      const [firstPage] = await firstPageDoc.copyPages(sourceDoc, [0]);
      firstPageDoc.addPage(firstPage);
      const firstPagePdfBytes = await firstPageDoc.save();
      const firstPageBase64 = Buffer.from(firstPagePdfBytes).toString("base64");
      const firstResponse = await callClaudeWithPdf(apiKey, firstPageBase64, FLYER_PDF_FIRST_PAGE_PROMPT);
      validFrom = firstResponse.special_valid_from ?? today;
      validUntil = firstResponse.special_valid_to ?? validFrom;
      title = (firstResponse.flyer_title ?? "Angebote ab " + validFrom.slice(8, 10) + "." + validFrom.slice(5, 7) + ".").trim();
      await supabase
        .from("flyers")
        .update({
          title,
          valid_from: validFrom,
          valid_until: validUntil,
          status: validUntil < today ? "expired" : "active",
        })
        .eq("flyer_id", flyerIdForProducts);
      (firstResponse.products ?? []).forEach((p) => allProducts.push({ ...p, flyer_page: 1 }));

      await supabase
        .from("photo_uploads")
        .update({
          extracted_data: {
            flyer_id: flyerIdForProducts,
            total_pages: totalPages,
            pages_processed: 1,
            flyer_title: title,
            special_valid_from: validFrom,
            special_valid_to: validUntil,
          } as unknown as Record<string, unknown>,
        })
        .eq("upload_id", upload_id);

      // Pages 2..min(5, totalPages): sequential Claude, products only
      for (let pageNum = 2; pageNum <= pagesToProcessInInitial; pageNum++) {
        const pageDoc = await PDFDocument.create();
        const [page] = await pageDoc.copyPages(sourceDoc, [pageNum - 1]);
        pageDoc.addPage(page);
        const pagePdfBytes = await pageDoc.save();
        const pageBase64 = Buffer.from(pagePdfBytes).toString("base64");
        const pageResponse = await callClaudeWithPdf(apiKey, pageBase64, FLYER_PDF_PAGE_PROMPT);
        (pageResponse.products ?? []).forEach((p) => allProducts.push({ ...p, flyer_page: pageNum }));

        await supabase
          .from("photo_uploads")
          .update({
            extracted_data: {
              flyer_id: flyerIdForProducts,
              total_pages: totalPages,
              pages_processed: pageNum,
              flyer_title: title,
              special_valid_from: validFrom,
              special_valid_to: validUntil,
            } as unknown as Record<string, unknown>,
          })
          .eq("upload_id", upload_id);
      }

      claudeJson = {
        photo_type: "flyer_pdf",
        products: allProducts,
        special_valid_from: validFrom,
        special_valid_to: validUntil,
      };
      console.log("[process-photo] Flyer PDF initial: flyer_id:", flyerIdForProducts, "pages processed:", pagesToProcessInInitial, "products so far:", allProducts.length);
      if (totalPages > PDF_PAGES_INITIAL_MAX) {
        flyerRemainingPages = {
          flyer_id: flyerIdForProducts,
          total_pages: totalPages,
          pages_processed: pagesToProcessInInitial,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Flyer PDF processing failed";
      console.log("[process-photo] Flyer PDF error:", msg);
      await supabase
        .from("photo_uploads")
        .update({ status: "error", error_message: msg, processed_at: now })
        .eq("upload_id", upload_id);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } else {
    try {
      const content = [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: imageBase64,
          },
        },
        { type: "text" as const, text: VISION_PROMPT },
      ];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 8192,
          messages: [{ role: "user", content }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        await supabase
          .from("photo_uploads")
          .update({ status: "error", error_message: `Claude: ${res.status} ${errText}`, processed_at: now })
          .eq("upload_id", upload_id);
        return NextResponse.json({ error: "Claude API failed" }, { status: 502 });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text;
      if (!text) {
        await supabase
          .from("photo_uploads")
          .update({ status: "error", error_message: "No response from Claude", processed_at: now })
          .eq("upload_id", upload_id);
        return NextResponse.json({ error: "No Claude response" }, { status: 502 });
      }

      const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      console.log("[process-photo] Claude response length:", text.length, "cleaned:", cleaned.length);
      let parsed: ClaudeResponse | null = null;
      try {
        parsed = JSON.parse(cleaned) as ClaudeResponse;
      } catch {
        const repaired = tryRepairTruncatedReceiptJson(cleaned);
        if (repaired) {
          try {
            parsed = JSON.parse(repaired) as ClaudeResponse;
            console.log("[process-photo] Repaired truncated JSON, products count:", parsed.products?.length ?? 0);
          } catch {
            // ignore
          }
        }
      }
      if (!parsed) {
        const parseMsg = "JSON parse failed (truncated or invalid)";
        const rawPreview = cleaned.length > 2000 ? cleaned.slice(0, 2000) + "…" : cleaned;
        const error_message = `JSON parse: ${parseMsg}. Raw response: ${rawPreview}`;
        console.log("[process-photo] JSON parse error after repair attempt, raw length:", cleaned.length);
        await supabase
          .from("photo_uploads")
          .update({ status: "error", error_message, processed_at: now })
          .eq("upload_id", upload_id);
        return NextResponse.json({ error: parseMsg }, { status: 502 });
      }
      claudeJson = parsed;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Parse failed";
      await supabase
        .from("photo_uploads")
        .update({ status: "error", error_message: msg, processed_at: now })
        .eq("upload_id", upload_id);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const photoType =
    isPdf
      ? "flyer_pdf"
      : claudeJson.photo_type && ["product_front", "product_back", "receipt", "flyer", "shelf", "flyer_pdf"].includes(claudeJson.photo_type)
        ? claudeJson.photo_type
        : "product_front";

  const products = Array.isArray(claudeJson.products) ? claudeJson.products : [];
  let productsCreated = 0;
  let productsUpdated = 0;
  const pendingThumbnailOverwrites: Array<{ product_id: string; thumbnail_url: string }> = [];

  const { data: categories } = await supabase.from("categories").select("category_id").limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;

  // Thumbnail: EXIF rotate + center cover crop (used for product_back and as fallback for product_front).
  const makeThumb = (buf: Buffer) =>
    sharp(buf)
      .rotate()
      .resize(150, 150, { fit: "cover", position: "center" })
      .jpeg({ quality: 85 })
      .toBuffer();

  let thumbnailUrl: string | null = null;
  let backThumbnailUrl: string | null = null;

  if (photoType === "product_front" && imageBuffer && apiKey) {
    try {
      const orientedBuffer = await sharp(imageBuffer).rotate().toBuffer();
      const meta = await sharp(orientedBuffer).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      let thumbBuffer: Buffer;
      if (w > 0 && h > 0) {
        const orientedBase64 = orientedBuffer.toString("base64");
        const box = await getProductBoundingBox(apiKey, orientedBase64, mediaType, w, h);
        if (box) {
          thumbBuffer = await sharp(orientedBuffer)
            .extract({
              left: box.crop_x,
              top: box.crop_y,
              width: box.crop_width,
              height: box.crop_height,
            })
            .resize(150, 150, {
              fit: "contain",
              background: { r: 255, g: 255, b: 255 },
            })
            .jpeg({ quality: 85 })
            .toBuffer();
        } else {
          thumbBuffer = await makeThumb(imageBuffer);
        }
      } else {
        thumbBuffer = await makeThumb(imageBuffer);
      }
      const thumbPath = `${upload_id}.jpg`;
      const { error: thumbUpErr } = await supabase.storage
        .from("product-thumbnails")
        .upload(thumbPath, thumbBuffer, { contentType: "image/jpeg", upsert: true });
      if (!thumbUpErr) {
        const { data: thumbUrlData } = supabase.storage.from("product-thumbnails").getPublicUrl(thumbPath);
        thumbnailUrl = thumbUrlData.publicUrl;
        console.log("[process-photo] Thumbnail uploaded:", thumbPath);
      } else {
        console.log("[process-photo] Thumbnail upload failed:", thumbUpErr.message);
      }
    } catch (e) {
      console.log("[process-photo] Sharp thumbnail failed:", e instanceof Error ? e.message : e);
    }
  } else if (photoType === "product_back" && imageBuffer) {
    try {
      const thumbBuffer = await makeThumb(imageBuffer);
      const thumbPath = `back-${upload_id}.jpg`;
      const { error: thumbUpErr } = await supabase.storage
        .from("product-thumbnails")
        .upload(thumbPath, thumbBuffer, { contentType: "image/jpeg", upsert: true });
      if (!thumbUpErr) {
        const { data: thumbUrlData } = supabase.storage.from("product-thumbnails").getPublicUrl(thumbPath);
        backThumbnailUrl = thumbUrlData.publicUrl;
        console.log("[process-photo] Back thumbnail uploaded:", thumbPath);
      } else {
        console.log("[process-photo] Back thumbnail upload failed:", thumbUpErr.message);
      }
    } catch (e) {
      console.log("[process-photo] Sharp back thumbnail failed:", e instanceof Error ? e.message : e);
    }
  } else if (photoType === "flyer_pdf") {
    // F14: No backend thumbnail; frontend renders first page PDF with pdfjs-dist.
  }

  const needsReview =
    photoType === "product_front" || photoType === "product_back" || photoType === "shelf";

  if (needsReview) {
    const extractedData = {
      ...claudeJson,
      ...(thumbnailUrl != null ? { thumbnail_url: thumbnailUrl } : {}),
      ...(backThumbnailUrl != null ? { thumbnail_back_url: backThumbnailUrl } : {}),
    };
    const { error: reviewErr } = await supabase
      .from("photo_uploads")
      .update({
        status: "pending_review",
        photo_type: photoType,
        extracted_data: extractedData as unknown as Record<string, unknown>,
        products_created: 0,
        products_updated: 0,
        processed_at: now,
        error_message: null,
        pending_thumbnail_overwrites: null,
      })
      .eq("upload_id", upload_id);
    if (reviewErr) {
      // Status 'pending_review' wird abgelehnt, wenn die Migration 20250220110000_photo_uploads_review_status nicht angewendet wurde.
      // Dann erscheint das Bestätigungsfenster nicht – Migration ausführen: supabase db push bzw. 20250220110000 anwenden.
      console.error(
        "[process-photo] pending_review update failed (Review-Fenster erscheint nicht). Migration 20250220110000 anwenden:",
        reviewErr.message
      );
      const { error: fallbackErr } = await supabase
        .from("photo_uploads")
        .update({
          status: "completed",
          photo_type: photoType,
          extracted_data: extractedData as unknown as Record<string, unknown>,
          products_created: 0,
          products_updated: 0,
          processed_at: now,
          error_message: "Review-Status nicht verfügbar – bitte Migration 20250220110000 anwenden.",
          pending_thumbnail_overwrites: null,
        })
        .eq("upload_id", upload_id);
      if (fallbackErr) {
        console.log("[process-photo] Fallback update also failed:", fallbackErr.message);
      }
      return NextResponse.json({
        ok: true,
        upload_id: upload_id,
        photo_type: photoType,
        status: "completed",
        warning: "pending_review constraint missing – run migration 20250220110000",
      });
    }
    console.log("[process-photo] Saved for review", upload_id, "photo_type:", photoType);
    return NextResponse.json({
      ok: true,
      upload_id: upload_id,
      photo_type: photoType,
      status: "pending_review",
    });
  }

  for (const p of products) {
    const name = (p.name || "").trim();
    if (!name) continue;
    const flyerPage = (p as ExtractedProductWithPage).flyer_page;
    const flyerId = flyerIdForProducts;

    let articleNumber: string | null =
      p.article_number != null ? String(p.article_number).trim() || null : null;
    if (!articleNumber && photoType === "receipt") {
      articleNumber = extractArticleNumberFromReceiptLine(name);
    }
    const nameNorm = normalizeName(name);
    const ean = p.ean_barcode?.trim() || null;
    let offData: Awaited<ReturnType<typeof fetchOpenFoodFacts>> = null;
    if (ean) offData = await fetchOpenFoodFacts(ean);

    const price = typeof p.price === "number" ? p.price : null;
    const nutritionInfo = p.nutrition_info ?? offData?.nutrition_info ?? null;
    const ingredients = p.ingredients ?? offData?.ingredients ?? null;
    const allergens = p.allergens ?? offData?.allergens ?? null;
    const brand = (p.brand ?? offData?.brand ?? null)?.trim() || null;
    const displayName = (offData?.name ?? name).trim();
    const fallbackDemand = getDemandGroupFallback(displayName);
    const demandGroup =
      (p.demand_group?.trim() || null) ?? fallbackDemand?.demand_group ?? null;
    const demandSubGroup =
      (p.demand_sub_group?.trim() || null) ?? fallbackDemand?.demand_sub_group ?? null;

    // Duplicate check: flyer_pdf = article_number then name_normalized; others = article_number, ean, name_normalized
    let existing: { product_id: string; thumbnail_url: string | null } | null = null;
    if (articleNumber) {
      const { data: byArticle } = await supabase
        .from("products")
        .select("product_id, thumbnail_url")
        .eq("article_number", articleNumber)
        .eq("status", "active")
        .maybeSingle();
      existing = byArticle ? { product_id: byArticle.product_id, thumbnail_url: byArticle.thumbnail_url } : null;
    }
    if (!existing && photoType !== "flyer_pdf" && ean) {
      const { data: byEan } = await supabase
        .from("products")
        .select("product_id, thumbnail_url")
        .eq("ean_barcode", ean)
        .eq("status", "active")
        .maybeSingle();
      existing = byEan ? { product_id: byEan.product_id, thumbnail_url: byEan.thumbnail_url } : null;
    }
    if (!existing) {
      const { data: byName } = await supabase
        .from("products")
        .select("product_id, thumbnail_url")
        .ilike("name_normalized", nameNorm)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      existing = byName ? { product_id: byName.product_id, thumbnail_url: byName.thumbnail_url } : null;
    }

    const nameNormalized = normalizeName(displayName);
    const assortmentType = photoType === "flyer" || photoType === "flyer_pdf" ? "special" : "daily_range";
    const specialStart =
      photoType === "flyer_pdf"
        ? (p.special_start_date ?? claudeJson.special_valid_from ?? null)
        : (claudeJson.special_valid_from ?? null);
    const specialEnd =
      photoType === "flyer_pdf"
        ? (p.special_end_date ?? claudeJson.special_valid_to ?? null)
        : (claudeJson.special_valid_to ?? null);

    if (existing) {
      const { data: current } = await supabase
        .from("products")
        .select("*")
        .eq("product_id", existing.product_id)
        .single();

      const updates: Record<string, unknown> = {
        updated_at: now,
      };
      if (price != null) {
        updates.price = price;
        updates.price_updated_at = claudeJson.receipt_date || now;
      }
      if (current) {
        if (current.name_normalized == null || current.name_normalized === "") updates.name_normalized = nameNormalized;
        if (current.name == null || current.name === "") updates.name = displayName;
        if (articleNumber) updates.article_number = articleNumber;
        if (current.brand == null && brand) updates.brand = brand;
        if (current.nutrition_info == null && nutritionInfo) updates.nutrition_info = nutritionInfo;
        if (current.ingredients == null && ingredients) updates.ingredients = ingredients;
        if (current.allergens == null && allergens) updates.allergens = allergens;
        if (current.ean_barcode == null && ean) updates.ean_barcode = ean;
        if (current.demand_group == null && demandGroup) updates.demand_group = demandGroup;
        if (current.demand_sub_group == null && demandSubGroup) updates.demand_sub_group = demandSubGroup;
        if (assortmentType === "special") {
          if (specialStart) updates.special_start_date = specialStart;
          if (specialEnd) updates.special_end_date = specialEnd;
        }
        if (flyerId != null && flyerPage != null) {
          updates.flyer_id = flyerId;
          updates.flyer_page = flyerPage;
        }
      }

      const resolvedThumbUrl = thumbnailUrl ?? photo_url;
      const hasThumbnail =
        photoType === "product_front" || (photoType === "flyer_pdf" && thumbnailUrl != null);
      if (existing.thumbnail_url && hasThumbnail) {
        pendingThumbnailOverwrites.push({ product_id: existing.product_id, thumbnail_url: resolvedThumbUrl });
      } else if (!existing.thumbnail_url && hasThumbnail) {
        updates.thumbnail_url = resolvedThumbUrl;
        updates.photo_source_id = upload_id;
      }
      if (photoType === "product_back" && backThumbnailUrl) {
        updates.thumbnail_back_url = backThumbnailUrl;
      }

      const { error: updErr } = await supabase
        .from("products")
        .update(updates)
        .eq("product_id", existing.product_id);
      if (!updErr) productsUpdated++;
    } else if (defaultCategoryId) {
      const source = photoType === "flyer_pdf" ? "import" : "crowdsourcing";
      const resolvedThumbUrl = thumbnailUrl ?? photo_url;
      const { data: inserted, error: insErr } = await supabase
        .from("products")
        .insert({
          name: displayName,
          name_normalized: nameNormalized,
          category_id: defaultCategoryId,
          article_number: articleNumber,
          brand,
          price,
          price_updated_at: price != null ? (claudeJson.receipt_date || now) : null,
          assortment_type: assortmentType,
          availability: "national",
          status: "active",
          source,
          ...(source === "crowdsourcing" ? { crowdsource_status: "pending" } : {}),
          ean_barcode: ean,
          nutrition_info: nutritionInfo,
          ingredients,
          allergens,
          demand_group: demandGroup,
          demand_sub_group: demandSubGroup,
          special_start_date: assortmentType === "special" ? specialStart : null,
          special_end_date: assortmentType === "special" ? specialEnd : null,
          country: "DE",
          thumbnail_url:
            photoType === "product_front" || (photoType === "flyer_pdf" && thumbnailUrl != null)
              ? resolvedThumbUrl
              : null,
          thumbnail_back_url: photoType === "product_back" && backThumbnailUrl ? backThumbnailUrl : null,
          photo_source_id:
            photoType === "product_front" || (photoType === "flyer_pdf" && thumbnailUrl != null)
              ? upload_id
              : null,
          created_at: now,
          updated_at: now,
          ...(flyerId != null && flyerPage != null ? { flyer_id: flyerId, flyer_page: flyerPage } : {}),
        })
        .select("product_id")
        .single();
      if (!insErr && inserted) productsCreated++;
    }
  }
  // If no defaultCategoryId, new products are skipped (categories table empty)

  if (flyerRemainingPages) {
    const extractedData = {
      flyer_id: flyerRemainingPages.flyer_id,
      total_pages: flyerRemainingPages.total_pages,
      pages_processed: flyerRemainingPages.pages_processed,
      flyer_title: (claudeJson as { flyer_title?: string }).flyer_title ?? null,
      special_valid_from: claudeJson.special_valid_from ?? null,
      special_valid_to: claudeJson.special_valid_to ?? null,
    };
    const { error: finalErr } = await supabase
      .from("photo_uploads")
      .update({
        status: "processing",
        photo_type: "flyer_pdf",
        extracted_data: extractedData as unknown as Record<string, unknown>,
        products_created: productsCreated,
        products_updated: productsUpdated,
        processed_at: now,
        error_message: null,
        pending_thumbnail_overwrites:
          pendingThumbnailOverwrites.length > 0 ? pendingThumbnailOverwrites : null,
      })
      .eq("upload_id", upload_id);
    if (finalErr) {
      console.log("[process-photo] Finalize (remaining pages) failed:", finalErr.message);
      return NextResponse.json({ error: "Failed to finalize" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      upload_id: upload_id,
      photo_type: "flyer_pdf",
      flyer_id: flyerRemainingPages.flyer_id,
      total_pages: flyerRemainingPages.total_pages,
      pages_processed: flyerRemainingPages.pages_processed,
      process_remaining_pages: true,
      products_created: productsCreated,
      products_updated: productsUpdated,
    });
  }

  const { error: finalErr } = await supabase
    .from("photo_uploads")
    .update({
      status: "completed",
      photo_type: photoType,
      extracted_data: claudeJson as unknown as Record<string, unknown>,
      products_created: productsCreated,
      products_updated: productsUpdated,
      processed_at: now,
      error_message: null,
      pending_thumbnail_overwrites:
        pendingThumbnailOverwrites.length > 0 ? pendingThumbnailOverwrites : null,
    })
    .eq("upload_id", upload_id);

  if (finalErr) {
    console.log("[process-photo] Finalize failed:", finalErr.message);
    return NextResponse.json({ error: "Failed to finalize" }, { status: 500 });
  }

  console.log("[process-photo] Completed", upload_id, "products_created:", productsCreated, "products_updated:", productsUpdated);
  return NextResponse.json({
    ok: true,
    upload_id: upload_id,
    photo_type: photoType,
    products_created: productsCreated,
    products_updated: productsUpdated,
    pending_thumbnail_overwrites: pendingThumbnailOverwrites.length,
  });
}
