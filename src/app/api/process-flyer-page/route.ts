/**
 * WORKAROUND: Process a single flyer page via Claude Vision.
 * Extracts products + bounding boxes, writes to flyer_page_products junction table.
 * This will be replaced once structured retailer data feeds are available.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDemandGroupFallback } from "@/lib/products/demand-group-fallback";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaudeJSON } from "@/lib/api/claude-client";
import {
  FLYER_PDF_PAGE_PROMPT,
  type ExtractedProduct,
} from "@/lib/api/photo-processing/prompts";
import { normalizeName } from "@/lib/products/normalize";
import { fetchOpenFoodFacts } from "@/lib/products/open-food-facts";
import { findExistingProduct } from "@/lib/products/find-existing";
import { upsertProduct } from "@/lib/products/upsert-product";
import { getDefaultCategoryId } from "@/lib/products/default-category";

const processFlyerPageSchema = z.object({
  upload_id: z.string().min(1).max(100),
  flyer_id: z.string().min(1).max(100),
  page_number: z.number().int().min(1),
});

export async function POST(request: Request) {
  // #region agent log
  const _fs = await import('fs'); _fs.appendFileSync('debug-5f58ab.log', JSON.stringify({sessionId:'5f58ab',location:'process-flyer-page:entry',message:'API-route-called',data:{},timestamp:Date.now(),hypothesisId:'H5'})+'\n');
  // #endregion
  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = processFlyerPageSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { upload_id, flyer_id, page_number } = parsed.data;

  const rateLimitResponse = await checkRateLimit(
    generalRateLimit,
    getIdentifier(request)
  );
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

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

  // Idempotency: skip if this page was already processed
  if (extracted.pages_processed != null && page_number <= extracted.pages_processed) {
    return NextResponse.json({
      ok: true,
      upload_id,
      flyer_id,
      page_number,
      pages_processed: extracted.pages_processed,
      total_pages: totalPages,
      products_created: 0,
      products_updated: 0,
      completed: extracted.pages_processed >= totalPages,
      skipped: true,
    });
  }

  const { data: flyerRow } = await supabase
    .from("flyers")
    .select("country")
    .eq("flyer_id", flyer_id)
    .single();
  const flyerCountry = flyerRow?.country === "AT" ? "AT" : "DE";

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
    claudeJson = await callClaudeJSON<{ products?: ExtractedProduct[] }>({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 16384,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { type: "text", text: FLYER_PDF_PAGE_PROMPT },
          ],
        },
      ],
    });
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

  const defaultCategoryId = await getDefaultCategoryId(supabase);

  await supabase
    .from("flyer_page_products")
    .delete()
    .eq("flyer_id", flyer_id)
    .eq("page_number", page_number);

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

    const existing = await findExistingProduct(supabase, {
      article_number: articleNumber,
      ean_barcode: ean,
      name_normalized: nameNorm,
    });

    let resultProductId: string | null = null;

    if (existing) {
      const result = await upsertProduct(supabase, {
        name: displayName,
        name_normalized: nameNormalized,
        article_number: articleNumber,
        brand,
        price,
        ...(price != null ? { price_updated_at: now } : {}),
        ean_barcode: ean,
        demand_group: demandGroup,
        demand_sub_group: demandSubGroup,
        ...(p.is_private_label != null ? { is_private_label: p.is_private_label } : {}),
        ...(p.is_seasonal === true ? { is_seasonal: true } : {}),
        special_start_date: specialStart,
        special_end_date: specialEnd,
      }, existing.product_id);
      if (result) {
        productsUpdated++;
        resultProductId = result.product_id;
      }
    } else if (defaultCategoryId) {
      const assortmentType = p.assortment_type === "special_food" ? "special_food"
        : p.assortment_type === "special_nonfood" ? "special_nonfood"
        : p.assortment_type === "special" ? "special_food"
        : "daily_range";
      const result = await upsertProduct(supabase, {
        name: displayName,
        name_normalized: nameNormalized,
        category_id: defaultCategoryId,
        article_number: articleNumber,
        brand,
        price,
        price_updated_at: price != null ? now : null,
        assortment_type: assortmentType,
        source: "import",
        ean_barcode: ean,
        demand_group: demandGroup,
        demand_sub_group: demandSubGroup,
        special_start_date: specialStart,
        special_end_date: specialEnd,
        country: flyerCountry,
        is_private_label: p.is_private_label ?? null,
        is_seasonal: p.is_seasonal === true,
      });
      if (result) {
        productsCreated++;
        resultProductId = result.product_id;
      }
    }

    if (resultProductId) {
      const bbox = Array.isArray(p.bbox) && p.bbox.length === 4 ? p.bbox : null;
      await supabase.from("flyer_page_products").upsert({
        flyer_id,
        page_number,
        product_id: resultProductId,
        price_in_flyer: price,
        bbox: bbox
          ? { y_min: bbox[0], x_min: bbox[1], y_max: bbox[2], x_max: bbox[3] }
          : null,
      }, { onConflict: "flyer_id,page_number,product_id" });
    }
  }

  const prevCreated = Number((uploadRow as { products_created?: number }).products_created) || 0;
  const prevUpdated = Number((uploadRow as { products_updated?: number }).products_updated) || 0;
  const newExtracted = {
    ...extracted,
    pages_processed: Math.max(page_number, extracted.pages_processed ?? 0),
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
