/**
 * Manuelles Produkt anlegen (Capture-Seite "Produkt anlegen").
 * Duplikat-Check: EAN -> article_number -> name_normalized.
 * Thumbnail: pipeline-processed base64 or external URL -> product-thumbnails bucket.
 * Verknuepft data_upload_ids und extra Fotos (photo_uploads.product_id).
 */

import { NextResponse } from "next/server";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import sharp from "sharp";
import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

import { validateExternalUrl } from "@/lib/api/validate-url";
import { validateBody } from "@/lib/api/validate-request";
import { createManualSchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { normalizeName } from "@/lib/products/normalize";
import { findExistingProduct } from "@/lib/products/find-existing";
import { upsertProduct } from "@/lib/products/upsert-product";
import { getDefaultDemandGroupCode } from "@/lib/products/default-category";

const THUMB_SIZE = 150;
const JPEG_QUALITY = 85;

async function insertProductPhoto(
  supabase: SupabaseClient,
  productId: string,
  photoUrl: string,
  bucket: string,
  storagePath: string,
  category: "thumbnail" | "product" | "price_tag",
  sortOrder = 0,
): Promise<void> {
  const { error } = await supabase.from("product_photos").insert({
    product_id: productId,
    photo_url: photoUrl,
    storage_bucket: bucket,
    storage_path: storagePath,
    category,
    sort_order: sortOrder,
  });
  if (error) {
    log.warn("[create-manual] product_photos insert failed:", error.message);
  }
}

function extractStoragePath(url: string, bucket: string): string {
  const marker = `/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.substring(idx + marker.length);
  return url.split("/").pop() ?? "";
}

/**
 * Process a thumbnail from base64 (pipeline-processed) or external URL,
 * upload to Supabase Storage, and return the public URL.
 */
async function processThumbnail(
  supabase: SupabaseClient,
  thumbnailBase64: string | null,
  thumbnailUrl: string | null,
  storagePath: string,
): Promise<string | null> {
  let rawBuf: Buffer;
  if (thumbnailBase64) {
    rawBuf = Buffer.from(thumbnailBase64, "base64");
  } else if (thumbnailUrl) {
    const imgRes = await fetch(thumbnailUrl);
    if (!imgRes.ok) throw new Error(`Fetch: ${imgRes.status}`);
    rawBuf = Buffer.from(await imgRes.arrayBuffer());
  } else {
    return null;
  }

  const resized = await sharp(rawBuf)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const { error: upErr } = await supabase.storage
    .from("product-thumbnails")
    .upload(storagePath, resized, { contentType: "image/jpeg", upsert: true });

  if (upErr) {
    log.warn("[create-manual] thumbnail upload failed:", upErr.message);
    return null;
  }

  const { data: urlData } = supabase.storage.from("product-thumbnails").getPublicUrl(storagePath);
  return urlData.publicUrl;
}

export async function POST(request: Request) {
  const validated = await validateBody(request, createManualSchema);
  if (validated instanceof NextResponse) return validated;

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(generalRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const name = validated.name.trim();
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const now = new Date().toISOString();
  const nameNormalized = normalizeName(name);
  const ean = validated.ean_barcode != null ? String(validated.ean_barcode).trim() || null : null;
  const articleNumber =
    validated.article_number != null ? String(validated.article_number).trim() || null : null;
  const brand = validated.brand != null ? String(validated.brand).trim() || null : null;
  const price = validated.price ?? null;
  const weightOrQuantity =
    validated.weight_or_quantity != null ? String(validated.weight_or_quantity).trim() || null : null;
  const demandSubGroup =
    validated.demand_sub_group != null ? String(validated.demand_sub_group).trim() || null : null;
  const ingredients = validated.ingredients != null ? String(validated.ingredients).trim() || null : null;
  const allergens = validated.allergens != null ? String(validated.allergens).trim() || null : null;
  const nutritionInfo = validated.nutrition_info ?? null;
  const assortmentType = validated.assortment_type ?? "daily_range";
  const isPrivateLabel = validated.is_private_label ?? null;
  const isSeasonal = validated.is_seasonal === true;
  const isBio = validated.is_bio ?? null;
  const isVegan = validated.is_vegan ?? null;
  const isGlutenFree = validated.is_gluten_free ?? null;
  const isLactoseFree = validated.is_lactose_free ?? null;
  const animalWelfareLevel = validated.animal_welfare_level ?? null;
  const thumbnailUrl = validated.thumbnail_url ?? null;
  const thumbnailBase64 = validated.thumbnail_base64 ?? null;
  const extraPhotoUrls = validated.extra_photo_urls;
  const dataUploadIds = validated.data_upload_ids;
  const userId = auth.user.id;
  let updateExistingProductId = validated.update_existing_product_id ?? null;

  if (thumbnailUrl) {
    try {
      validateExternalUrl(thumbnailUrl);
    } catch (e) {
      return NextResponse.json(
        { error: `Invalid thumbnail URL: ${e instanceof Error ? e.message : String(e)}` },
        { status: 400 },
      );
    }
  }

  const defaultDemandGroupCode = getDefaultDemandGroupCode();
  if (!defaultDemandGroupCode) {
    return NextResponse.json({ error: "Keine Warengruppe konfiguriert" }, { status: 500 });
  }

  let productId: string | null = updateExistingProductId || null;

  if (!productId) {
    const found = await findExistingProduct(supabase, {
      article_number: articleNumber,
      ean_barcode: ean,
      name_normalized: nameNormalized,
    });
    if (found) productId = found.product_id;

    if (productId && !updateExistingProductId) {
      if (!thumbnailBase64 && !thumbnailUrl) {
        return NextResponse.json({
          duplicate: true,
          product_id: productId,
          existing_product_id: productId,
          message: "Ein Produkt mit gleicher EAN, Artikelnummer oder Name existiert bereits.",
        });
      }
      updateExistingProductId = productId;
    }
  }

  if (productId && updateExistingProductId) {
    const updates: Record<string, unknown> = {
      updated_at: now,
      name: name || undefined,
      name_normalized: nameNormalized || undefined,
      brand: brand ?? undefined,
      price: price ?? undefined,
      price_updated_at: price != null ? now : undefined,
      article_number: articleNumber ?? undefined,
      ean_barcode: ean ?? undefined,
      weight_or_quantity: weightOrQuantity ?? undefined,
      demand_sub_group: demandSubGroup ?? undefined,
      ingredients: ingredients ?? undefined,
      allergens: allergens ?? undefined,
      nutrition_info: nutritionInfo ?? undefined,
      assortment_type: assortmentType,
      is_private_label: isPrivateLabel,
      is_seasonal: isSeasonal,
      is_bio: isBio,
      is_vegan: isVegan,
      is_gluten_free: isGlutenFree,
      is_lactose_free: isLactoseFree,
      animal_welfare_level: animalWelfareLevel,
    };

    if (thumbnailUrl || thumbnailBase64) {
      try {
        const thumbStoragePath = `manual/${productId}.jpg`;
        const publicUrl = await processThumbnail(supabase, thumbnailBase64, thumbnailUrl, thumbStoragePath);
        if (publicUrl) {
          updates.thumbnail_url = publicUrl;
          await insertProductPhoto(supabase, productId, publicUrl, "product-thumbnails", thumbStoragePath, "thumbnail");
        }
      } catch (e) {
        log.warn("[create-manual] Thumbnail resize/upload failed:", e);
      }
    }

    const { error: updErr } = await supabase
      .from("products")
      .update(updates)
      .eq("product_id", productId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else if (!productId) {
    let finalThumbnailUrl: string | null = null;
    let thumbStoragePath: string | null = null;
    if (thumbnailUrl || thumbnailBase64) {
      try {
        const tempId = crypto.randomUUID();
        thumbStoragePath = `manual/${tempId}.jpg`;
        finalThumbnailUrl = await processThumbnail(supabase, thumbnailBase64, thumbnailUrl, thumbStoragePath);
      } catch (e) {
        log.warn("[create-manual] Thumbnail resize/upload failed:", e);
      }
    }

    const result = await upsertProduct(supabase, {
      name,
      name_normalized: nameNormalized,
      demand_group_code: defaultDemandGroupCode,
      article_number: articleNumber,
      brand,
      price,
      price_updated_at: price != null ? now : null,
      assortment_type: assortmentType,
      source: "crowdsourcing",
      ean_barcode: ean,
      nutrition_info: nutritionInfo,
      ingredients,
      allergens,
      demand_sub_group: demandSubGroup,
      weight_or_quantity: weightOrQuantity,
      special_start_date: null,
      special_end_date: null,
      country: "DE",
      is_private_label: isPrivateLabel,
      is_seasonal: isSeasonal,
      thumbnail_url: finalThumbnailUrl,
      thumbnail_back_url: null,
      photo_source_id: null,
    });

    if (!result) {
      log.error("[create-manual] upsertProduct returned null for:", nameNormalized);
      return NextResponse.json({ error: "Produkt konnte nicht gespeichert werden. Bitte erneut versuchen." }, { status: 500 });
    }
    productId = result.product_id;

    if (thumbnailUrl && !finalThumbnailUrl) {
      await supabase
        .from("products")
        .update({ thumbnail_url: thumbnailUrl, updated_at: now })
        .eq("product_id", productId);
    }

    if (finalThumbnailUrl && thumbStoragePath) {
      await insertProductPhoto(supabase, productId, finalThumbnailUrl, "product-thumbnails", thumbStoragePath, "thumbnail");
    }
  }

  if (productId && dataUploadIds.length > 0) {
    await supabase
      .from("photo_uploads")
      .update({ product_id: productId })
      .in("upload_id", dataUploadIds);
  }

  if (productId && userId && extraPhotoUrls.length > 0) {
    for (let i = 0; i < extraPhotoUrls.length; i++) {
      const url = extraPhotoUrls[i];
      await supabase.from("photo_uploads").insert({
        user_id: userId,
        photo_url: url,
        photo_type: "product_extra",
        status: "completed",
        product_id: productId,
        products_created: 0,
        products_updated: 0,
        created_at: now,
      });
      await insertProductPhoto(supabase, productId, url, "product-thumbnails", extractStoragePath(url, "product-thumbnails"), "product", i + 1);
    }
  }

  return NextResponse.json({
    ok: true,
    product_id: productId,
    updated: !!updateExistingProductId,
  });
}
