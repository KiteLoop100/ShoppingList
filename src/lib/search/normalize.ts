/**
 * Normalize text for search: lowercase, remove diacritics, collapse non-alphanumeric.
 * Used for both product name_normalized and live query normalization.
 */

export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(
      /[äöüßàáâãäåèéêëìíîïòóôõùúûüýÿ]/g,
      (c) =>
        ({
          ä: "a",
          ö: "o",
          ü: "u",
          ß: "ss",
          à: "a",
          á: "a",
          â: "a",
          ã: "a",
          å: "a",
          è: "e",
          é: "e",
          ê: "e",
          ë: "e",
          ì: "i",
          í: "i",
          î: "i",
          ï: "i",
          ò: "o",
          ó: "o",
          ô: "o",
          õ: "o",
          ù: "u",
          ú: "u",
          û: "u",
          ý: "y",
          ÿ: "y",
        }[c] ?? c)
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance between two strings (number of single-char edits).
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

const MAX_TYPO_DISTANCE = 2;
const MIN_QUERY_LENGTH_FOR_PREFIX = 2;

/**
 * Substring match per FEATURES.md F02: "Der Suchbegriff muss im Produktnamen enthalten sein (Substring-Match)."
 * "Milch" findet nur Produkte mit "Milch" im Namen – nicht Butter, Gouda oder andere Kategorie-Nachbarn.
 */
export function nameMatchesQuery(
  normalizedProductName: string,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return false;
  return normalizedProductName.includes(normalizedQuery);
}

/**
 * @deprecated Use nameMatchesQuery for strict word-based matching.
 * Kept for backwards compatibility during migration.
 */
export function fuzzyMatches(normalizedText: string, normalizedQuery: string): boolean {
  return nameMatchesQuery(normalizedText, normalizedQuery);
}

/**
 * Find existing products that might be duplicates of a normalized name
 * (exact match, or one contains the other, or small Levenshtein distance).
 */
export function findSimilarProductNames<T extends { name_normalized: string }>(
  normalized: string,
  products: T[],
  maxDistance = 3
): T[] {
  if (!normalized) return [];
  return products.filter((p) => {
    const n = p.name_normalized;
    if (n === normalized) return true;
    if (n.includes(normalized) || normalized.includes(n)) return true;
    if (
      Math.abs(n.length - normalized.length) <= maxDistance &&
      levenshtein(n, normalized) <= maxDistance
    )
      return true;
    return false;
  });
}
