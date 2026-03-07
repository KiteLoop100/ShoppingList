/**
 * Local search: orchestrates the search pipeline.
 * Entry point called by searchModule() in index.ts.
 *
 * Pipeline: Preprocess → Classify → Retrieve → Score → Post-process
 * See specs/SEARCH-ARCHITECTURE.md for full architecture.
 */

import type { DemandGroup, SearchResult } from "@/types";
import type { SearchModuleInput } from "./types";
import { indexProducts, type SearchableProduct } from "./search-indexer";
import { preprocessQuery } from "./query-preprocessor";
import { findCandidates } from "./candidate-retrieval";
import { scoreAndRank, type UserProductPreference } from "./scoring-engine";
import { postProcess } from "./post-processor";
import { getProductPreferences } from "@/lib/settings/product-preferences";
import { MAX_RESULTS } from "./constants";

// ──── In-memory caches (populated on first search) ────

let indexedProducts: SearchableProduct[] | null = null;
let userHistory: Map<string, UserProductPreference> = new Map();
let demandGroupMap: Map<string, DemandGroup> = new Map();

/**
 * Set the indexed product list. Call this on app start after loading
 * products from IndexedDB/Supabase, instead of re-indexing on every search.
 */
export function setSearchProducts(products: SearchableProduct[]): void {
  indexedProducts = products;
}

/**
 * Set the user's purchase history. Call on app start after loading
 * user_product_preferences from Supabase.
 */
export function setUserHistory(preferences: UserProductPreference[]): void {
  userHistory = new Map(preferences.map((p) => [p.product_id, p]));
}

/**
 * Set the demand group lookup map. Call on app start after loading demand groups.
 */
export function setDemandGroups(groups: DemandGroup[]): void {
  demandGroupMap = new Map(groups.map((g) => [g.code, g]));
}

/**
 * Get the current user history map (for catalog scoring).
 */
export function getUserHistory(): Map<string, UserProductPreference> {
  return userHistory;
}

/**
 * Get the current indexed products (for catalog scoring).
 */
export function getIndexedProductsCache(): SearchableProduct[] {
  return indexedProducts ?? [];
}

/**
 * Clear cached data (e.g. on logout).
 */
export function clearSearchCache(): void {
  indexedProducts = null;
  userHistory = new Map();
  demandGroupMap = new Map();
}

/**
 * Main search function. Implements the SearchModule interface.
 */
export async function localSearch(
  input: SearchModuleInput
): Promise<SearchResult[]> {
  const { query, limit = MAX_RESULTS } = input;
  const trimmed = query.trim();

  if (!trimmed) return [];

  // Ensure products are indexed
  const products = getIndexedProducts(input);
  if (products.length === 0) return [];

  // 1. Preprocess query
  const { words } = preprocessQuery(trimmed);

  // 2. Retrieve candidates
  const candidates = findCandidates(trimmed, products);
  if (candidates.length === 0) return [];

  // 3. Score and rank
  const preferences = getProductPreferences();
  const scored = scoreAndRank(
    candidates,
    words.length,
    preferences,
    userHistory,
    undefined,
    trimmed
  );

  // 4. Post-process (allergens, expired specials, limit)
  const filtered = postProcess(scored, preferences, limit);

  // 5. Convert to SearchResult format
  return filtered.map((c) => {
    const dgCode = c.product.demand_group_code;
    const dg = demandGroupMap.get(dgCode);
    return {
      product_id: c.product.product_id,
      name: c.product.name,
      demand_group_code: dgCode,
      demand_group_name: dg?.name ?? "",
      price: c.product.price,
      score: c.totalScore,
      source: "other" as const,
      thumbnail_url: c.product.thumbnail_url ?? null,
      product: c.product,
    };
  });
}

/**
 * Get indexed products, using cache or building from input.
 */
function getIndexedProducts(input: SearchModuleInput): SearchableProduct[] {
  // If products were passed directly (e.g. from component state), index them
  if (input.products && input.products.length > 0) {
    // Only re-index if the cache is empty or stale
    if (!indexedProducts || indexedProducts.length !== input.products.length) {
      indexedProducts = indexProducts(input.products);
    }
    return indexedProducts;
  }

  // Otherwise use the pre-set cache
  return indexedProducts ?? [];
}
