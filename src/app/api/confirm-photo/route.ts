/**
 * Confirm a pending_review photo: write/update product from edited data, set photo_uploads.status = confirmed.
 * Duplicate check: EAN → article_number → name_normalized. Thumbnails from extracted_data.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ConfirmProductBody {
  name?: string | null;
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
}

export async function POST(request: Request) {
  let body: {
    upload_id?: string;
    product?: ConfirmProductBody;
    linked_product_id?: string;
    action?: "confirm" | "discard";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { upload_id, product: productBody, linked_product_id, action = "confirm" } = body;
  if (!upload_id) {
    return NextResponse.json({ error: "upload_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

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
    }>;
  };
  const photoType = extracted.photo_type ?? "product_front";
  const thumbnailUrl = extracted.thumbnail_url ?? null;
  const thumbnailBackUrl = extracted.thumbnail_back_url ?? null;
  const firstExtracted = extracted.products?.[0];
  const name =
    (productBody?.name != null ? String(productBody.name).trim() : firstExtracted?.name?.trim()) || "";
  const brand =
    productBody?.brand !== undefined
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
  const articleNumber =
    productBody?.article_number !== undefined
      ? (String(productBody.article_number).trim() || null)
      : (firstExtracted?.article_number != null ? String(firstExtracted.article_number).trim() || null : null);
  const weightOrQuantity =
    productBody?.weight_or_quantity !== undefined
      ? (String(productBody.weight_or_quantity).trim() || null)
      : (firstExtracted?.weight_or_quantity?.trim() || null);
  const demandGroup =
    productBody?.demand_group !== undefined
      ? (String(productBody.demand_group).trim() || null)
      : (firstExtracted?.demand_group?.trim() || null);
  const demandSubGroup =
    productBody?.demand_sub_group !== undefined
      ? (String(productBody.demand_sub_group).trim() || null)
      : (firstExtracted?.demand_sub_group?.trim() || null);
  const nutritionInfo = productBody?.nutrition_info ?? firstExtracted?.nutrition_info ?? null;
  const ingredients =
    productBody?.ingredients !== undefined
      ? (String(productBody.ingredients).trim() || null)
      : (firstExtracted?.ingredients?.trim() || null);
  const allergens =
    productBody?.allergens !== undefined
      ? (String(productBody.allergens).trim() || null)
      : (firstExtracted?.allergens?.trim() || null);

  if (!name && !linked_product_id) {
    return NextResponse.json({ error: "Product name required or link to existing product" }, { status: 400 });
  }

  const { data: categories } = await supabase.from("categories").select("category_id").limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;
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
        .ilike("name_normalized", nameNormalized)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (byName) productId = byName.product_id;
    }
  }

  if (productId) {
    const { data: current } = await supabase
      .from("products")
      .select("*")
      .eq("product_id", productId)
      .single();

    const updates: Record<string, unknown> = {
      updated_at: now,
    };
    if (price != null) {
      updates.price = price;
      updates.price_updated_at = now;
    }
    if (current) {
      if (name && (current.name_normalized == null || current.name_normalized === ""))
        updates.name_normalized = nameNormalized;
      if (name && (current.name == null || current.name === "")) updates.name = name;
      if (articleNumber) updates.article_number = articleNumber;
      if (current.brand == null && brand) updates.brand = brand;
      if (current.nutrition_info == null && nutritionInfo) updates.nutrition_info = nutritionInfo;
      if (current.ingredients == null && ingredients) updates.ingredients = ingredients;
      if (current.allergens == null && allergens) updates.allergens = allergens;
      if (current.ean_barcode == null && ean) updates.ean_barcode = ean;
      if (current.demand_group == null && demandGroup) updates.demand_group = demandGroup;
      if (current.demand_sub_group == null && demandSubGroup) updates.demand_sub_group = demandSubGroup;
      if (current.weight_or_quantity == null && weightOrQuantity) updates.weight_or_quantity = weightOrQuantity;
    }
    if (photoType === "product_front" && thumbnailUrl) {
      updates.thumbnail_url = thumbnailUrl;
      updates.photo_source_id = upload_id;
    }
    if (photoType === "product_back" && thumbnailBackUrl) {
      updates.thumbnail_back_url = thumbnailBackUrl;
    }

    const { error: updErr } = await supabase
      .from("products")
      .update(updates)
      .eq("product_id", productId);
    if (!updErr) productsUpdated = 1;
  } else if (defaultCategoryId && name) {
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
        thumbnail_url: photoType === "product_front" && thumbnailUrl ? thumbnailUrl : null,
        thumbnail_back_url: photoType === "product_back" && thumbnailBackUrl ? thumbnailBackUrl : null,
        photo_source_id: photoType === "product_front" && thumbnailUrl ? upload_id : null,
        created_at: now,
        updated_at: now,
      })
      .select("product_id")
      .single();
    if (!insErr && inserted) {
      productId = inserted.product_id;
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
