/**
 * Receipt parsing helpers and shared product upsert loop (BL-31).
 *
 * upsertExtractedProducts is used by all non-review photo types:
 * receipts, flyer_pdf, and image-based flyers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "@/lib/products/normalize";
import { fetchOpenFoodFacts } from "@/lib/products/open-food-facts";
import { getDemandGroupFallback } from "@/lib/products/demand-group-fallback";
import { findExistingProduct } from "@/lib/products/find-existing";
import { upsertProduct } from "@/lib/products/upsert-product";
import { getDefaultDemandGroupCode, getAktionsartikelDemandGroupCode } from "@/lib/products/default-category";
import type {
  ExtractedProduct,
  ExtractedProductWithPage,
  ClaudeResponse,
} from "./prompts";

export function extractArticleNumberFromReceiptLine(
  name: string,
): string | null {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  const match = trimmed.match(/^(\d{4,})/);
  return match ? match[1] : null;
}

export interface UpsertExtractedOptions {
  photoType: string;
  claudeJson: ClaudeResponse;
  uploadId: string;
  photoUrl: string;
  thumbnailUrl: string | null;
  backThumbnailUrl: string | null;
  flyerIdForProducts: string | null;
  flyerCountry: string;
}

export interface UpsertExtractedResult {
  productsCreated: number;
  productsUpdated: number;
  pendingThumbnailOverwrites: Array<{
    product_id: string;
    thumbnail_url: string;
  }>;
}

export async function upsertExtractedProducts(
  supabase: SupabaseClient,
  products: ExtractedProduct[],
  options: UpsertExtractedOptions,
  now: string,
): Promise<UpsertExtractedResult> {
  const {
    photoType,
    claudeJson,
    uploadId,
    photoUrl,
    thumbnailUrl,
    backThumbnailUrl,
    flyerIdForProducts,
    flyerCountry,
  } = options;

  let productsCreated = 0;
  let productsUpdated = 0;
  const pendingThumbnailOverwrites: Array<{
    product_id: string;
    thumbnail_url: string;
  }> = [];

  const defaultDemandGroupCode = getDefaultDemandGroupCode();
  const isFlyer = photoType === "flyer" || photoType === "flyer_pdf";
  const aktionDemandGroupCode = isFlyer ? getAktionsartikelDemandGroupCode() : null;

  if (flyerIdForProducts) {
    const flyerPages = [
      ...new Set(
        products
          .map((p) => (p as ExtractedProductWithPage).flyer_page)
          .filter((pg): pg is number => pg != null && pg >= 1),
      ),
    ];
    for (const pg of flyerPages) {
      await supabase
        .from("flyer_page_products")
        .delete()
        .eq("flyer_id", flyerIdForProducts)
        .eq("page_number", pg);
    }
  }

  for (const p of products) {
    const name = (p.name || "").trim();
    if (!name) continue;
    const flyerPage = (p as ExtractedProductWithPage).flyer_page;
    const flyerId = flyerIdForProducts;

    let articleNumber: string | null =
      p.article_number != null
        ? String(p.article_number).trim() || null
        : null;
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
    const demandSubGroup =
      (p.demand_sub_group?.trim() || null) ??
      fallbackDemand?.demand_sub_group ??
      null;

    const existing = await findExistingProduct(
      supabase,
      {
        article_number: articleNumber,
        ean_barcode: ean,
        name_normalized: nameNorm,
      },
      {
        skipEan: isFlyer,
        select: "product_id, thumbnail_url",
        fuzzy: isFlyer,
      },
    );

    const nameNormalized = normalizeName(displayName);
    const assortmentType = isFlyer
      ? (existing
          ? (p.assortment_type === "special_food" ? "special_food"
            : p.assortment_type === "special_nonfood" ? "special_nonfood"
            : p.assortment_type === "special" ? "special_food"
            : "daily_range")
          : (p.assortment_type === "special_nonfood" ? "special_nonfood" : "special_food"))
      : "daily_range";
    const specialStart =
      photoType === "flyer_pdf"
        ? (p.special_start_date ?? claudeJson.special_valid_from ?? null)
        : (claudeJson.special_valid_from ?? null);
    const specialEnd =
      photoType === "flyer_pdf"
        ? (p.special_end_date ?? claudeJson.special_valid_to ?? null)
        : (claudeJson.special_valid_to ?? null);

    if (existing) {
      const resolvedThumbUrl = thumbnailUrl ?? photoUrl;
      const hasThumbnail =
        photoType === "product_front" ||
        (photoType === "flyer_pdf" && thumbnailUrl != null);
      const thumbData: Record<string, string | null> = {};
      if (existing.thumbnail_url && hasThumbnail) {
        pendingThumbnailOverwrites.push({
          product_id: existing.product_id,
          thumbnail_url: resolvedThumbUrl,
        });
      } else if (!existing.thumbnail_url && hasThumbnail) {
        thumbData.thumbnail_url = resolvedThumbUrl;
        thumbData.photo_source_id = uploadId;
      }
      if (photoType === "product_back" && backThumbnailUrl) {
        thumbData.thumbnail_back_url = backThumbnailUrl;
      }

      const result = await upsertProduct(
        supabase,
        {
          name: displayName,
          name_normalized: nameNormalized,
          article_number: articleNumber,
          brand,
          price,
          ...(price != null
            ? { price_updated_at: claudeJson.receipt_date || now }
            : {}),
          nutrition_info: nutritionInfo,
          ingredients,
          allergens,
          ean_barcode: ean,
          demand_sub_group: demandSubGroup,
          ...(p.is_private_label != null
            ? { is_private_label: p.is_private_label }
            : {}),
          ...(p.is_seasonal === true ? { is_seasonal: true } : {}),
          ...(assortmentType !== "daily_range"
            ? {
                special_start_date: specialStart,
                special_end_date: specialEnd,
              }
            : {}),
          ...thumbData,
        },
        existing.product_id,
      );
      if (result) {
        productsUpdated++;
        if (flyerId && flyerPage != null) {
          const bbox = Array.isArray(p.bbox) && p.bbox.length === 4 ? p.bbox : null;
          await supabase.from("flyer_page_products").upsert({
            flyer_id: flyerId,
            page_number: flyerPage,
            product_id: result.product_id,
            price_in_flyer: price,
            bbox: bbox
              ? { y_min: bbox[0], x_min: bbox[1], y_max: bbox[2], x_max: bbox[3] }
              : null,
          }, { onConflict: "flyer_id,page_number,product_id" });
        }
      }
    } else {
      const source = photoType === "flyer_pdf" ? "import" : "crowdsourcing";
      const resolvedThumbUrl = thumbnailUrl ?? photoUrl;
      const newDemandGroupCode = isFlyer ? (aktionDemandGroupCode ?? defaultDemandGroupCode) : defaultDemandGroupCode;
      const result = await upsertProduct(supabase, {
        name: displayName,
        name_normalized: nameNormalized,
        demand_group_code: newDemandGroupCode,
        article_number: articleNumber,
        brand,
        price,
        price_updated_at: price != null ? (claudeJson.receipt_date || now) : null,
        assortment_type: assortmentType,
        source,
        ean_barcode: ean,
        nutrition_info: nutritionInfo,
        ingredients,
        allergens,
        demand_sub_group: demandSubGroup,
        special_start_date:
          assortmentType !== "daily_range" ? specialStart : null,
        special_end_date: assortmentType !== "daily_range" ? specialEnd : null,
        is_private_label: p.is_private_label ?? null,
        is_seasonal: p.is_seasonal === true,
        country: flyerIdForProducts ? flyerCountry : "DE",
        thumbnail_url:
          photoType === "product_front" ||
          (photoType === "flyer_pdf" && thumbnailUrl != null)
            ? resolvedThumbUrl
            : null,
        thumbnail_back_url:
          photoType === "product_back" && backThumbnailUrl
            ? backThumbnailUrl
            : null,
        photo_source_id:
          photoType === "product_front" ||
          (photoType === "flyer_pdf" && thumbnailUrl != null)
            ? uploadId
            : null,
      });
      if (result) {
        productsCreated++;
        if (flyerId && flyerPage != null) {
          const bbox = Array.isArray(p.bbox) && p.bbox.length === 4 ? p.bbox : null;
          await supabase.from("flyer_page_products").upsert({
            flyer_id: flyerId,
            page_number: flyerPage,
            product_id: result.product_id,
            price_in_flyer: price,
            bbox: bbox
              ? { y_min: bbox[0], x_min: bbox[1], y_max: bbox[2], x_max: bbox[3] }
              : null,
          }, { onConflict: "flyer_id,page_number,product_id" });
        }
      }
    }
  }

  return { productsCreated, productsUpdated, pendingThumbnailOverwrites };
}
