/**
 * Catalog slice + cache for recipe ingredient matching.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import { mapSupabaseProductRowToProduct, type ProductRow } from "@/lib/products/map-supabase-product-row";
import { log } from "@/lib/utils/logger";

/** Demand group codes under meta M01–M10 (food & beverages core range). */
export const FOOD_DEMAND_GROUP_CODES: readonly string[] = [
  "38", "58", "88", "56", "57", "89", "50", "51", "55", "60", "83", "84", "49", "62", "64", "67", "68", "69",
  "70", "71", "82", "47", "48", "72", "73", "75", "76", "77", "78", "01", "02", "03", "04", "05", "74", "79",
  "80", "81", "45", "46", "40", "41", "42", "43", "44", "86", "87", "90", "52", "53", "54",
];

const CATALOG_LIMIT = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { products: Product[]; expiresAt: number };
const relevantProductsCache = new Map<string, CacheEntry>();

export function buildCatalogPayload(products: Product[]) {
  return products.map((p) => ({
    id: p.product_id,
    name: p.name,
    category: p.demand_sub_group ?? p.demand_group_code,
    price: p.price,
    unit_size: p.weight_or_quantity ?? null,
  }));
}

export async function getRelevantProducts(supabase: SupabaseClient, country: "DE" | "AT"): Promise<Product[]> {
  const key = country;
  const now = Date.now();
  const hit = relevantProductsCache.get(key);
  if (hit && hit.expiresAt > now) return hit.products;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("status", "active")
    .eq("country", country)
    .eq("assortment_type", "daily_range")
    .in("demand_group_code", [...FOOD_DEMAND_GROUP_CODES])
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(CATALOG_LIMIT);

  if (error) {
    log.error("[ingredient-matcher] getRelevantProducts:", error.message);
    return [];
  }

  const products = (data ?? []).map((row) => mapSupabaseProductRowToProduct(row as ProductRow));
  relevantProductsCache.set(key, { products, expiresAt: now + CACHE_TTL_MS });
  return products;
}
