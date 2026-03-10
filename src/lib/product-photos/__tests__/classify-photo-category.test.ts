import { describe, test, expect } from "vitest";
import { toPhotoCategory, selectThumbnailIndex } from "../classify-photo-category";
import type { PhotoType } from "@/lib/product-photo-studio/types";

describe("toPhotoCategory", () => {
  test("maps product_front to product", () => {
    expect(toPhotoCategory("product_front")).toBe("product");
  });

  test("maps product_back to product", () => {
    expect(toPhotoCategory("product_back")).toBe("product");
  });

  test("maps product_side to product", () => {
    expect(toPhotoCategory("product_side")).toBe("product");
  });

  test("maps price_tag to price_tag", () => {
    expect(toPhotoCategory("price_tag")).toBe("price_tag");
  });

  test("returns null for shelf", () => {
    expect(toPhotoCategory("shelf")).toBeNull();
  });

  test("returns null for barcode", () => {
    expect(toPhotoCategory("barcode")).toBeNull();
  });

  test("returns null for other", () => {
    expect(toPhotoCategory("other")).toBeNull();
  });
});

describe("selectThumbnailIndex", () => {
  test("selects highest-quality product_front", () => {
    const photos: Array<{ photoType: PhotoType; qualityScore: number }> = [
      { photoType: "product_back", qualityScore: 0.9 },
      { photoType: "product_front", qualityScore: 0.7 },
      { photoType: "product_front", qualityScore: 0.95 },
    ];
    expect(selectThumbnailIndex(photos)).toBe(2);
  });

  test("falls back to product_side when no front", () => {
    const photos: Array<{ photoType: PhotoType; qualityScore: number }> = [
      { photoType: "product_back", qualityScore: 0.9 },
      { photoType: "product_side", qualityScore: 0.8 },
    ];
    expect(selectThumbnailIndex(photos)).toBe(1);
  });

  test("returns null when no candidate", () => {
    const photos: Array<{ photoType: PhotoType; qualityScore: number }> = [
      { photoType: "price_tag", qualityScore: 0.9 },
      { photoType: "barcode", qualityScore: 0.8 },
    ];
    expect(selectThumbnailIndex(photos)).toBeNull();
  });

  test("returns null for empty array", () => {
    expect(selectThumbnailIndex([])).toBeNull();
  });

  test("prefers higher quality among front and side", () => {
    const photos: Array<{ photoType: PhotoType; qualityScore: number }> = [
      { photoType: "product_front", qualityScore: 0.5 },
      { photoType: "product_side", qualityScore: 0.95 },
    ];
    expect(selectThumbnailIndex(photos)).toBe(1);
  });
});
