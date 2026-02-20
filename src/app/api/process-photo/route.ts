/**
 * F13: Process uploaded photo with Claude Vision. Detect type, extract data, optionally call Open Food Facts, upsert products.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

const VISION_PROMPT = `You are analyzing a photo from a grocery shopping context. Classify the photo type and extract structured data.

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks, kein zusätzlicher Text. Halte die Antwort kompakt.

Photo types: product_front (single product front), product_back (product back with barcode/nutrition), receipt (supermarket receipt), flyer (promo flyer), shelf (store shelf with multiple products).

For RECEIPTS (especially ALDI/Hofer): The number on the far LEFT of each line is the store article number (article_number). Extract it for every product line. ALDI receipts use heavily abbreviated product names (e.g. MILS.FETT.MI = Milsani Fettarme Milch). Try to reconstruct the full product name where possible. Extract EVERY line of the receipt as a product – even if the name is unclear, return the raw receipt text as name. Prefer one product with abbreviated name over omitting the line. Capture ALL lines, not only those you are confident about.

Respond with a single JSON object, no markdown, with this shape:
{
  "photo_type": "product_front" | "product_back" | "receipt" | "flyer" | "shelf",
  "products": [
    {
      "article_number": "string or null – for receipts: the number on the far left (ALDI/Hofer article number)",
      "name": "string – full name if known, otherwise raw receipt text",
      "brand": "string or null",
      "ean_barcode": "string or null if visible",
      "price": number or null,
      "weight_or_quantity": "string or null e.g. 1L, 500g",
      "nutrition_info": object or null (per 100g/ml if visible),
      "ingredients": "string or null",
      "allergens": "string or null",
      "demand_group": "string or null e.g. Frische & Kühlung"
    }
  ],
  "receipt_date": "YYYY-MM-DD or null if receipt",
  "special_valid_from": "YYYY-MM-DD or null if flyer",
  "special_valid_to": "YYYY-MM-DD or null if flyer"
}

Extract all visible product names and prices. For receipts: every line = one product; use article_number (left number), price, and name (full if you can infer it, else raw text). For product_front/back focus on one product. Keep the JSON compact (short strings, minimal fields).`;

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
}

interface ClaudeResponse {
  photo_type?: string;
  products?: ExtractedProduct[];
  receipt_date?: string | null;
  special_valid_from?: string | null;
  special_valid_to?: string | null;
}

export async function POST(request: Request) {
  console.log("[process-photo] POST received");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[process-photo] ANTHROPIC_API_KEY not set");
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let body: { upload_id?: string; photo_url?: string };
  try {
    body = await request.json();
  } catch {
    console.log("[process-photo] Invalid request JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { upload_id, photo_url } = body;
  console.log("[process-photo] upload_id:", upload_id, "photo_url length:", photo_url?.length ?? 0);
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
  try {
    const imageRes = await fetch(photo_url);
    if (!imageRes.ok) throw new Error(`Fetch image: ${imageRes.status}`);
    const buf = await imageRes.arrayBuffer();
    mediaType = imageRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    imageBase64 = Buffer.from(buf).toString("base64");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Image fetch failed";
    console.log("[process-photo] Image fetch failed:", msg);
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", upload_id);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
  console.log("[process-photo] Image fetched, calling Claude");

  let claudeJson: ClaudeResponse;
  try {
    const res = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: imageBase64,
                  },
                },
                { type: "text", text: VISION_PROMPT },
              ],
            },
          ],
        }),
      }
    );

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
    try {
      claudeJson = JSON.parse(cleaned) as ClaudeResponse;
    } catch (parseErr) {
      const parseMsg = parseErr instanceof Error ? parseErr.message : "JSON parse failed";
      const rawPreview = cleaned.length > 2000 ? cleaned.slice(0, 2000) + "…" : cleaned;
      const error_message = `JSON parse: ${parseMsg}. Raw response: ${rawPreview}`;
      console.log("[process-photo] JSON parse error:", parseMsg, "raw length:", cleaned.length);
      await supabase
        .from("photo_uploads")
        .update({ status: "error", error_message, processed_at: now })
        .eq("upload_id", upload_id);
      return NextResponse.json({ error: parseMsg }, { status: 502 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", upload_id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const photoType =
    claudeJson.photo_type && ["product_front", "product_back", "receipt", "flyer", "shelf"].includes(claudeJson.photo_type)
      ? claudeJson.photo_type
      : "product_front";

  const products = Array.isArray(claudeJson.products) ? claudeJson.products : [];
  let productsCreated = 0;
  let productsUpdated = 0;
  const pendingThumbnailOverwrites: Array<{ product_id: string; thumbnail_url: string }> = [];

  const { data: categories } = await supabase.from("categories").select("category_id").limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;

  for (const p of products) {
    const name = (p.name || "").trim();
    if (!name) continue;

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
    if (!existing && ean) {
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
    const assortmentType = photoType === "flyer" ? "special" : "daily_range";
    const specialStart = claudeJson.special_valid_from ?? null;
    const specialEnd = claudeJson.special_valid_to ?? null;

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
        if (current.demand_group == null && p.demand_group) updates.demand_group = p.demand_group;
        if (assortmentType === "special") {
          if (specialStart) updates.special_start_date = specialStart;
          if (specialEnd) updates.special_end_date = specialEnd;
        }
      }

      if (existing.thumbnail_url && photoType === "product_front") {
        const thumbUrl = photo_url;
        pendingThumbnailOverwrites.push({ product_id: existing.product_id, thumbnail_url: thumbUrl });
      } else if (!existing.thumbnail_url && photoType === "product_front") {
        updates.thumbnail_url = photo_url;
        updates.photo_source_id = upload_id;
      }

      const { error: updErr } = await supabase
        .from("products")
        .update(updates)
        .eq("product_id", existing.product_id);
      if (!updErr) productsUpdated++;
    } else if (defaultCategoryId) {
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
          source: "crowdsourcing",
          crowdsource_status: "pending",
          ean_barcode: ean,
          nutrition_info: nutritionInfo,
          ingredients,
          allergens,
          demand_group: p.demand_group ?? null,
          special_start_date: assortmentType === "special" ? specialStart : null,
          special_end_date: assortmentType === "special" ? specialEnd : null,
          country: "DE",
          thumbnail_url: photoType === "product_front" ? photo_url : null,
          photo_source_id: photoType === "product_front" ? upload_id : null,
          created_at: now,
          updated_at: now,
        })
        .select("product_id")
        .single();
      if (!insErr && inserted) productsCreated++;
    }
  }
  // If no defaultCategoryId, new products are skipped (categories table empty)

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
