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
    category_id: row.category_id != null ? String(row.category_id) : null,
    status: (row.status as CompetitorProduct["status"]) ?? "active",
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
  category_id?: string | null;
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
      category_id: params.category_id ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToCompetitorProduct(data as Record<string, unknown>);
}

export async function updateCompetitorProduct(
  productId: string,
  updates: Partial<Pick<CompetitorProduct, "name" | "brand" | "ean_barcode" | "article_number" | "weight_or_quantity" | "thumbnail_url" | "category_id">>
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
  if (updates.category_id !== undefined) payload.category_id = updates.category_id;

  const { error } = await supabase
    .from("competitor_products")
    .update(payload)
    .eq("product_id", productId);

  if (error) throw error;
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

  if (existing) return rowToCompetitorProduct(existing as Record<string, unknown>);

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

  if (error) throw error;
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
