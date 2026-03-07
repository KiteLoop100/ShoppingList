import type { LocalStore } from "@/lib/db";
import { normalizeName } from "@/lib/products/normalize";

/**
 * Alias for normalizeName used in store filtering context.
 */
export const normalizeForFilter = normalizeName;

export function storeMatchesQuery(store: LocalStore, queryNorm: string): boolean {
  return storeMatchRelevance(store, queryNorm) > 0;
}

/**
 * Returns a relevance score for sorting:
 *   4 = retailer match, 3 = city match, 2 = name/postal match, 1 = address match, 0 = no match
 */
export function storeMatchRelevance(store: LocalStore, queryNorm: string): number {
  if (!queryNorm) return 4;
  const retailer = normalizeForFilter(store.retailer ?? "");
  if (retailer.includes(queryNorm)) return 4;
  const city = normalizeForFilter(store.city);
  if (city.includes(queryNorm)) return 3;
  const name = normalizeForFilter(store.name);
  const postal = normalizeForFilter(store.postal_code);
  if (name.includes(queryNorm) || postal.includes(queryNorm)) return 2;
  const address = normalizeForFilter(store.address);
  if (address.includes(queryNorm)) return 1;
  return 0;
}

/**
 * Filter and sort stores by query relevance (city > name/postal > address).
 */
export function filterAndSortStores(stores: LocalStore[], queryNorm: string): LocalStore[] {
  if (!queryNorm) return stores;
  return stores
    .map((s) => ({ store: s, relevance: storeMatchRelevance(s, queryNorm) }))
    .filter((e) => e.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .map((e) => e.store);
}
