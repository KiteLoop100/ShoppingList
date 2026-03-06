/**
 * Smart filter for catalog view.
 *
 * Rules:
 * 1. Products purchased in the last 12 months are ALWAYS shown (never filtered).
 * 2. Preference exclusions apply to non-purchased products only.
 * 3. Popularity cutoff starts at bottom 40%, increases by 2.5% per completed
 *    shopping trip (scanned receipt), capped at 80% (= show only top 20%).
 * 4. Sort order from scoreForCatalog is preserved.
 */

import type { CatalogScoredProduct } from "@/lib/search/scoring-engine";
import type { UserProductPreference } from "@/lib/search/scoring-engine";
import type { ProductPreferences } from "@/lib/settings/product-preferences";

const BASE_CUTOFF = 0.40;
const CUTOFF_PER_TRIP = 0.025;
const MAX_CUTOFF = 0.80;
const PURCHASED_WITHIN_MONTHS = 12;

/**
 * Returns the value at the given percentile (0–1) from a sorted-ascending array.
 * Uses linear interpolation between neighboring elements.
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const idx = p * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];

  const frac = idx - lower;
  return sortedValues[lower] * (1 - frac) + sortedValues[upper] * frac;
}

function wasPurchasedWithin12Months(
  productId: string,
  userHistory: Map<string, UserProductPreference>,
  now: Date,
): boolean {
  const pref = userHistory.get(productId);
  if (!pref) return false;

  const lastPurchased = new Date(pref.last_purchased_at);
  const cutoffDate = new Date(now);
  cutoffDate.setMonth(cutoffDate.getMonth() - PURCHASED_WITHIN_MONTHS);
  return lastPurchased >= cutoffDate;
}

function passesPreferenceFilter(
  product: CatalogScoredProduct,
  prefs: ProductPreferences,
): boolean {
  const p = product.product;

  if (prefs.exclude_gluten && p.is_gluten_free !== true) return false;
  if (prefs.exclude_lactose && p.is_lactose_free !== true) return false;
  if (prefs.prefer_vegan && p.is_vegan !== true) return false;
  if (prefs.prefer_bio && p.is_bio !== true) return false;
  if (prefs.prefer_animal_welfare) {
    if (p.animal_welfare_level == null || p.animal_welfare_level < 2) {
      return false;
    }
  }

  return true;
}

export function computeCutoffPercentile(tripCount: number): number {
  return Math.min(BASE_CUTOFF + tripCount * CUTOFF_PER_TRIP, MAX_CUTOFF);
}

/**
 * Apply smart filter to scored catalog products.
 *
 * @param products - scored products from scoreForCatalog
 * @param preferences - user dietary/quality preferences
 * @param userHistory - purchase history (product_id → last_purchased_at)
 * @param tripCount - total completed shopping trips (drives progressive cutoff)
 * @param now - current date (for 12-month calculation, defaults to Date.now)
 */
export function applySmartFilter(
  products: CatalogScoredProduct[],
  preferences: ProductPreferences,
  userHistory: Map<string, UserProductPreference>,
  tripCount: number,
  now?: Date,
): CatalogScoredProduct[] {
  if (products.length === 0) return [];

  const today = now ?? new Date();

  const recentlyPurchased: CatalogScoredProduct[] = [];
  const nonPurchased: CatalogScoredProduct[] = [];

  for (const p of products) {
    if (wasPurchasedWithin12Months(p.product.product_id, userHistory, today)) {
      recentlyPurchased.push(p);
    } else {
      nonPurchased.push(p);
    }
  }

  const afterPrefs = nonPurchased.filter((p) =>
    passesPreferenceFilter(p, preferences),
  );

  if (afterPrefs.length <= 3) {
    return mergePreservingOrder(products, recentlyPurchased, afterPrefs);
  }

  const cutoffPct = computeCutoffPercentile(tripCount);
  const popScores = afterPrefs
    .map((p) => p.popularityScore)
    .sort((a, b) => a - b);
  const cutoff = percentile(popScores, cutoffPct);

  const afterPopularity = afterPrefs.filter(
    (p) => p.popularityScore >= cutoff,
  );

  return mergePreservingOrder(products, recentlyPurchased, afterPopularity);
}

/**
 * Merge the two survivor sets (purchased + filtered non-purchased) back
 * into the original order from scoreForCatalog.
 */
function mergePreservingOrder(
  originalOrder: CatalogScoredProduct[],
  purchased: CatalogScoredProduct[],
  filteredNonPurchased: CatalogScoredProduct[],
): CatalogScoredProduct[] {
  const keepIds = new Set<string>();
  for (const p of purchased) keepIds.add(p.product.product_id);
  for (const p of filteredNonPurchased) keepIds.add(p.product.product_id);

  return originalOrder.filter((p) => keepIds.has(p.product.product_id));
}
