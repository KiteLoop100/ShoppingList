/**
 * B4: CRUD operations for competitor products and their prices.
 * Completely separate from the ALDI products table.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { normalizeName } from "@/lib/products/normalize";
import { eanVariants } from "@/lib/products/ean-utils";
import { log } from "@/lib/utils/logger";
import type { CompetitorProduct, CompetitorProductPrice } from "@/types";

function rowToCompetitorProduct(row: Record<string, unknown>): CompetitorProduct {
  return {
    product_id: String(row.product_id),
    name: String(row.name),
    name_normalized: String(row.name_normalized),
    brand: row.brand != null ? String(row.brand) : null,
    ean_barcode: row.ean_barcode != null ? String(row.ean_barcode) : null,
    article_number: row.article_number != null ? String(row.article_number) : null,
    weight_or_quantity: row.weight_or_quantity != null ? String(row.weight_or_quantity) : null,
    country: row.country != null ? String(row.country) : "DE",
    thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
    other_photo_url: row.other_photo_url != null ? String(row.other_photo_url) : null,
    category_id: row.category_id != null ? String(row.category_id) : null,
    status: (row.status as CompetitorProduct["status"]) ?? "active",
    is_bio: row.is_bio === true,
    is_vegan: row.is_vegan === true,
    is_gluten_free: row.is_gluten_free === true,
    is_lactose_free: row.is_lactose_free === true,
    animal_welfare_level: row.animal_welfare_level != null ? Number(row.animal_welfare_level) : null,
    ingredients: row.ingredients != null ? String(row.ingredients) : null,
    nutrition_info: (row.nutrition_info as Record<string, unknown>) ?? null,
    allergens: row.allergens != null ? String(row.allergens) : null,
    nutri_score: (row.nutri_score as CompetitorProduct["nutri_score"]) ?? null,
    country_of_origin: row.country_of_origin != null ? String(row.country_of_origin) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function rowToPrice(row: Record<string, unknown>): CompetitorProductPrice {
  return {
    price_id: String(row.price_id),
    product_id: String(row.product_id),
    retailer: String(row.retailer),
    price: Number(row.price),
    observed_at: String(row.observed_at),
  };
}

export interface CreateCompetitorProductParams {
  name: string;
  brand?: string | null;
  ean_barcode?: string | null;
  article_number?: string | null;
  weight_or_quantity?: string | null;
  country: string;
  thumbnail_url?: string | null;
  other_photo_url?: string | null;
  category_id?: string | null;
  is_bio?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_lactose_free?: boolean;
  animal_welfare_level?: number | null;
}

export async function createCompetitorProduct(
  params: CreateCompetitorProductParams
): Promise<CompetitorProduct> {
  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("competitor_products")
    .insert({
      name: params.name,
      name_normalized: normalizeName(params.name),
      brand: params.brand ?? null,
      ean_barcode: params.ean_barcode ?? null,
      article_number: params.article_number ?? null,
      weight_or_quantity: params.weight_or_quantity ?? null,
      country: params.country,
      thumbnail_url: params.thumbnail_url ?? null,
      other_photo_url: params.other_photo_url ?? null,
      category_id: params.category_id ?? null,
      is_bio: params.is_bio ?? false,
      is_vegan: params.is_vegan ?? false,
      is_gluten_free: params.is_gluten_free ?? false,
      is_lactose_free: params.is_lactose_free ?? false,
      animal_welfare_level: params.animal_welfare_level ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToCompetitorProduct(data as Record<string, unknown>);
}

type UpdatableFields =
  | "name" | "brand" | "ean_barcode" | "article_number" | "weight_or_quantity"
  | "thumbnail_url" | "other_photo_url" | "category_id"
  | "is_bio" | "is_vegan" | "is_gluten_free" | "is_lactose_free" | "animal_welfare_level"
  | "ingredients" | "nutrition_info" | "allergens" | "nutri_score" | "country_of_origin";

export async function updateCompetitorProduct(
  productId: string,
  updates: Partial<Pick<CompetitorProduct, UpdatableFields>>
): Promise<void> {
  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) {
    payload.name = updates.name;
    payload.name_normalized = normalizeName(updates.name);
  }
  if (updates.brand !== undefined) payload.brand = updates.brand;
  if (updates.ean_barcode !== undefined) payload.ean_barcode = updates.ean_barcode;
  if (updates.article_number !== undefined) payload.article_number = updates.article_number;
  if (updates.weight_or_quantity !== undefined) payload.weight_or_quantity = updates.weight_or_quantity;
  if (updates.thumbnail_url !== undefined) payload.thumbnail_url = updates.thumbnail_url;
  if (updates.other_photo_url !== undefined) payload.other_photo_url = updates.other_photo_url;
  if (updates.category_id !== undefined) payload.category_id = updates.category_id;
  if (updates.is_bio !== undefined) payload.is_bio = updates.is_bio;
  if (updates.is_vegan !== undefined) payload.is_vegan = updates.is_vegan;
  if (updates.is_gluten_free !== undefined) payload.is_gluten_free = updates.is_gluten_free;
  if (updates.is_lactose_free !== undefined) payload.is_lactose_free = updates.is_lactose_free;
  if (updates.animal_welfare_level !== undefined) payload.animal_welfare_level = updates.animal_welfare_level;
  if (updates.ingredients !== undefined) payload.ingredients = updates.ingredients;
  if (updates.nutrition_info !== undefined) payload.nutrition_info = updates.nutrition_info;
  if (updates.allergens !== undefined) payload.allergens = updates.allergens;
  if (updates.nutri_score !== undefined) payload.nutri_score = updates.nutri_score;
  if (updates.country_of_origin !== undefined) payload.country_of_origin = updates.country_of_origin;

  const { error } = await supabase
    .from("competitor_products")
    .update(payload)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
}

export async function findCompetitorProductByEan(
  ean: string,
  localProducts?: CompetitorProduct[]
): Promise<CompetitorProduct | null> {
  const variants = eanVariants(ean);
  if (variants.length === 0) return null;

  if (localProducts) {
    for (const p of localProducts) {
      if (!p.ean_barcode) continue;
      const pVariants = eanVariants(p.ean_barcode);
      if (variants.some((v) => pVariants.includes(v))) return p;
    }
  }

  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  for (const v of variants) {
    const { data } = await supabase
      .from("competitor_products")
      .select("*")
      .eq("ean_barcode", v)
      .eq("status", "active")
      .maybeSingle();

    if (data) return rowToCompetitorProduct(data as Record<string, unknown>);
  }
  return null;
}

export async function findCompetitorProductById(
  productId: string
): Promise<CompetitorProduct | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("competitor_products")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();

  if (!data) return null;
  return rowToCompetitorProduct(data as Record<string, unknown>);
}

/** Find or create a competitor product by name (for lightweight capture). */
export async function findOrCreateCompetitorProduct(
  name: string,
  country: string,
  ean?: string | null,
): Promise<CompetitorProduct> {
  if (ean) {
    const byEan = await findCompetitorProductByEan(ean);
    if (byEan) return byEan;
  }

  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const normalized = normalizeName(name);
  const { data: existing } = await supabase
    .from("competitor_products")
    .select("*")
    .eq("name_normalized", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    const product = rowToCompetitorProduct(existing as Record<string, unknown>);
    if (product.name !== name && name !== normalized) {
      await updateCompetitorProduct(product.product_id, { name });
      product.name = name;
    }
    return product;
  }

  return createCompetitorProduct({ name, country });
}

