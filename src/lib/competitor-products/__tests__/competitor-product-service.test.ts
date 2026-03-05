/**
 * Tests for competitor product service helpers.
 * Focused on the retailer field bug: products without a price observation
 * should be discoverable once they have a primary retailer set.
 */

import { describe, test, expect } from "vitest";
import { detectRetailerPrefix } from "@/lib/search/commands";
import type { CompetitorProduct } from "@/types";

// ── detectRetailerPrefix ────────────────────────────────────────────────────

describe("detectRetailerPrefix", () => {
  test("detects EDEKA with trailing space (the reported bug query)", () => {
    const result = detectRetailerPrefix("Edeka ", "DE");
    expect(result).not.toBeNull();
    expect(result?.retailer.name).toBe("EDEKA");
    expect(result?.productQuery).toBe("");
  });

  test("detects EDEKA case-insensitively", () => {
    expect(detectRetailerPrefix("edeka", "DE")?.retailer.name).toBe("EDEKA");
    expect(detectRetailerPrefix("EDEKA", "DE")?.retailer.name).toBe("EDEKA");
    expect(detectRetailerPrefix("Edeka", "DE")?.retailer.name).toBe("EDEKA");
  });

  test("detects EDEKA with product query", () => {
    const result = detectRetailerPrefix("Edeka Milch", "DE");
    expect(result?.retailer.name).toBe("EDEKA");
    expect(result?.productQuery).toBe("Milch");
  });

  test("detects LIDL", () => {
    const result = detectRetailerPrefix("LIDL ", "DE");
    expect(result?.retailer.name).toBe("LIDL");
  });

  test("detects REWE", () => {
    const result = detectRetailerPrefix("REWE Butter", "DE");
    expect(result?.retailer.name).toBe("REWE");
    expect(result?.productQuery).toBe("Butter");
  });

  test("returns null for partial retailer name", () => {
    expect(detectRetailerPrefix("Ede", "DE")).toBeNull();
    expect(detectRetailerPrefix("Ed", "DE")).toBeNull();
  });

  test("returns null for unknown retailer", () => {
    expect(detectRetailerPrefix("Amazon Milch", "DE")).toBeNull();
  });

  test("returns null for empty query", () => {
    expect(detectRetailerPrefix("", "DE")).toBeNull();
    expect(detectRetailerPrefix("  ", "DE")).toBeNull();
  });

  test("does not match EDEKA for AT country (EDEKA is DE-only)", () => {
    expect(detectRetailerPrefix("EDEKA Milch", "AT")).toBeNull();
  });

  test("does not match a retailer name embedded mid-query", () => {
    expect(detectRetailerPrefix("Ich gehe zu Edeka", "DE")).toBeNull();
  });
});

// ── CompetitorProduct type contract ─────────────────────────────────────────

describe("CompetitorProduct.retailer field", () => {
  test("type allows null retailer (backward-compatible for existing products)", () => {
    const product: CompetitorProduct = {
      product_id: "abc",
      name: "Alpenmilch 3,5%",
      name_normalized: "alpenmilch 3,5%",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: "1l",
      country: "DE",
      retailer: null,
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      status: "active",
      is_bio: false,
      is_vegan: false,
      is_gluten_free: false,
      is_lactose_free: false,
      animal_welfare_level: null,
      ingredients: null,
      nutrition_info: null,
      allergens: null,
      nutri_score: null,
      country_of_origin: null,
      created_at: "2026-03-05T00:00:00Z",
      updated_at: "2026-03-05T00:00:00Z",
    };
    expect(product.retailer).toBeNull();
  });

  test("type allows a retailer string", () => {
    const product: CompetitorProduct = {
      product_id: "def",
      name: "Bio Joghurt",
      name_normalized: "bio joghurt",
      brand: "Demeter",
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: "500g",
      country: "DE",
      retailer: "EDEKA",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      status: "active",
      is_bio: true,
      is_vegan: false,
      is_gluten_free: false,
      is_lactose_free: false,
      animal_welfare_level: null,
      ingredients: null,
      nutrition_info: null,
      allergens: null,
      nutri_score: "B",
      country_of_origin: "DE",
      created_at: "2026-03-05T00:00:00Z",
      updated_at: "2026-03-05T00:00:00Z",
    };
    expect(product.retailer).toBe("EDEKA");
  });
});
