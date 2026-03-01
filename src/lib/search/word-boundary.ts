/**
 * Word boundary analysis for substring matches.
 * Solves the "Wein ≠ Weintraube" problem.
 * See specs/SEARCH-ARCHITECTURE.md §4.4.
 */

import { PREPOSITIONS } from "./constants";

export type SubstringPosition = "standalone" | "dominant" | "modifier";

/**
 * Classify how a query appears within a product name.
 *
 * - standalone: query is an independent word ("reis" in "rundkorn reis")
 * - dominant:   query is the core/root of a compound word ("wein" in "rotwein")
 * - modifier:   query is a prefix/modifier in a compound word ("wein" in "weintraube")
 *
 * Returns null if the query is not found in the product name.
 */
export function classifySubstringMatch(
  queryNorm: string,
  productNameNorm: string
): SubstringPosition | null {
  // Quick check: is query even in the product name?
  if (!productNameNorm.includes(queryNorm)) return null;

  const words = productNameNorm.split(" ");

  // 1. Check for standalone word match (exact word boundary)
  if (words.includes(queryNorm)) return "standalone";

  // 2. Check stem variants as standalone
  //    (handled by caller passing stem variants – not here)

  // 3. Analyze compound words
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.includes(queryNorm)) continue;

    // Word after a preposition → modifier
    // e.g. "thunfisch in wasser" → "wasser" after "in" is still standalone
    // But "thunfisch in wasserbad" → "wasser" in "wasserbad" after "in" is modifier
    if (i > 0 && (PREPOSITIONS as readonly string[]).includes(words[i - 1]) && word !== queryNorm) {
      return "modifier";
    }

    // Query at END of compound word → dominant (Rot-WEIN, Mineral-WASSER)
    if (word.endsWith(queryNorm) && word.length > queryNorm.length) {
      return "dominant";
    }

    // Query at START of compound word → modifier (WEIN-traube, WASSER-melone)
    if (word.startsWith(queryNorm) && word.length > queryNorm.length) {
      return "modifier";
    }

    // Query in MIDDLE of compound word → modifier
    if (word.includes(queryNorm) && !word.startsWith(queryNorm) && !word.endsWith(queryNorm)) {
      return "modifier";
    }
  }

  return null;
}