export async function addCompetitorPrice(
  productId: string,
  retailer: string,
  price: number
): Promise<CompetitorProductPrice> {
  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("competitor_product_prices")
    .insert({ product_id: productId, retailer, price })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToPrice(data as Record<string, unknown>);
}

/** Latest price per retailer for a given product. */
export async function getLatestPrices(
  productId: string
): Promise<CompetitorProductPrice[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("competitor_product_prices")
    .select("*")
    .eq("product_id", productId)
    .order("observed_at", { ascending: false });

  if (error) {
    log.error("[competitor-product-service] getLatestPrices failed:", error.message);
    return [];
  }

  const seen = new Map<string, CompetitorProductPrice>();
  for (const row of data ?? []) {
    const p = rowToPrice(row as Record<string, unknown>);
    if (!seen.has(p.retailer)) seen.set(p.retailer, p);
  }
  return [...seen.values()];
}

/** Latest price for a specific product at a specific retailer. */
export async function getLatestPriceForRetailer(
  productId: string,
  retailer: string
): Promise<number | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("competitor_product_prices")
    .select("price")
    .eq("product_id", productId)
    .eq("retailer", retailer)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? Number(data.price) : null;
}

/**
 * Record a competitor product purchase (upsert into competitor_product_stats).
 * Fire-and-forget: callers should not await this or block deletion on it.
 */
