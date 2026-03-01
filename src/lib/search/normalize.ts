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

/**
 * Substring match per FEATURES.md F02: "Der Suchbegriff muss im Produktnamen enthalten sein (Substring-Match)."
 * Zusätzlich: space-insensitive Match, damit z. B. "Kartoffelsuppe", "Suppe" oder "bio kartoffel suppe"
 * das Produkt "Bio Kartoffel Suppe" finden (normalisierter Name enthält Query oder Name ohne Leerzeichen enthält Query ohne Leerzeichen).
 */
export function nameMatchesQuery(
  normalizedProductName: string,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return false;
  if (normalizedProductName.includes(normalizedQuery)) return true;
  const nameNoSpaces = normalizedProductName.replace(/\s+/g, "");
  const queryNoSpaces = normalizedQuery.replace(/\s+/g, "").trim();
  if (!queryNoSpaces) return false;
  return nameNoSpaces.includes(queryNoSpaces);
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
