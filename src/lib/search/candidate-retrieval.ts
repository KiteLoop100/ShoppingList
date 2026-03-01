/**
 * Candidate retrieval: finds all products matching a query
 * and assigns a MatchType to each.
 * See specs/SEARCH-ARCHITECTURE.md §4.
 */

import { MatchType } from "./constants";
import type { SearchableProduct } from "./search-indexer";
import type { SubstringPosition } from "./word-boundary";
import { classifySubstringMatch } from "./word-boundary";
import { preprocessQuery } from "./query-preprocessor";
import { findSynonym, matchesDemandGroupPrefixes } from "./synonym-map";

export interface SearchCandidate {
  product: SearchableProduct;
  matchType: MatchType;
  substringPosition: SubstringPosition | null;
}

/**
 * Find all candidate products for a given query.
 * Each candidate gets the best (lowest enum value) MatchType it qualifies for.
 */
export function findCandidates(
  query: string,
  products: SearchableProduct[]
): SearchCandidate[] {
  const { normalized, words, wordVariants } = preprocessQuery(query);

  if (!normalized) return [];

  const candidates = new Map<string, SearchCandidate>();

  for (const product of products) {
    const matchType = determineMatchType(
      normalized,
      words,
      wordVariants,
      product
    );

    if (matchType === null) continue;

    const substringPosition =
      matchType === MatchType.NAME_CONTAINS_STANDALONE ||
      matchType === MatchType.NAME_CONTAINS_DOMINANT ||
      matchType === MatchType.NAME_CONTAINS_MODIFIER
        ? classifySubstringMatch(normalized, product.search_name_normalized)
        : null;

    candidates.set(product.product_id, {
      product,
      matchType,
      substringPosition,
    });
  }

  return Array.from(candidates.values());
}

/**
 * Determine the best MatchType for a product given a query.
 * Returns null if the product does not match at all.
 * Lower MatchType enum value = better match.
 */
function determineMatchType(
  queryNorm: string,
  queryWords: string[],
  queryWordVariants: string[][],
  product: SearchableProduct
): MatchType | null {
  const name = product.search_name_normalized;
  const nameWords = product.search_name_words;

  // 1. EXACT_NAME
  if (name === queryNorm) {
    return MatchType.EXACT_NAME;
  }

  // 2. NAME_STARTS_WITH
  //    Only matches if query ends at a word boundary AND (if synonym exists)
  //    the product belongs to the expected category.
  //    "Milch" in "Milch Freunde" (Schokolade) → downgrade to modifier
  //    "Milch" in "H-Milch 1.5%" (Milchprodukt) → valid starts-with is handled below
  if (name.startsWith(queryNorm)) {
    const charAfterQuery = name[queryNorm.length];
    if (charAfterQuery === undefined || charAfterQuery === " ") {
      if (isNameMatchValidForCategory(queryNorm, product)) {
        return MatchType.NAME_STARTS_WITH;
      }
      // Product doesn't match synonym category → treat as standalone substring
      return MatchType.NAME_CONTAINS_STANDALONE;
    }
  }

  // 3. NAME_FIRST_WORD
  if (nameWords.length > 0) {
    const firstWord = nameWords[0];
    if (firstWord === queryNorm) {
      if (isNameMatchValidForCategory(queryNorm, product)) {
        return MatchType.NAME_FIRST_WORD;
      }
      return MatchType.NAME_CONTAINS_STANDALONE;
    }
    if (queryWordVariants.length === 1) {
      for (const variant of queryWordVariants[0]) {
        if (firstWord === variant) {
          if (isNameMatchValidForCategory(variant, product)) {
            return MatchType.NAME_FIRST_WORD;
          }
          return MatchType.NAME_CONTAINS_STANDALONE;
        }
      }
    }
  }

  // 4. NAME_CONTAINS (with word boundary classification)
  //    Additional check: if the query has a synonym mapping, only classify as
  //    "dominant" when the product belongs to the mapped category.
  //    This prevents "wein" in "Schwein" from being ranked as dominant.
  if (name.includes(queryNorm)) {
    const position = classifySubstringMatch(queryNorm, name);
    if (position === "standalone") return MatchType.NAME_CONTAINS_STANDALONE;
    if (position === "dominant") {
      // Validate: does this compound match make semantic sense?
      if (isDominantMatchValid(queryNorm, product)) {
        return MatchType.NAME_CONTAINS_DOMINANT;
      }
      return MatchType.NAME_CONTAINS_MODIFIER;
    }
    if (position === "modifier") return MatchType.NAME_CONTAINS_MODIFIER;
    return MatchType.NAME_CONTAINS_MODIFIER;
  }

  // Also check stem variants for substring matching
  if (queryWordVariants.length === 1) {
    for (const variant of queryWordVariants[0]) {
      if (variant === queryNorm) continue;
      if (name.includes(variant)) {
        const position = classifySubstringMatch(variant, name);
        if (position === "standalone") return MatchType.NAME_CONTAINS_STANDALONE;
        if (position === "dominant") {
          if (isDominantMatchValid(variant, product)) {
            return MatchType.NAME_CONTAINS_DOMINANT;
          }
          return MatchType.NAME_CONTAINS_MODIFIER;
        }
        if (position === "modifier") return MatchType.NAME_CONTAINS_MODIFIER;
        return MatchType.NAME_CONTAINS_MODIFIER;
      }
    }
  }

  // 5. MULTI_WORD_ALL (every query word must appear in product name)
  if (queryWords.length >= 2) {
    const allWordsMatch = queryWordVariants.every((variants) =>
      variants.some(
        (v) =>
          nameWords.includes(v) ||
          name.includes(v)
      )
    );
    if (allWordsMatch) return MatchType.MULTI_WORD_ALL;
  }

  // 6. CATEGORY_MATCH (synonym map)
  const synonym = findSynonym(queryNorm);
  if (synonym) {
    if (
      matchesDemandGroupPrefixes(
        product.demand_group_normalized,
        synonym.demand_group_prefixes
      )
    ) {
      return MatchType.CATEGORY_MATCH;
    }
  }
  // Also check synonym for single-word stem variants
  if (queryWordVariants.length === 1) {
    for (const variant of queryWordVariants[0]) {
      if (variant === queryNorm) continue;
      const variantSynonym = findSynonym(variant);
      if (
        variantSynonym &&
        matchesDemandGroupPrefixes(
          product.demand_group_normalized,
          variantSynonym.demand_group_prefixes
        )
      ) {
        return MatchType.CATEGORY_MATCH;
      }
    }
  }

  // 7. BRAND_MATCH
  if (product.search_brand_normalized) {
    if (
      product.search_brand_normalized === queryNorm ||
      product.search_brand_normalized.startsWith(queryNorm)
    ) {
      return MatchType.BRAND_MATCH;
    }
  }

  // 8. DEMAND_GROUP (direct substring match)
  if (product.demand_group_normalized) {
    if (product.demand_group_normalized.includes(queryNorm)) {
      return MatchType.DEMAND_GROUP;
    }
  }

  // 9. FUZZY_MATCH – Phase 2 (placeholder)
  // Will use Levenshtein distance here

  return null;
}