export async function recordCompetitorPurchase(
  competitorProductId: string,
  retailer: string,
): Promise<void> {
  const supabase = createClientIfConfigured();
  if (!supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("competitor_product_stats")
    .select("purchase_count")
    .eq("competitor_product_id", competitorProductId)
    .eq("retailer", retailer)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("competitor_product_stats")
      .update({
        purchase_count: (existing.purchase_count ?? 0) + 1,
        last_purchased_at: new Date().toISOString(),
      })
      .eq("competitor_product_id", competitorProductId)
      .eq("retailer", retailer)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("competitor_product_stats")
      .insert({
        competitor_product_id: competitorProductId,
        retailer,
        user_id: user.id,
        purchase_count: 1,
        last_purchased_at: new Date().toISOString(),
      });
  }
}

export interface RetailerProductResult {
  product_id: string;
  name: string;
  name_normalized: string;
  brand: string | null;
  ean_barcode: string | null;
  weight_or_quantity: string | null;
  country: string;
  thumbnail_url: string | null;
  category_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  latest_price: number | null;
  user_purchase_count: number;
  global_purchase_count: number;
}

/**
 * Search competitor products available at a given retailer, ranked by
 * personal purchase frequency first, then global frequency.
 * Calls the `search_retailer_products` Postgres RPC.
 */
export async function searchRetailerProducts(
  retailer: string,
  country: string,
  query?: string,
  limit = 50,
): Promise<RetailerProductResult[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const normalizedQuery = query ? normalizeName(query) : null;

  const { data, error } = await supabase.rpc("search_retailer_products", {
    p_retailer: retailer,
    p_country: country,
    p_user_id: user.id,
    p_query: normalizedQuery ?? undefined,
    p_limit: limit,
  });

  if (error) {
    log.error("[competitor-product-service] searchRetailerProducts failed:", error.message);
    return [];
  }

  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    product_id: String(row.product_id),
    name: String(row.name),
    name_normalized: String(row.name_normalized),
    brand: row.brand != null ? String(row.brand) : null,
    ean_barcode: row.ean_barcode != null ? String(row.ean_barcode) : null,
    weight_or_quantity: row.weight_or_quantity != null ? String(row.weight_or_quantity) : null,
    country: String(row.country),
    thumbnail_url: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
    category_id: row.category_id != null ? String(row.category_id) : null,
    status: String(row.status),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    latest_price: row.latest_price != null ? Number(row.latest_price) : null,
    user_purchase_count: Number(row.user_purchase_count ?? 0),
    global_purchase_count: Number(row.global_purchase_count ?? 0),
  }));
}

/** Fetch all active competitor products for a given country. */
export async function fetchCompetitorProducts(
  country: string
): Promise<CompetitorProduct[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const allRows: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("competitor_products")
      .select("*")
      .eq("status", "active")
      .eq("country", country)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      log.error("[competitor-product-service] fetch failed:", error.message);
      return [];
    }
    const rows = data ?? [];
    allRows.push(...(rows as Record<string, unknown>[]));
    hasMore = rows.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allRows.map(rowToCompetitorProduct);
}
