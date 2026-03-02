/**
 * Normalize an article number for receipt-to-product matching.
 * Strips non-digits and leading zeros. Mirrors the PG function
 * normalize_article_number() — keep both in sync.
 */
export function normalizeArticleNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digitsOnly = raw.replace(/\D/g, "");
  const stripped = digitsOnly.replace(/^0+/, "");
  return stripped || null;
}

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

const FLYER_SUFFIX_PATTERNS: RegExp[] = [
  /\bverschiedene\s+sorten\b/,
  /\bversch\s+sorten\b/,
  /\bdiv(?:erse)?\s+sorten\b/,
  /\bje\s+(?:packung|stueck|beutel|flasche|dose|glas|bund|schale|netz|kg|stk)\b/,
  /\bpro\s+(?:packung|stueck|kg|100\s*g|liter)\b/,
  /\bab\s+\d{1,2}\s*\.\s*\d{1,2}\s*\.?\b/,
  /\b\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cl|stueck|stk|er)\s*$/,
  /\b(?:ca|mind|max)\s*\.\s*\d+/,
  /\boder\b.*$/,
];

/**
 * Strip typical flyer suffixes (e.g. "verschiedene Sorten", weight specs)
 * from a *normalized* name to improve DB matching.
 */
export function stripFlyerSuffixes(normalized: string): string {
  let result = normalized;
  for (const pattern of FLYER_SUFFIX_PATTERNS) {
    result = result.replace(pattern, " ");
  }
  return result.replace(/\s+/g, " ").trim();
}
