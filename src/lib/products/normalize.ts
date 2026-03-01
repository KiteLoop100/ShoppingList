/**
 * Normalize a product name for deduplication/matching.
 * Strips diacritics, lowercases, removes non-alphanumeric chars.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
