/**
 * Post-processing: allergen exclusion, expired specials removal, result limiting.
 * See specs/SEARCH-ARCHITECTURE.md §6.
 */

import { MAX_RESULTS } from "./constants";
import type { ScoredCandidate } from "./scoring-engine";
import type { ProductPreferences } from "@/lib/settings/product-preferences";

/**
 * Apply post-processing filters and return final results.
 */
export function postProcess(
  candidates: ScoredCandidate[],
  preferences: ProductPreferences,
  limit: number = MAX_RESULTS,
  now?: Date
): ScoredCandidate[] {
  const today = now ?? new Date();

  return candidates
    .filter((c) => !isExpiredSpecial(c, today))
    .filter((c) => !shouldExcludeAllergens(c, preferences))
    .slice(0, limit);
}

/**
 * Check if a special product has an expired promotion period.
 */
function isExpiredSpecial(
  candidate: ScoredCandidate,
  today: Date
): boolean {
  const p = candidate.product;

  if (p.assortment_type === "daily_range") return false;
  if (!p.special_end_date) return false;

  const endDate = new Date(p.special_end_date);
  return endDate < today;
}

/**
 * Check if a product should be excluded based on allergen preferences.
 * Mirrors the existing shouldExclude() logic from local-search.ts.
 */
function shouldExcludeAllergens(
  candidate: ScoredCandidate,
  prefs: ProductPreferences
): boolean {
  const p = candidate.product;
  const allergens = (p.allergens ?? "").toLowerCase();

  if (prefs.exclude_gluten) {
    if (
      p.is_gluten_free === false ||
      (!p.is_gluten_free && allergens.includes("gluten"))
    ) {
      return true;
    }
  }

  if (prefs.exclude_lactose) {
    if (
      p.is_lactose_free === false ||
      (!p.is_lactose_free &&
        (allergens.includes("laktose") ||
          allergens.includes("lactose") ||
          allergens.includes("milch")))
    ) {
      return true;
    }
  }

  if (prefs.exclude_nuts) {
    if (
      allergens.includes("nuss") ||
      allergens.includes("mandel") ||
      allergens.includes("erdnuss") ||
      allergens.includes("nut") ||
      allergens.includes("almond") ||
      allergens.includes("peanut")
    ) {
      return true;
    }
  }

  return false;
}
