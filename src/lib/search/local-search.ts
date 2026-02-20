/**
 * Local search (F02): Primary = product name, Secondary = brand, Tertiary = exact category name.
 * No category bleed. Max 20 results. Fuzzy only via nameMatchesQuery (1–2 char typo).
 */

import { db } from "@/lib/db";
import type { SearchResult, SearchResultSource } from "@/types";
import type { SearchModuleInput } from "./types";
import { normalizeForSearch, nameMatchesQuery } from "./normalize";

const MAX_RESULTS = 20;

function productToResult(
  product: { product_id: string; name: string; category_id: string; price: number | null },
  categoryName: string,
  source: SearchResultSource
): SearchResult {
  return {
    product_id: product.product_id,
    name: product.name,
    category_id: product.category_id,
    category_name: categoryName,
    price: product.price,
    score: source === "other" ? 1 : 1,
    source,
  };
}

export async function localSearch(
  input: SearchModuleInput
): Promise<SearchResult[]> {
  const { query, limit = MAX_RESULTS, products: inputProducts } = input;
  const q = normalizeForSearch(query);
  if (!q) return [];

  const [categories, idbProducts] = await Promise.all([
    db.categories.toArray(),
    inputProducts ? Promise.resolve(inputProducts) : db.products.toArray(),
  ]);
  const products = idbProducts;

  const categoryMap = new Map(categories.map((c) => [c.category_id, c]));
  const categoryByNameNorm = new Map<string, { category_id: string; name: string }>();
  for (const c of categories) {
    const norm = normalizeForSearch(c.name);
    if (norm) categoryByNameNorm.set(norm, { category_id: c.category_id, name: c.name });
  }

  const activeProducts = products.filter((p) => p.status === "active");
  const seen = new Set<string>();
  const matched: SearchResult[] = [];

  const cap = Math.min(limit, MAX_RESULTS);

  const isAktionsartikelQuery =
    q === "aktionsartikel" || q.split(/\s+/).some((w) => w === "aktionsartikel");

  if (isAktionsartikelQuery) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    for (const product of activeProducts) {
      if (matched.length >= cap) break;
      const p = product as { assortment_type?: string; special_start_date?: string | null; special_end_date?: string | null };
      if (p.assortment_type !== "special") continue;
      if (p.special_start_date) {
        const startDate = new Date(p.special_start_date);
        if (startDate < fourWeeksAgo) continue;
      }
      if (p.special_end_date) {
        const endDate = new Date(p.special_end_date);
        if (endDate < today) continue;
      }
      seen.add(product.product_id);
      const cat = categoryMap.get(product.category_id);
      matched.push(
        productToResult(product, cat?.name ?? "", "other")
      );
    }
    if (matched.length > 0) {
      matched.sort((a, b) => a.name.localeCompare(b.name, "de"));
      return matched.slice(0, cap);
    }
  }

  // Primary: product name (substring/word match)
  for (const product of activeProducts) {
    if (seen.has(product.product_id)) continue;
    if (!nameMatchesQuery(product.name_normalized, q)) continue;
    seen.add(product.product_id);
    const cat = categoryMap.get(product.category_id);
    matched.push(
      productToResult(product, cat?.name ?? "", "other")
    );
    if (matched.length >= cap) return matched;
  }

  // Secondary: brand (when query matches a product's brand)
  const qNorm = q;
  for (const product of activeProducts) {
    if (matched.length >= cap) break;
    if (seen.has(product.product_id)) continue;
    const brand = product.brand ?? null;
    if (!brand) continue;
    const brandNorm = normalizeForSearch(brand);
    if (!brandNorm) continue;
    if (brandNorm !== qNorm && !brandNorm.startsWith(qNorm) && !qNorm.startsWith(brandNorm)) continue;
    seen.add(product.product_id);
    const cat = categoryMap.get(product.category_id);
    matched.push(
      productToResult(product, cat?.name ?? "", "other")
    );
  }

  if (matched.length >= cap) return matched;

  // Tertiary: only when query exactly equals normalized category name (no "Milch" → "Milchprodukte" bleed)
  let categoryMatch: { category_id: string; name: string } | null = null;
  for (const [catNorm, cat] of Array.from(categoryByNameNorm)) {
    if (catNorm === qNorm) {
      categoryMatch = cat;
      break;
    }
  }
  if (categoryMatch) {
    for (const product of activeProducts) {
      if (matched.length >= cap) break;
      if (seen.has(product.product_id)) continue;
      if (product.category_id !== categoryMatch!.category_id) continue;
      seen.add(product.product_id);
      matched.push(
        productToResult(product, categoryMatch!.name, "other")
      );
    }
  }

  matched.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return matched.slice(0, cap);
}
