import { indexProducts } from "../search-indexer";
import { scoreForCatalog, type CatalogScoredProduct } from "../scoring-engine";
import type { UserProductPreference } from "../scoring-engine";
import type { ProductPreferences } from "@/lib/settings/product-preferences";
import type { Product } from "@/types";

function makeProduct(overrides: Partial<Product> & { product_id: string; name: string }): Product {
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
    ...overrides,
  };
}

const NO_PREFERENCES: ProductPreferences = {
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

describe("scoreForCatalog", () => {
  const products: Product[] = [
    makeProduct({ product_id: "p1", name: "Tomaten 500g", popularity_score: 0.9 }),
    makeProduct({ product_id: "p2", name: "Paprika rot", popularity_score: 0.3 }),
    makeProduct({ product_id: "p3", name: "Zucchini 500g", popularity_score: 0.1 }),
  ];

  const indexed = indexProducts(products);

  test("returns products sorted by totalScore descending", () => {
    const result = scoreForCatalog(indexed, NO_PREFERENCES, NO_HISTORY);

    expect(result).toHaveLength(3);
    expect(result[0].product.product_id).toBe("p1");
    expect(result[1].product.product_id).toBe("p2");
    expect(result[2].product.product_id).toBe("p3");

    expect(result[0].totalScore).toBeGreaterThan(result[1].totalScore);
    expect(result[1].totalScore).toBeGreaterThan(result[2].totalScore);
  });

  test("all scored products have non-negative scores", () => {
    const result = scoreForCatalog(indexed, NO_PREFERENCES, NO_HISTORY);
    for (const item of result) {
      expect(item.totalScore).toBeGreaterThanOrEqual(0);
      expect(item.popularityScore).toBeGreaterThanOrEqual(0);
      expect(item.personalScore).toBeGreaterThanOrEqual(0);
      expect(item.preferenceScore).toBeGreaterThanOrEqual(0);
      expect(item.freshnessScore).toBeGreaterThanOrEqual(0);
    }
  });

  test("products with purchase history rank higher", () => {
    const history = new Map<string, UserProductPreference>([
      ["p3", { product_id: "p3", purchase_count: 10, last_purchased_at: new Date().toISOString() }],
    ]);

    const result = scoreForCatalog(indexed, NO_PREFERENCES, history);

    const p3 = result.find((r) => r.product.product_id === "p3")!;
    expect(p3.personalScore).toBeGreaterThan(0);

    const p3NoHistory = scoreForCatalog(indexed, NO_PREFERENCES, NO_HISTORY)
      .find((r) => r.product.product_id === "p3")!;
    expect(p3.totalScore).toBeGreaterThan(p3NoHistory.totalScore);
  });

  test("bio preference boosts bio products", () => {
    const bioProducts = indexProducts([
      makeProduct({ product_id: "bio1", name: "Bio Tomaten", is_bio: true, popularity_score: 0.5 }),
      makeProduct({ product_id: "reg1", name: "Tomaten Standard", is_bio: false, popularity_score: 0.5 }),
    ]);

    const prefs: ProductPreferences = { ...NO_PREFERENCES, prefer_bio: true };
    const result = scoreForCatalog(bioProducts, prefs, NO_HISTORY);

    const bio = result.find((r) => r.product.product_id === "bio1")!;
    const reg = result.find((r) => r.product.product_id === "reg1")!;
    expect(bio.preferenceScore).toBeGreaterThan(reg.preferenceScore);
    expect(bio.totalScore).toBeGreaterThan(reg.totalScore);
  });

  test("active specials get freshness boost", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const specialProducts = indexProducts([
      makeProduct({
        product_id: "sp1",
        name: "Aktions-Kartoffeln",
        assortment_type: "special_food",
        special_start_date: yesterday.toISOString(),
        special_end_date: nextWeek.toISOString(),
        popularity_score: 0.5,
      }),
      makeProduct({
        product_id: "reg1",
        name: "Kartoffeln Normal",
        popularity_score: 0.5,
      }),
    ]);

    const result = scoreForCatalog(specialProducts, NO_PREFERENCES, NO_HISTORY, today);

    const special = result.find((r) => r.product.product_id === "sp1")!;
    const regular = result.find((r) => r.product.product_id === "reg1")!;
    expect(special.freshnessScore).toBeGreaterThan(regular.freshnessScore);
  });

  test("handles empty product array", () => {
    const result = scoreForCatalog([], NO_PREFERENCES, NO_HISTORY);
    expect(result).toHaveLength(0);
  });

  test("products with same score are sorted alphabetically by search_name", () => {
    const sameScoreProducts = indexProducts([
      makeProduct({ product_id: "a", name: "Zucchini", popularity_score: 0.5 }),
      makeProduct({ product_id: "b", name: "Aubergine", popularity_score: 0.5 }),
    ]);

    const result = scoreForCatalog(sameScoreProducts, NO_PREFERENCES, NO_HISTORY);
    expect(result[0].product.search_name.localeCompare(result[1].product.search_name, "de"))
      .toBeLessThanOrEqual(0);
  });
});
