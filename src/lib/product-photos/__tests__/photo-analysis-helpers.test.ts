import { describe, test, expect } from "vitest";
import {
  applyAutoFillAndDetectConflicts,
  buildPhotoAssignments,
  type ClassifiedPhoto,
} from "../photo-analysis-helpers";
import type { ExtractedProductInfo } from "@/lib/product-photo-studio/types";
import type { ProductCaptureValues } from "@/components/product-capture/hooks/use-product-capture-form";

function makeEmptyValues(): ProductCaptureValues {
  return {
    name: "", brand: "", retailer: "", customRetailer: "",
    demandGroupCode: "", demandSubGroup: "", ean: "", articleNumber: "",
    price: "", weightOrQuantity: "", assortmentType: "daily_range",
    isBio: false, isVegan: false, isGlutenFree: false, isLactoseFree: false,
    animalWelfareLevel: null,
  };
}

function makeExtracted(overrides: Partial<ExtractedProductInfo> = {}): ExtractedProductInfo {
  return {
    name: null, brand: null, ean_barcode: null, article_number: null,
    price: null, retailer_from_price_tag: null, unit_price: null,
    weight_or_quantity: null, ingredients: null, nutrition_info: null,
    allergens: null, nutri_score: null,
    is_bio: false, is_vegan: false, is_gluten_free: false, is_lactose_free: false,
    animal_welfare_level: null, country_of_origin: null,
    ...overrides,
  };
}

describe("applyAutoFillAndDetectConflicts", () => {
  test("fills empty fields from extraction", () => {
    const current = makeEmptyValues();
    const extracted = makeExtracted({ name: "Alpenmilch Schokolade", brand: "ALDI", price: 1.29 });
    const { updatedValues, conflicts } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(),
    );
    expect(updatedValues.name).toBe("Alpenmilch Schokolade");
    expect(updatedValues.brand).toBe("ALDI");
    expect(updatedValues.price).toBe("1,29");
    expect(conflicts).toHaveLength(0);
  });

  test("detects conflicts for non-empty fields", () => {
    const current = makeEmptyValues();
    current.name = "Milka Schokolade";
    current.price = "2,49";
    const extracted = makeExtracted({ name: "Alpenmilch", price: 1.29 });
    const { updatedValues, conflicts } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(),
    );
    expect(updatedValues.name).toBe("Milka Schokolade");
    expect(updatedValues.price).toBe("2,49");
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((c) => c.field)).toContain("name");
    expect(conflicts.map((c) => c.field)).toContain("price");
  });

  test("skips locked fields", () => {
    const current = makeEmptyValues();
    current.name = "Locked Name";
    const extracted = makeExtracted({ name: "AI Name" });
    const { conflicts } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(["name"]),
    );
    expect(conflicts).toHaveLength(0);
  });

  test("normalizes price for comparison (comma vs dot)", () => {
    const current = makeEmptyValues();
    current.price = "1,29";
    const extracted = makeExtracted({ price: 1.29 });
    const { conflicts } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(),
    );
    expect(conflicts).toHaveLength(0);
  });

  test("sets boolean flags from extraction", () => {
    const current = makeEmptyValues();
    const extracted = makeExtracted({ is_bio: true, is_vegan: true });
    const { updatedValues } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(),
    );
    expect(updatedValues.isBio).toBe(true);
    expect(updatedValues.isVegan).toBe(true);
  });

  test("fills animal welfare level when current is null", () => {
    const current = makeEmptyValues();
    const extracted = makeExtracted({ animal_welfare_level: 2 });
    const { updatedValues } = applyAutoFillAndDetectConflicts(
      extracted, current, new Set(),
    );
    expect(updatedValues.animalWelfareLevel).toBe(2);
  });
});

describe("buildPhotoAssignments", () => {
  test("maps classified photos to assignments", () => {
    const classified: ClassifiedPhoto[] = [
      { index: 0, category: "product", photo_type: "product_front", quality_score: 0.9, is_product_photo: true },
      { index: 1, category: "price_tag", photo_type: "price_tag", quality_score: 0.8, is_product_photo: false },
    ];
    const result = buildPhotoAssignments(classified, 0);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ index: 0, category: "product", isThumbnail: true });
    expect(result[1]).toEqual({ index: 1, category: "price_tag", isThumbnail: false });
  });

  test("handles null category for unclassified photos", () => {
    const classified: ClassifiedPhoto[] = [
      { index: 0, category: null, photo_type: "shelf", quality_score: 0.5, is_product_photo: false },
    ];
    const result = buildPhotoAssignments(classified, null);
    expect(result[0].category).toBeNull();
    expect(result[0].isThumbnail).toBe(false);
  });

  test("handles null suggested thumbnail index", () => {
    const classified: ClassifiedPhoto[] = [
      { index: 0, category: "product", photo_type: "product_back", quality_score: 0.7, is_product_photo: true },
    ];
    const result = buildPhotoAssignments(classified, null);
    expect(result[0].isThumbnail).toBe(false);
  });
});