/**
 * Validate whether a "dominant" compound match is semantically correct.
 *
 * If the query has a synonym mapping (e.g. "wein" → "03 Wein"), we check
 * whether the product belongs to that category. If not, the match is
 * downgraded to "modifier".
 *
 * For short queries (≤ 4 chars) without a synonym mapping, we also
 * downgrade to modifier as a safety net – short substrings produce
 * too many false compound matches (e.g. "eis" in "Reis", "Fleisch").
 */
function isDominantMatchValid(
  queryNorm: string,
  product: SearchableProduct
): boolean {
  const synonym = findSynonym(queryNorm);

  if (synonym) {
    // Query has a synonym mapping → product must belong to that category
    return matchesDemandGroupPrefixes(
      product.demand_group_normalized,
      synonym.demand_group_prefixes
    );
  }

  // No synonym mapping: for short queries, be conservative
  if (queryNorm.length <= 4) {
    return false;
  }

  // Longer queries without synonym mapping: trust the compound analysis
  return true;
}

/**
 * Check if a high-ranking name match (STARTS_WITH, FIRST_WORD) is valid
 * given the product's category.
 *
 * If the query has a synonym mapping (e.g. "milch" → dairy categories),
 * the product must belong to one of those categories to earn the high rank.
 * "Milch Maeuse" (Schokolade) searching for "milch" → false
 * "H-Milch 1.5%" (Milchprodukte) searching for "milch" → true
 *
 * If no synonym mapping exists, the match is always valid (no category to check against).
 */
function isNameMatchValidForCategory(
  queryNorm: string,
  product: SearchableProduct
): boolean {
  const synonym = findSynonym(queryNorm);

  // No synonym mapping → no category restriction, match is valid
  if (!synonym) return true;

  // Synonym exists → product must belong to mapped category
  return matchesDemandGroupPrefixes(
    product.demand_group_normalized,
    synonym.demand_group_prefixes
  );
}
