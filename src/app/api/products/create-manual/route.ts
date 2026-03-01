/**
 * Manuelles Produkt anlegen (Capture-Seite „Produkt anlegen“).
 * Duplikat-Check: EAN → article_number → name_normalized.
 * Thumbnail: von thumbnail_url mit Sharp 150x150 in product-thumbnails.
 * Verknüpft data_upload_ids und extra Fotos (photo_uploads.product_id).
 */

import { NextResponse } from "next/server";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import sharp from "sharp";
import { log } from "@/lib/utils/logger";

import { validateExternalUrl } from "@/lib/api/validate-url";
import { validateBody } from "@/lib/api/validate-request";
import { createManualSchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { normalizeName } from "@/lib/products/normalize";
import { findExistingProduct } from "@/lib/products/find-existing";
import { upsertProduct } from "@/lib/products/upsert-product";
import { getDefaultCategoryId } from "@/lib/products/default-category";

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
  const demandGroup =
    validated.demand_group != null ? String(validated.demand_group).trim() || null : null;
  const demandSubGroup =
    validated.demand_sub_group != null ? String(validated.demand_sub_group).trim() || null : null;
  const ingredients = validated.ingredients != null ? String(validated.ingredients).trim() || null : null;
  const allergens = validated.allergens != null ? String(validated.allergens).trim() || null : null;
  const nutritionInfo = validated.nutrition_info ?? null;
  const assortmentType = validated.assortment_type ?? "daily_range";
  const isPrivateLabel = validated.is_private_label ?? null;
  const isSeasonal = validated.is_seasonal === true;
  const thumbnailUrl = validated.thumbnail_url ?? null;
  const extraPhotoUrls = validated.extra_photo_urls;
  const dataUploadIds = validated.data_upload_ids;
  const userId = auth.user.id;
  const updateExistingProductId = validated.update_existing_product_id ?? null;

  const defaultCategoryId = await getDefaultCategoryId(supabase);
  if (!defaultCategoryId) {
    return NextResponse.json({ error: "Keine Kategorie konfiguriert" }, { status: 500 });
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
      return NextResponse.json({
        duplicate: true,
        existing_product_id: productId,
        message: "Ein Produkt mit gleicher EAN, Artikelnummer oder Name existiert bereits.",
      });
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
      demand_group: demandGroup ?? undefined,
      demand_sub_group: demandSubGroup ?? undefined,
      ingredients: ingredients ?? undefined,
      allergens: allergens ?? undefined,
      nutrition_info: nutritionInfo ?? undefined,
      assortment_type: assortmentType,
      is_private_label: isPrivateLabel,
      is_seasonal: isSeasonal,
    };
    if (thumbnailUrl) {
      try {
        validateExternalUrl(thumbnailUrl);
      } catch (e) {
        return NextResponse.json(
          { error: `Invalid thumbnail URL: ${e instanceof Error ? e.message : String(e)}` },
          { status: 400 },
        );
      }
      try {
        const imgRes = await fetch(thumbnailUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const resized = await sharp(Buffer.from(buf))
            .rotate()
            .resize(150, 150, { fit: "cover", position: "center" })
            .jpeg({ quality: 85 })
            .toBuffer();
          const path = `manual/${productId}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("product-thumbnails")
            .upload(path, resized, { contentType: "image/jpeg", upsert: true });
          if (!upErr) {
            const { data: urlData } = supabase.storage.from("product-thumbnails").getPublicUrl(path);
            updates.thumbnail_url = urlData.publicUrl;
          }
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
    if (thumbnailUrl) {
      try {
        validateExternalUrl(thumbnailUrl);
      } catch (e) {
        return NextResponse.json(
          { error: `Invalid thumbnail URL: ${e instanceof Error ? e.message : String(e)}` },
          { status: 400 },
        );
      }
      try {
        const imgRes = await fetch(thumbnailUrl);
        if (!imgRes.ok) throw new Error(`Fetch: ${imgRes.status}`);
        const buf = await imgRes.arrayBuffer();
        const resized = await sharp(Buffer.from(buf))
          .rotate()
          .resize(150, 150, { fit: "cover", position: "center" })
          .jpeg({ quality: 85 })
          .toBuffer();
        const tempId = crypto.randomUUID();
        const path = `manual/${tempId}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("product-thumbnails")
          .upload(path, resized, { contentType: "image/jpeg", upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("product-thumbnails").getPublicUrl(path);
          finalThumbnailUrl = urlData.publicUrl;
        }
      } catch (e) {
        log.warn("[create-manual] Thumbnail resize/upload failed:", e);
      }
    }

    const result = await upsertProduct(supabase, {
      name,
      name_normalized: nameNormalized,
      category_id: defaultCategoryId,
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
      demand_group: demandGroup,
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
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
    productId = result.product_id;

    if (thumbnailUrl && !finalThumbnailUrl) {
      await supabase
        .from("products")
        .update({ thumbnail_url: thumbnailUrl, updated_at: now })
        .eq("product_id", productId);
    }
  }

  if (productId && dataUploadIds.length > 0) {
    await supabase
      .from("photo_uploads")
      .update({ product_id: productId })
      .in("upload_id", dataUploadIds);
  }

  if (productId && userId && extraPhotoUrls.length > 0) {
    for (const url of extraPhotoUrls) {
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
    }
  }

  return NextResponse.json({
    ok: true,
    product_id: productId,
    updated: !!updateExistingProductId,
  });
}
