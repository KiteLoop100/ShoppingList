import { describe, test, expect } from "vitest";
import {
  isAldiProduct,
  isCompetitorProduct,
  getProductImages,
} from "../types";
import type { Product, CompetitorProduct } from "@/types";

const aldiProduct: Product = {
  product_id: "aldi-1",
  name: "Milka Schokolade",
  name_normalized: "milka schokolade",
  brand: "Milka",
  demand_group_code: "83",
  price: 1.29,
  price_updated_at: "2026-01-01",
  assortment_type: "daily_range",
  availability: "national",
  region: null,
  country: "DE",
  special_start_date: null,
  special_end_date: null,
  status: "active",
  source: "admin",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  thumbnail_url: "https://example.com/front.jpg",
  thumbnail_back_url: "https://example.com/back.jpg",
  ean_barcode: "4000417025005",
};

const competitorProduct: CompetitorProduct = {
  product_id: "comp-1",
  name: "Milka Alpine Milk",
  name_normalized: "milka alpine milk",
  brand: "Milka",
  ean_barcode: "4000417025005",
  article_number: null,
  weight_or_quantity: "100g",
  country: "DE",
  retailer: "EDEKA",
  thumbnail_url: "https://example.com/comp-front.jpg",
  other_photo_url: "https://example.com/comp-other.jpg",
  demand_group_code: "83",
  demand_sub_group: null,
  assortment_type: null,
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("isAldiProduct", () => {
  test("returns true for ALDI product", () => {
    expect(isAldiProduct(aldiProduct)).toBe(true);
  });

  test("returns false for competitor product", () => {
    expect(isAldiProduct(competitorProduct)).toBe(false);
  });
});

describe("isCompetitorProduct", () => {
  test("returns true for competitor product", () => {
    expect(isCompetitorProduct(competitorProduct)).toBe(true);
  });

  test("returns false for ALDI product", () => {
    expect(isCompetitorProduct(aldiProduct)).toBe(false);
  });
});

describe("getProductImages", () => {
  test("returns front + back images for ALDI product", () => {
    const images = getProductImages(aldiProduct);
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({ url: "https://example.com/front.jpg", label: "front" });
    expect(images[1]).toEqual({ url: "https://example.com/back.jpg", label: "back" });
  });

  test("returns front + other images for competitor product", () => {
    const images = getProductImages(competitorProduct);
    expect(images).toHaveLength(2);
    expect(images[0]).toEqual({ url: "https://example.com/comp-front.jpg", label: "front" });
    expect(images[1]).toEqual({ url: "https://example.com/comp-other.jpg", label: "other" });
  });

  test("returns empty array when no images", () => {
    const noImages = { ...aldiProduct, thumbnail_url: null, thumbnail_back_url: null };
    expect(getProductImages(noImages)).toHaveLength(0);
  });

  test("returns only front when back is missing", () => {
    const frontOnly = { ...aldiProduct, thumbnail_back_url: null };
    const images = getProductImages(frontOnly);
    expect(images).toHaveLength(1);
    expect(images[0].label).toBe("front");
  });
});
