/**
 * Search indexer: enriches Product objects with precomputed search fields.
 * Called once on app start after loading products from IndexedDB.
 * See specs/SEARCH-ARCHITECTURE.md §7.
 */

import type { Product } from "@/types";
import { buildSearchName, normalize } from "./query-preprocessor";

/**
 * A Product enriched with precomputed fields for fast search matching.
 * These fields exist only in memory – they are not persisted to DB.
 */
export interface SearchableProduct extends Product {
  /** Name without ALDI prefixes and quantity suffixes */
  search_name: string;
  /** search_name normalized (lowercase, no diacritics) */
  search_name_normalized: string;
  /** Individual words from search_name_normalized for fast matching */
  search_name_words: string[];
  /** Brand normalized, or null */
  search_brand_normalized: string | null;
}

/**
 * Enrich a single product with precomputed search fields.
 */
export function indexProduct(product: Product): SearchableProduct {
  const searchName = buildSearchName(product.name);
  const searchNameNormalized = normalize(searchName);

  return {
    ...product,
    search_name: searchName,
    search_name_normalized: searchNameNormalized,
    search_name_words: searchNameNormalized.split(" ").filter(Boolean),
    search_brand_normalized: product.brand ? normalize(product.brand) : null,
  };
}

/**
 * Enrich an array of products for search. Called once on app start.
 * Filters to active products only.
 */
export function indexProducts(products: Product[]): SearchableProduct[] {
  return products
    .filter((p) => p.status === "active")
    .map(indexProduct);
}
