/**
 * F14: Process a single flyer page (6+) after initial process-photo. Fetches page PDF from Storage,
 * calls Claude, upserts products with flyer_id/flyer_page, updates photo_uploads progress.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMAND_GROUPS_INSTRUCTION } from "@/lib/products/demand-groups-prompt";
import { getDemandGroupFallback } from "@/lib/products/demand-group-fallback";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";

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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    return {
      name: p.product_name ?? undefined,
      brand: p.brands ?? undefined,
      nutrition_info: (p.nutriments as Record<string, unknown>) ?? undefined,
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
  demand_group?: string | null;
  demand_sub_group?: string | null;
  special_start_date?: string | null;
  special_end_date?: string | null;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let body: { upload_id?: string; flyer_id?: string; page_number?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { upload_id, flyer_id, page_number } = body;
  if (!upload_id || !flyer_id || typeof page_number !== "number" || page_number < 1) {
    return NextResponse.json(
      { error: "upload_id, flyer_id and page_number (>= 1) required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { data: uploadRow, error: uploadErr } = await supabase
    .from("photo_uploads")
    .select("upload_id, status, extracted_data, products_created, products_updated")
    .eq("upload_id", upload_id)
    .single();

  if (uploadErr || !uploadRow) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const extracted = (uploadRow.extracted_data ?? {}) as {
    flyer_id?: string;
    total_pages?: number;
    pages_processed?: number;
    special_valid_from?: string;
    special_valid_to?: string;
  };
  if (extracted.flyer_id !== flyer_id || !extracted.total_pages) {
    return NextResponse.json({ error: "Upload not associated with this flyer" }, { status: 400 });
  }
  const totalPages = extracted.total_pages;
  const validFrom = extracted.special_valid_from ?? now.slice(0, 10);
  const validTo = extracted.special_valid_to ?? validFrom;

  if (page_number > totalPages) {
    return NextResponse.json({ error: "page_number exceeds total_pages" }, { status: 400 });
  }

  const { data: pageRow, error: pageErr } = await supabase
    .from("flyer_pages")
    .select("page_id, image_url")
    .eq("flyer_id", flyer_id)
    .eq("page_number", page_number)
    .single();

  if (pageErr || !pageRow?.image_url) {
    return NextResponse.json({ error: "Flyer page or PDF URL not found" }, { status: 404 });
  }

  let pdfBase64: string;
  try {
    const res = await fetch(pageRow.image_url);
    if (!res.ok) throw new Error(`Fetch PDF: ${res.status}`);
    const buf = await res.arrayBuffer();
    pdfBase64 = Buffer.from(buf).toString("base64");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch page PDF";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let claudeJson: { products?: ExtractedProduct[] };
  try {
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
              { type: "text" as const, text: FLYER_PDF_PAGE_PROMPT },
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
    claudeJson = JSON.parse(cleaned) as { products?: ExtractedProduct[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claude failed";
    await supabase
      .from("photo_uploads")
      .update({
        status: "error",
        error_message: `Seite ${page_number}: ${msg}`,
        processed_at: now,
      })
      .eq("upload_id", upload_id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const products = Array.isArray(claudeJson.products) ? claudeJson.products : [];
  let productsCreated = 0;
  let productsUpdated = 0;

  const { data: categories } = await supabase.from("categories").select("category_id").limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;

  for (const p of products) {
    const name = (p.name || "").trim();
    if (!name) continue;

    const nameNorm = normalizeName(name);
    const ean = p.ean_barcode?.trim() || null;
    let offData: Awaited<ReturnType<typeof fetchOpenFoodFacts>> = null;
    if (ean) offData = await fetchOpenFoodFacts(ean);

    const articleNumber = p.article_number != null ? String(p.article_number).trim() || null : null;
    const price = typeof p.price === "number" ? p.price : null;
    const brand = (p.brand ?? offData?.brand ?? null)?.trim() || null;
    const displayName = (offData?.name ?? name).trim();
    const fallbackDemand = getDemandGroupFallback(displayName);
    const demandGroup = (p.demand_group?.trim() || null) ?? fallbackDemand?.demand_group ?? null;
    const demandSubGroup = (p.demand_sub_group?.trim() || null) ?? fallbackDemand?.demand_sub_group ?? null;
    const nameNormalized = normalizeName(displayName);
    const specialStart = p.special_start_date ?? validFrom;
    const specialEnd = p.special_end_date ?? validTo;

    let existing: { product_id: string } | null = null;
    if (articleNumber) {
      const { data: byArticle } = await supabase
        .from("products")
        .select("product_id")
        .eq("article_number", articleNumber)
        .eq("status", "active")
        .maybeSingle();
      existing = byArticle ? { product_id: byArticle.product_id } : null;
    }
    if (!existing && ean) {
      const { data: byEan } = await supabase
        .from("products")
        .select("product_id")
        .eq("ean_barcode", ean)
        .eq("status", "active")
        .maybeSingle();
      existing = byEan ? { product_id: byEan.product_id } : null;
    }
    if (!existing) {
      const { data: byName } = await supabase
        .from("products")
        .select("product_id")
        .ilike("name_normalized", nameNorm)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      existing = byName ? { product_id: byName.product_id } : null;
    }

    if (existing) {
      const { error: updErr } = await supabase
        .from("products")
        .update({
          updated_at: now,
          price: price ?? undefined,
          price_updated_at: price != null ? now : undefined,
          flyer_id: flyer_id,
          flyer_page: page_number,
          special_start_date: specialStart,
          special_end_date: specialEnd,
          demand_group: demandGroup ?? undefined,
          demand_sub_group: demandSubGroup ?? undefined,
        })
        .eq("product_id", existing.product_id);
      if (!updErr) productsUpdated++;
    } else if (defaultCategoryId) {
      const { error: insErr } = await supabase.from("products").insert({
        name: displayName,
        name_normalized: nameNormalized,
        category_id: defaultCategoryId,
        article_number: articleNumber,
        brand,
        price,
        price_updated_at: price != null ? now : null,
        assortment_type: "special",
        availability: "national",
        status: "active",
        source: "import",
        ean_barcode: ean,
        demand_group: demandGroup,
        demand_sub_group: demandSubGroup,
        special_start_date: specialStart,
        special_end_date: specialEnd,
        country: "DE",
        flyer_id: flyer_id,
        flyer_page: page_number,
        created_at: now,
        updated_at: now,
      });
      if (!insErr) productsCreated++;
    }
  }

  const prevCreated = Number((uploadRow as { products_created?: number }).products_created) || 0;
  const prevUpdated = Number((uploadRow as { products_updated?: number }).products_updated) || 0;
  const newExtracted = {
    ...extracted,
    pages_processed: page_number,
  };

  const isLastPage = page_number === totalPages;

  const { error: updateErr } = await supabase
    .from("photo_uploads")
    .update({
      extracted_data: newExtracted as unknown as Record<string, unknown>,
      products_created: prevCreated + productsCreated,
      products_updated: prevUpdated + productsUpdated,
      ...(isLastPage
        ? {
            status: "completed",
            processed_at: now,
            error_message: null,
          }
        : {}),
    })
    .eq("upload_id", upload_id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    upload_id,
    flyer_id,
    page_number,
    pages_processed: page_number,
    total_pages: totalPages,
    products_created: productsCreated,
    products_updated: productsUpdated,
    completed: isLastPage,
  });
}
