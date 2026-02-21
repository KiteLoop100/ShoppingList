/**
 * Manuelles Produkt anlegen (Capture-Seite „Produkt anlegen“).
 * Duplikat-Check: EAN → article_number → name_normalized.
 * Thumbnail: von thumbnail_url mit Sharp 150x150 in product-thumbnails.
 * Verknüpft data_upload_ids und extra Fotos (photo_uploads.product_id).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface CreateManualBody {
  name: string;
  brand?: string | null;
  price?: number | null;
  ean_barcode?: string | null;
  article_number?: string | null;
  weight_or_quantity?: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
  nutrition_info?: Record<string, unknown> | null;
  thumbnail_url?: string | null;
  extra_photo_urls?: string[];
  data_upload_ids?: string[];
  user_id?: string;
  update_existing_product_id?: string | null;
}

export async function POST(request: Request) {
  let body: CreateManualBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const nameNormalized = normalizeName(name);
  const ean = body.ean_barcode != null ? String(body.ean_barcode).trim() || null : null;
  const articleNumber =
    body.article_number != null ? String(body.article_number).trim() || null : null;
  const brand = body.brand != null ? String(body.brand).trim() || null : null;
  const price =
    body.price != null && body.price !== "" ? Number(body.price) : null;
  const weightOrQuantity =
    body.weight_or_quantity != null ? String(body.weight_or_quantity).trim() || null : null;
  const demandGroup =
    body.demand_group != null ? String(body.demand_group).trim() || null : null;
  const demandSubGroup =
    body.demand_sub_group != null ? String(body.demand_sub_group).trim() || null : null;
  const ingredients = body.ingredients != null ? String(body.ingredients).trim() || null : null;
  const allergens = body.allergens != null ? String(body.allergens).trim() || null : null;
  const nutritionInfo = body.nutrition_info ?? null;
  const thumbnailUrl = body.thumbnail_url != null ? String(body.thumbnail_url).trim() || null : null;
  const extraPhotoUrls = Array.isArray(body.extra_photo_urls) ? body.extra_photo_urls : [];
  const dataUploadIds = Array.isArray(body.data_upload_ids) ? body.data_upload_ids : [];
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const updateExistingProductId = body.update_existing_product_id ?? null;

  const { data: categories } = await supabase.from("categories").select("category_id").limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;
  if (!defaultCategoryId) {
    return NextResponse.json({ error: "Keine Kategorie konfiguriert" }, { status: 500 });
  }

  let productId: string | null = updateExistingProductId || null;

  if (!productId) {
    if (articleNumber) {
      const { data: byArticle } = await supabase
        .from("products")
        .select("product_id")
        .eq("article_number", articleNumber)
        .eq("status", "active")
        .maybeSingle();
      if (byArticle) productId = byArticle.product_id;
    }
    if (!productId && ean) {
      const { data: byEan } = await supabase
        .from("products")
        .select("product_id")
        .eq("ean_barcode", ean)
        .eq("status", "active")
        .maybeSingle();
      if (byEan) productId = byEan.product_id;
    }
    if (!productId && nameNormalized) {
      const { data: byName } = await supabase
        .from("products")
        .select("product_id")
        .eq("name_normalized", nameNormalized)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (byName) productId = byName.product_id;
    }

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
    };
    if (thumbnailUrl) {
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
        console.warn("[create-manual] Thumbnail resize/upload failed:", e);
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
        console.warn("[create-manual] Thumbnail resize/upload failed:", e);
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("products")
      .insert({
        name,
        name_normalized: nameNormalized,
        category_id: defaultCategoryId,
        article_number: articleNumber,
        brand,
        price,
        price_updated_at: price != null ? now : null,
        assortment_type: "daily_range",
        availability: "national",
        status: "active",
        source: "crowdsourcing",
        crowdsource_status: "pending",
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
        thumbnail_url: finalThumbnailUrl,
        thumbnail_back_url: null,
        photo_source_id: null,
        created_at: now,
        updated_at: now,
      })
      .select("product_id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
    }
    productId = inserted.product_id;

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
