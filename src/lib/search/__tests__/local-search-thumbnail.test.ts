import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Product } from "@/types";

vi.mock("@/lib/settings/product-preferences", () => ({
  getProductPreferences: vi.fn(() => ({
    exclude_gluten: false, exclude_lactose: false, exclude_nuts: false,
    prefer_cheapest: false, prefer_brand: false, prefer_bio: false,
    prefer_vegan: false, prefer_animal_welfare: false,
  })),
}));

import { localSearch, clearSearchCache } from "../local-search";

const makeProduct = (overrides: Partial<Product> & { product_id: string; name: string }): Product => ({
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
  demand_group_code: "DG01",
  ...overrides,
});

describe("localSearch thumbnail_url propagation", () => {
  beforeEach(() => {
    clearSearchCache();
  });

  test("includes thumbnail_url when product has one", async () => {
    const products = [
      makeProduct({
        product_id: "p1",
        name: "Vollmilch 3.5% 1L",
        thumbnail_url: "https://example.supabase.co/storage/v1/object/public/product-thumbnails/p1.webp",
      }),
    ];

    const results = await localSearch({ query: "Vollmilch", products });

    expect(results).toHaveLength(1);
    expect(results[0].thumbnail_url).toBe(
      "https://example.supabase.co/storage/v1/object/public/product-thumbnails/p1.webp",
    );
  });

  test("sets thumbnail_url to null when product has no thumbnail", async () => {
    const products = [
      makeProduct({ product_id: "p2", name: "Butter 250g" }),
    ];

    const results = await localSearch({ query: "Butter", products });

    expect(results).toHaveLength(1);
    expect(results[0].thumbnail_url).toBeNull();
  });

  test("propagates thumbnail_url alongside product reference", async () => {
    const thumbUrl = "https://example.supabase.co/storage/v1/object/public/product-thumbnails/p3.webp";
    const products = [
      makeProduct({
        product_id: "p3",
        name: "Haferflocken 500g",
        thumbnail_url: thumbUrl,
      }),
    ];

    const results = await localSearch({ query: "Haferflocken", products });

    expect(results).toHaveLength(1);
    expect(results[0].thumbnail_url).toBe(thumbUrl);
    expect(results[0].product?.thumbnail_url).toBe(thumbUrl);
  });
});
