import type { Product } from "@/types";

export function scoreProductMatch(product: Product, words: string[]): number | null {
  const nameL = product.name.toLowerCase();
  const normL = product.name_normalized.toLowerCase();
  const brandL = (product.brand || "").toLowerCase();
  const haystack = `${nameL} ${normL} ${brandL}`;

  let score = 0;
  for (const w of words) {
    if (haystack.includes(w)) {
      score += 10;
      if (nameL.startsWith(w)) score += 5;
    } else {
      return null;
    }
  }

  if (product.thumbnail_url) score += 2;
  if (product.price != null) score += 1;

  return score;
}

export function matchProducts(products: Product[], needle: string, limit = 30): Product[] {
  if (!needle) return [];
  const words = needle.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  return products
    .map((p) => {
      const score = scoreProductMatch(p, words);
      return score !== null ? { product: p, score } : null;
    })
    .filter((x): x is { product: Product; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.product);
}
