import { indexProduct, indexProducts } from "../search-indexer";
import { findCandidates } from "../candidate-retrieval";
import { MatchType } from "../constants";
import type { Product } from "@/types";

function makeProduct(overrides: Partial<Product> & { product_id: string; name: string }): Product {
  return {
    name_normalized: overrides.name.toLowerCase(),
    brand: null,
    price: 1.99,
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
    demand_group_code: "MP",
    popularity_score: 0.5,
    ...overrides,
  };
}

describe("Per-product alias search matching", () => {
  const products = indexProducts([
    makeProduct({
      product_id: "haferdrink-1",
      name: "Milsani Haferdrink 1l",
      aliases: ["Hafermilch", "Oat Milk"],
    }),
    makeProduct({
      product_id: "vollmilch-1",
      name: "Milsani Frische Vollmilch 1l",
      aliases: ["H-Milch", "Kuhmilch"],
    }),
    makeProduct({
      product_id: "no-alias",
      name: "Butter 250g",
      aliases: null,
    }),
    makeProduct({
      product_id: "empty-alias",
      name: "Joghurt Natur 500g",
      aliases: [],
    }),
  ]);

  test("exact alias match finds the product", () => {
    const candidates = findCandidates("hafermilch", products);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("haferdrink-1");
  });

  test("partial alias match finds the product", () => {
    const candidates = findCandidates("oat", products);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("haferdrink-1");
  });

  test("exact alias gets BRAND_MATCH when no name/global-alias match exists", () => {
    const isolatedProducts = indexProducts([
      makeProduct({
        product_id: "unique-alias",
        name: "Spezialmilch Typ A",
        aliases: ["Testbegriff"],
      }),
    ]);
    const candidates = findCandidates("testbegriff", isolatedProducts);
    const match = candidates.find((c) => c.product.product_id === "unique-alias");
    expect(match).toBeDefined();
    expect(match!.matchType).toBe(MatchType.BRAND_MATCH);
  });

  test("name match takes priority over alias match", () => {
    const candidates = findCandidates("haferdrink", products);
    const haferdrink = candidates.find((c) => c.product.product_id === "haferdrink-1");
    expect(haferdrink).toBeDefined();
    expect(haferdrink!.matchType).toBeLessThan(MatchType.BRAND_MATCH);
  });

  test("product with null aliases does not cause errors", () => {
    const candidates = findCandidates("butter", products);
    const butter = candidates.find((c) => c.product.product_id === "no-alias");
    expect(butter).toBeDefined();
  });

  test("product with empty aliases array does not cause errors", () => {
    const candidates = findCandidates("joghurt", products);
    const joghurt = candidates.find((c) => c.product.product_id === "empty-alias");
    expect(joghurt).toBeDefined();
  });

  test("alias words are not mixed into search_name_words", () => {
    const indexed = indexProduct(
      makeProduct({
        product_id: "test",
        name: "Bio Haferdrink",
        aliases: ["Hafermilch"],
      }),
    );
    expect(indexed.search_name_words).not.toContain("hafermilch");
    expect(indexed.search_aliases_normalized).toContain("hafermilch");
  });

  test("multiple aliases on different products resolve correctly", () => {
    const candidates = findCandidates("kuhmilch", products);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("vollmilch-1");
    expect(ids).not.toContain("haferdrink-1");
  });
});
