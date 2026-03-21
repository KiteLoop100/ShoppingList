import { describe, test, expect } from "vitest";
import type { Product } from "@/types";
import { buildProductMaps, computeActivationTime } from "../list-data-helpers";

function mockProduct(id: string, overrides: Partial<Product> = {}): Product {
  return {
    product_id: id,
    name: "Test",
    name_normalized: "test",
    brand: null,
    demand_group_code: "AK",
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
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeActivationTime", () => {
  test("returns activation timestamp for DE (Europe/Berlin)", () => {
    const ts = computeActivationTime("2026-03-09", "DE");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("returns activation timestamp for AT (Europe/Vienna)", () => {
    const ts = computeActivationTime("2026-03-09", "AT");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("returns activation timestamp for NZ (Pacific/Auckland)", () => {
    const ts = computeActivationTime("2026-03-09", "NZ");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("NZ activation differs from DE due to timezone offset", () => {
    const tsDE = computeActivationTime("2026-03-09", "DE");
    const tsNZ = computeActivationTime("2026-03-09", "NZ");
    expect(tsNZ).not.toBe(tsDE);
  });

  test("unknown country falls back to Europe/Berlin (same as DE)", () => {
    const tsDE = computeActivationTime("2026-03-09", "DE");
    const tsUnknown = computeActivationTime("2026-03-09", "XX");
    expect(tsUnknown).toBe(tsDE);
  });
});

describe("buildProductMaps", () => {
  test("context product without thumbnail clears stale idb thumb from map", () => {
    const idb = [mockProduct("p1", { thumbnail_url: "https://example.com/old.jpg" })];
    const ctx = [mockProduct("p1", { thumbnail_url: null })];
    const { productThumbnailMap } = buildProductMaps(idb, ctx);
    expect(productThumbnailMap.has("p1")).toBe(false);
  });

  test("context product with thumbnail overwrites idb", () => {
    const idb = [mockProduct("p1", { thumbnail_url: "https://example.com/old.jpg" })];
    const ctx = [mockProduct("p1", { thumbnail_url: "https://example.com/new.jpg" })];
    const { productThumbnailMap } = buildProductMaps(idb, ctx);
    expect(productThumbnailMap.get("p1")).toBe("https://example.com/new.jpg");
  });

  test("idb-only thumb remains when product not in context array", () => {
    const idb = [mockProduct("p1", { thumbnail_url: "https://example.com/only-idb.jpg" })];
    const ctx: Product[] = [];
    const { productThumbnailMap } = buildProductMaps(idb, ctx);
    expect(productThumbnailMap.get("p1")).toBe("https://example.com/only-idb.jpg");
  });
});
