/**
 * Query preprocessing: normalization, ALDI prefix removal,
 * quantity suffix stripping, and plural stem variants.
 * See specs/SEARCH-ARCHITECTURE.md §2.
 */

import {
  ALDI_PREFIXES,
  QUANTITY_SUFFIX_PATTERN,
  PLURAL_SUFFIXES,
  MIN_STEM_LENGTH,
} from "./constants";
import { normalizeName } from "@/lib/products/normalize";

/**
 * Core normalization – delegates to the single canonical implementation.
 */
export const normalize = normalizeName;

/**
 * Remove known ALDI-internal prefixes from a product name.
 * E.g. "KA: Batterien AA 8 Stk." → "Batterien AA 8 Stk."
 */
export function stripAldiPrefix(name: string): string {
  const trimmed = name.trim();
  for (const prefix of ALDI_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return trimmed;
}

/**
 * Remove trailing quantity/weight suffixes from a product name.
 * E.g. "Rundkorn Reis 500g" → "Rundkorn Reis"
 * E.g. "Ferrero Paradiso 4er 116g" → "Ferrero Paradiso"
 *
 * Applied iteratively to handle chained suffixes like "4er 116g".
 */
export function stripQuantitySuffix(name: string): string {
  let result = name.trim();
  let previous = "";
  // Iterate to handle chained suffixes (e.g. "4er 116g")
  while (result !== previous) {
    previous = result;
    result = result.replace(QUANTITY_SUFFIX_PATTERN, "").trim();
  }
  return result || name.trim(); // fallback to original if everything was stripped
}

/**
 * Build a search-ready name: strip prefix, strip quantity, then normalize.
 * Used when indexing products into memory (search-indexer.ts).
 */
export function buildSearchName(rawName: string): string {
  return stripQuantitySuffix(stripAldiPrefix(rawName));
}

/**
 * Generate stem variants for a word to handle German plural forms.
 * Returns the original word + variants with suffixes removed/added.
 *
 * E.g. "tomaten" → ["tomaten", "tomate", "tomat"]
 * E.g. "tomate"  → ["tomate", "tomaten", "tomater", "tomates"]
 *
 * Only generates variants if the stem would be >= MIN_STEM_LENGTH chars.
 */
export function getStemVariants(word: string): string[] {
  const variants = new Set<string>();
  variants.add(word);

  if (word.length < MIN_STEM_LENGTH) return [word];

  // Try removing plural suffixes (longest first to avoid partial removal)
  const sortedSuffixes = [...PLURAL_SUFFIXES].sort((a, b) => b.length - a.length);

  for (const suffix of sortedSuffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (stem.length >= MIN_STEM_LENGTH) {
        variants.add(stem);
        // Also add other plural forms of this stem
        for (const otherSuffix of PLURAL_SUFFIXES) {
          if (otherSuffix !== suffix) {
            variants.add(stem + otherSuffix);
          }
        }
      }
    }
  }

  // Also try adding suffixes to the original word (singular → plural)
  for (const suffix of PLURAL_SUFFIXES) {
    if (!word.endsWith(suffix)) {
      variants.add(word + suffix);
    }
  }

  return Array.from(variants);
}

/**
 * Preprocess a user query: normalize + generate stem variants per word.
 * Returns the normalized query string and an array of word groups,
 * where each group contains the original word + its stem variants.
 */
export function preprocessQuery(rawQuery: string): {
  normalized: string;
  words: string[];
  wordVariants: string[][];
} {
  const normalized = normalize(rawQuery);
  const words = normalized.split(" ").filter(Boolean);
  const wordVariants = words.map((w) => getStemVariants(w));
  return { normalized, words, wordVariants };
}
