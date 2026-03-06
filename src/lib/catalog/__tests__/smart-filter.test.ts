import { applySmartFilter, computeCutoffPercentile } from "../smart-filter";
import { indexProducts } from "@/lib/search/search-indexer";
import { scoreForCatalog, type CatalogScoredProduct } from "@/lib/search/scoring-engine";
import type { UserProductPreference } from "@/lib/search/scoring-engine";
import type { ProductPreferences } from "@/lib/settings/product-preferences";
import type { Product } from "@/types";

function makeProduct(
  overrides: Partial<Product> & { product_id: string; name: string },
): Product {
  return {
    name_normalized: overrides.name.toLowerCase(),
    brand: null,
    price: null,
    price_updated_at: null,
    assortment_type: "daily_range",
    availability: "national",
    region: null,
    country: "DE",
    special_start_date: null,
    special_end_date: null,
    status: "active",
    source: "admin",
    created_at: "",
    updated_at: "",
    demand_group: null,
    demand_group_code: "38",
    popularity_score: 0.5,
    is_bio: false,
    is_vegan: false,
    is_gluten_free: false,
    is_lactose_free: false,
    animal_welfare_level: null,
    ...overrides,
  };
}

const NO_PREFS: ProductPreferences = {
  exclude_gluten: false,
  exclude_lactose: false,
  exclude_nuts: false,
  prefer_cheapest: false,
  prefer_brand: false,
  prefer_bio: false,
  prefer_vegan: false,
  prefer_animal_welfare: false,
};

const NO_HISTORY = new Map<string, UserProductPreference>();
const NOW = new Date("2026-06-01T12:00:00Z");

function buildScored(products: Product[]): CatalogScoredProduct[] {
  return scoreForCatalog(indexProducts(products), NO_PREFS, NO_HISTORY);
}

function historyWith(
  entries: Array<{ product_id: string; months_ago: number; count?: number }>,
): Map<string, UserProductPreference> {
  const map = new Map<string, UserProductPreference>();
  for (const e of entries) {
    const d = new Date(NOW);
    d.setMonth(d.getMonth() - e.months_ago);
    map.set(e.product_id, {
      product_id: e.product_id,
      purchase_count: e.count ?? 1,
      last_purchased_at: d.toISOString(),
    });
  }
  return map;
}

describe("computeCutoffPercentile", () => {
  test("starts at 0.40 with 0 trips", () => {
    expect(computeCutoffPercentile(0)).toBeCloseTo(0.40);
  });

  test("increases by 0.025 per trip", () => {
    expect(computeCutoffPercentile(4)).toBeCloseTo(0.50);
    expect(computeCutoffPercentile(8)).toBeCloseTo(0.60);
  });

  test("caps at 0.80", () => {
    expect(computeCutoffPercentile(16)).toBeCloseTo(0.80);
    expect(computeCutoffPercentile(100)).toBeCloseTo(0.80);
  });
});

describe("applySmartFilter", () => {
  test("returns empty array for empty input", () => {
    expect(applySmartFilter([], NO_HISTORY, 0, NOW)).toEqual([]);
  });

  test("returns all products when 0 trips (40% cutoff) and few products", () => {
    const products = [
      makeProduct({ product_id: "p1", name: "A", popularity_score: 0.9 }),
      makeProduct({ product_id: "p2", name: "B", popularity_score: 0.7 }),
      makeProduct({ product_id: "p3", name: "C", popularity_score: 0.5 }),
    ];
    const scored = buildScored(products);
    const result = applySmartFilter(scored, NO_HISTORY, 0, NOW);
    expect(result).toHaveLength(3);
  });

  test("never filters out products purchased within last 12 months", () => {
    const products = [
      makeProduct({ product_id: "p1", name: "Popular", popularity_score: 0.9 }),
      makeProduct({ product_id: "p2", name: "Unpopular but bought", popularity_score: 0.01 }),
      makeProduct({ product_id: "p3", name: "Unpopular", popularity_score: 0.02 }),
    ];
    const scored = buildScored(products);
    const history = historyWith([
      { product_id: "p2", months_ago: 3 },
    ]);

    const result = applySmartFilter(scored, history, 16, NOW);

    const ids = result.map((r) => r.product.product_id);
    expect(ids).toContain("p2");
  });

  test("does NOT protect products purchased more than 12 months ago", () => {
    const products = Array.from({ length: 20 }, (_, i) =>
      makeProduct({
        product_id: `p${i}`,
        name: `Prod ${i}`,
        popularity_score: (i + 1) / 20,
      }),
    );
    const scored = buildScored(products);
    const history = historyWith([
      { product_id: "p0", months_ago: 14 },
    ]);

    const result = applySmartFilter(scored, history, 16, NOW);
    const ids = result.map((r) => r.product.product_id);
    expect(ids).not.toContain("p0");
  });

  test("increases cutoff with more trips", () => {
    const products = Array.from({ length: 20 }, (_, i) =>
      makeProduct({
        product_id: `p${i}`,
        name: `Prod ${i}`,
        popularity_score: (i + 1) / 20,
      }),
    );
    const scored = buildScored(products);

    const resultNoTrips = applySmartFilter(scored, NO_HISTORY, 0, NOW);
    const resultManyTrips = applySmartFilter(scored, NO_HISTORY, 16, NOW);

    expect(resultManyTrips.length).toBeLessThan(resultNoTrips.length);
  });

  test("preserves original sort order", () => {
    const products = [
      makeProduct({ product_id: "p1", name: "A", popularity_score: 0.3 }),
      makeProduct({ product_id: "p2", name: "B", popularity_score: 0.9 }),
      makeProduct({ product_id: "p3", name: "C", popularity_score: 0.5 }),
    ];
    const scored = buildScored(products);
    const result = applySmartFilter(scored, NO_HISTORY, 0, NOW);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].totalScore).toBeGreaterThanOrEqual(result[i].totalScore);
    }
  });

  test("skips popularity cutoff when 3 or fewer non-purchased products remain", () => {
    const products = [
      makeProduct({ product_id: "p1", name: "A", popularity_score: 0.01 }),
      makeProduct({ product_id: "p2", name: "B", popularity_score: 0.02 }),
      makeProduct({ product_id: "p3", name: "C", popularity_score: 0.03 }),
    ];
    const scored = buildScored(products);
    const result = applySmartFilter(scored, NO_HISTORY, 16, NOW);

    expect(result).toHaveLength(3);
  });

  test("does not filter by user preferences (only popularity + purchase protection)", () => {
    const products = [
      makeProduct({ product_id: "p1", name: "Non-bio", is_bio: false, popularity_score: 0.8 }),
      makeProduct({ product_id: "p2", name: "Non-vegan", is_vegan: false, popularity_score: 0.7 }),
      makeProduct({ product_id: "p3", name: "Gluten", is_gluten_free: false, popularity_score: 0.6 }),
    ];
    const scored = buildScored(products);
    const result = applySmartFilter(scored, NO_HISTORY, 0, NOW);

    expect(result).toHaveLength(3);
  });

  test("at max cutoff (80%) keeps only top 20% plus purchased products", () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct({
        product_id: `p${i}`,
        name: `Prod ${i}`,
        popularity_score: (i + 1) / 10,
      }),
    );
    const scored = buildScored(products);
    const history = historyWith([
      { product_id: "p0", months_ago: 2 },
    ]);

    const result = applySmartFilter(scored, history, 100, NOW);
    const ids = result.map((r) => r.product.product_id);

    expect(ids).toContain("p0");
    expect(ids).toContain("p9");
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
