import { describe, expect, test } from "vitest";
import { quantityToBuyAsListPacks, recipeAmountToGramsOrMl } from "@/lib/recipe/list-pack-quantity";
import type { PantryCheckResult } from "@/lib/recipe/types";
import type { Product } from "@/types";

const baseProduct: Product = {
  product_id: "p1",
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
  created_at: "",
  updated_at: "",
  weight_or_quantity: "500 g",
};

function row(over: Partial<PantryCheckResult>): PantryCheckResult {
  return {
    ingredient: {
      name: "X",
      amount: 400,
      unit: "g",
      category: "c",
      notes: "",
      is_optional: false,
    },
    aldi_product: baseProduct,
    match_tier: 1,
    match_confidence: 1,
    is_substitute: false,
    in_pantry: false,
    pantry_status: "not_present",
    pantry_quantity_sufficient: false,
    quantity_needed: 400,
    quantity_to_buy: 400,
    ...over,
  };
}

describe("recipeAmountToGramsOrMl", () => {
  test("normalizes g and ml", () => {
    expect(recipeAmountToGramsOrMl(120, "g")).toBe(120);
    expect(recipeAmountToGramsOrMl(250, "ml")).toBe(250);
  });

  test("normalizes kg and l", () => {
    expect(recipeAmountToGramsOrMl(0.12, "kg")).toBe(120);
    expect(recipeAmountToGramsOrMl(2, "l")).toBe(2000);
  });
});

describe("quantityToBuyAsListPacks", () => {
  test("mass/volume: ceil(grams / pack size)", () => {
    expect(quantityToBuyAsListPacks(row({ quantity_to_buy: 400 }))).toBe(1);
    expect(quantityToBuyAsListPacks(row({ quantity_to_buy: 600 }))).toBe(2);
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 90,
          ingredient: {
            name: "Butter",
            amount: 90,
            unit: "g",
            category: "b",
            notes: "",
            is_optional: false,
          },
          aldi_product: { ...baseProduct, weight_or_quantity: "250 g" },
        }),
      ),
    ).toBe(1);
  });

  test("mass/volume: fallback 1 when pack size unknown", () => {
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 450,
          aldi_product: { ...baseProduct, weight_or_quantity: null },
        }),
      ),
    ).toBe(1);
  });

  test("count units: quantity_to_buy is pack count", () => {
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 4,
          ingredient: {
            name: "Tomaten",
            amount: 4,
            unit: "Dose",
            category: "v",
            notes: "",
            is_optional: false,
          },
        }),
      ),
    ).toBe(4);
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 2,
          ingredient: {
            name: "Milch",
            amount: 2,
            unit: "Flasche",
            category: "m",
            notes: "",
            is_optional: false,
          },
        }),
      ),
    ).toBe(2);
  });

  test("spoon/pinch: always 1 pack", () => {
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 3,
          ingredient: {
            name: "Salz",
            amount: 1,
            unit: "TL",
            category: "s",
            notes: "",
            is_optional: false,
          },
        }),
      ),
    ).toBe(1);
  });

  test("unknown unit: ceil as count", () => {
    expect(
      quantityToBuyAsListPacks(
        row({
          quantity_to_buy: 3,
          ingredient: {
            name: "?",
            amount: 3,
            unit: "Zehen",
            category: "x",
            notes: "",
            is_optional: false,
          },
        }),
      ),
    ).toBe(3);
  });
});
