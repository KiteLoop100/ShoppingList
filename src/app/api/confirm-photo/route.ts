/**
 * Confirm a pending_review photo: write/update product from edited data, set photo_uploads.status = confirmed.
 * Duplicate check: EAN → article_number → name_normalized. Thumbnails from extracted_data.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { confirmPhotoSchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";

import { normalizeName } from "@/lib/products/normalize";
import { findExistingProduct } from "@/lib/products/find-existing";
import { upsertProduct } from "@/lib/products/upsert-product";
import { getDefaultCategoryId } from "@/lib/products/default-category";

export async function POST(request: Request) {
  const validated = await validateBody(request, confirmPhotoSchema);
  if (validated instanceof NextResponse) return validated;
  const { upload_id, product: productBody, linked_product_id, action } = validated;

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(generalRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const now = new Date().toISOString();

  const { data: row, error: fetchErr } = await supabase
    .from("photo_uploads")
    .select("upload_id, status, extracted_data, photo_url")
    .eq("upload_id", upload_id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }
  if (row.status !== "pending_review") {
    return NextResponse.json({ error: "Upload is not pending review" }, { status: 400 });
  }

  if (action === "discard") {
    const { error: discardErr } = await supabase
      .from("photo_uploads")
      .update({ status: "discarded", processed_at: now })
      .eq("upload_id", upload_id);
    if (discardErr) {
      return NextResponse.json({ error: "Failed to discard" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, upload_id, status: "discarded" });
  }

  const extracted = (row.extracted_data ?? {}) as {
    photo_type?: string;
    thumbnail_url?: string | null;
    thumbnail_back_url?: string | null;
    products?: Array<{
      name?: string;
      brand?: string | null;
      price?: number | null;
      ean_barcode?: string | null;
      article_number?: string | null;
      weight_or_quantity?: string | null;
      demand_group?: string | null;
      demand_sub_group?: string | null;
      nutrition_info?: Record<string, unknown> | null;
      ingredients?: string | null;
      allergens?: string | null;
      is_private_label?: boolean | null;
      is_seasonal?: boolean | null;
    }>;
  };
  const photoType = extracted.photo_type ?? "product_front";
  const isBackPhoto = photoType === "product_back";
  const thumbnailUrl = extracted.thumbnail_url ?? null;
  const thumbnailBackUrl = extracted.thumbnail_back_url ?? null;
  const firstExtracted = extracted.products?.[0];

  // For back photos: name and brand are intentionally NOT used — back packaging text is unreliable.
  const name = isBackPhoto
    ? ""
    : (productBody?.name != null ? String(productBody.name).trim() : firstExtracted?.name?.trim()) || "";
  const brand = isBackPhoto
    ? null
    : productBody?.brand !== undefined
      ? (String(productBody.brand).trim() || null)
      : (firstExtracted?.brand?.trim() || null);

  const price =
    productBody?.price !== undefined && productBody?.price != null
      ? Number(productBody.price)
      : (typeof firstExtracted?.price === "number" ? firstExtracted.price : null);
  const ean =
    productBody?.ean_barcode !== undefined
      ? (String(productBody.ean_barcode).trim() || null)
      : (firstExtracted?.ean_barcode?.trim() || null);
  const articleNumber = isBackPhoto
    ? null
    : productBody?.article_number !== undefined
      ? (String(productBody.article_number).trim() || null)
      : (firstExtracted?.article_number != null ? String(firstExtracted.article_number).trim() || null : null);
  const weightOrQuantity = isBackPhoto
    ? null
    : productBody?.weight_or_quantity !== undefined
      ? (String(productBody.weight_or_quantity).trim() || null)
      : (firstExtracted?.weight_or_quantity?.trim() || null);
  const demandGroup = isBackPhoto
    ? null
    : productBody?.demand_group !== undefined
      ? (String(productBody.demand_group).trim() || null)
      : (firstExtracted?.demand_group?.trim() || null);
  const demandSubGroup = isBackPhoto
    ? null
    : productBody?.demand_sub_group !== undefined
      ? (String(productBody.demand_sub_group).trim() || null)
      : (firstExtracted?.demand_sub_group?.trim() || null);
  const nutritionInfo = isBackPhoto
    ? (productBody?.nutrition_info ?? firstExtracted?.nutrition_info ?? null)
    : (productBody?.nutrition_info ?? firstExtracted?.nutrition_info ?? null);
  const ingredients = isBackPhoto
    ? null
    : productBody?.ingredients !== undefined
      ? (String(productBody.ingredients).trim() || null)
      : (firstExtracted?.ingredients?.trim() || null);
  const allergens = isBackPhoto
    ? null
    : productBody?.allergens !== undefined
      ? (String(productBody.allergens).trim() || null)
      : (firstExtracted?.allergens?.trim() || null);
  const isPrivateLabel = firstExtracted?.is_private_label ?? null;
  const isSeasonal = firstExtracted?.is_seasonal === true;

  // Back photos must be linked to an existing product (they only add EAN + back thumbnail)
  if (!name && !linked_product_id) {
    return NextResponse.json({ error: "Product name required or link to existing product" }, { status: 400 });
  }

  const defaultCategoryId = await getDefaultCategoryId(supabase);
  const nameNormalized = normalizeName(name || "Unbekannt");

  let productId: string | null = null;
  let productsCreated = 0;
  let productsUpdated = 0;

  if (linked_product_id) {
    const { data: existing, error: getErr } = await supabase
      .from("products")
      .select("product_id")
      .eq("product_id", linked_product_id)
      .eq("status", "active")
      .single();
    if (getErr || !existing) {
      return NextResponse.json({ error: "Linked product not found" }, { status: 400 });
    }
    productId = existing.product_id;
  }

  if (!productId) {
    const found = await findExistingProduct(supabase, {
      article_number: articleNumber,
      ean_barcode: ean,
      name_normalized: nameNormalized,
    });
    if (found) productId = found.product_id;
  }

  if (productId) {
    const result = await upsertProduct(supabase, {
      name,
      name_normalized: nameNormalized,
      article_number: articleNumber,
      brand,
      price,
      ...(price != null ? { price_updated_at: now } : {}),
      nutrition_info: nutritionInfo,
      ingredients,
      allergens,
      ean_barcode: ean,
      demand_group: demandGroup,
      demand_sub_group: demandSubGroup,
      weight_or_quantity: weightOrQuantity,
      ...(isPrivateLabel != null ? { is_private_label: isPrivateLabel } : {}),
      ...(isSeasonal ? { is_seasonal: true } : {}),
      ...(photoType === "product_front" && thumbnailUrl ? { thumbnail_url: thumbnailUrl, photo_source_id: upload_id } : {}),
      ...(photoType === "product_back" && thumbnailBackUrl ? { thumbnail_back_url: thumbnailBackUrl } : {}),
    }, productId);
    if (result) productsUpdated = 1;
  } else if (defaultCategoryId && name) {
    const result = await upsertProduct(supabase, {
      name,
      name_normalized: nameNormalized,
      category_id: defaultCategoryId,
      article_number: articleNumber,
      brand,
      price,
      price_updated_at: price != null ? now : null,
      assortment_type: "daily_range",
      source: "crowdsourcing",
      ean_barcode: ean,
      nutrition_info: nutritionInfo,
      ingredients,
      allergens,
      demand_group: demandGroup,
      demand_sub_group: demandSubGroup,
      weight_or_quantity: weightOrQuantity,
      special_start_date: null,
      special_end_date: null,
      country: "DE",
      is_private_label: isPrivateLabel,
      is_seasonal: isSeasonal,
      thumbnail_url: photoType === "product_front" && thumbnailUrl ? thumbnailUrl : null,
      thumbnail_back_url: photoType === "product_back" && thumbnailBackUrl ? thumbnailBackUrl : null,
      photo_source_id: photoType === "product_front" && thumbnailUrl ? upload_id : null,
    });
    if (result) {
      productId = result.product_id;
      productsCreated = 1;
    }
  }

  const { error: finalErr } = await supabase
    .from("photo_uploads")
    .update({
      status: "confirmed",
      products_created: productsCreated,
      products_updated: productsUpdated,
      processed_at: now,
      error_message: null,
    })
    .eq("upload_id", upload_id);

  if (finalErr) {
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    upload_id,
    product_id: productId,
    products_created: productsCreated,
    products_updated: productsUpdated,
  });
}
