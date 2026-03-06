/**
 * Smart filter for catalog view.
 *
 * Rules:
 * 1. Products purchased in the last 12 months are ALWAYS shown (never filtered).
 * 2. Popularity cutoff starts at bottom 40%, increases by 2.5% per scanned
 *    receipt, capped at 80% (= show only top 20%).
 * 3. Sort order from scoreForCatalog is preserved.
 *
 * Note: User preferences (bio, vegan, etc.) are NOT used for filtering —
 * they only affect sort order via scoreForCatalog's preferenceScore signal.
 */

import type { CatalogScoredProduct } from "@/lib/search/scoring-engine";
import type { UserProductPreference } from "@/lib/search/scoring-engine";

const BASE_CUTOFF = 0.40;
const CUTOFF_PER_RECEIPT = 0.025;
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

export function computeCutoffPercentile(receiptCount: number): number {
  return Math.min(BASE_CUTOFF + receiptCount * CUTOFF_PER_RECEIPT, MAX_CUTOFF);
}

/**
 * Apply smart filter to scored catalog products.
 *
 * @param products - scored products from scoreForCatalog
 * @param userHistory - purchase history (product_id → last_purchased_at)
 * @param receiptCount - total scanned receipts (drives progressive cutoff)
 * @param now - current date (for 12-month calculation, defaults to Date.now)
 */
export function applySmartFilter(
  products: CatalogScoredProduct[],
  userHistory: Map<string, UserProductPreference>,
  receiptCount: number,
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

  if (nonPurchased.length <= 3) {
    return mergePreservingOrder(products, recentlyPurchased, nonPurchased);
  }

  const cutoffPct = computeCutoffPercentile(receiptCount);
  const popScores = nonPurchased
    .map((p) => p.popularityScore)
    .sort((a, b) => a - b);
  const cutoff = percentile(popScores, cutoffPct);

  const afterPopularity = nonPurchased.filter(
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
