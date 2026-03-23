import { describe, test, expect } from "vitest";
import { parseAmountPerPack, quantityNeeded } from "../ingredient-matcher-pantry";
import type { RecipeIngredient } from "../types";

describe("parseAmountPerPack", () => {
  test("parses grams", () => {
    expect(parseAmountPerPack("500 g")).toBe(500);
    expect(parseAmountPerPack("250g")).toBe(250);
  });

  test("parses kg to grams", () => {
    expect(parseAmountPerPack("1 kg")).toBe(1000);
    expect(parseAmountPerPack("0,5 kg")).toBe(500);
  });

  test("returns null for empty", () => {
    expect(parseAmountPerPack(null)).toBeNull();
    expect(parseAmountPerPack("")).toBeNull();
  });
});

describe("quantityNeeded", () => {
  test("uses amount when set", () => {
    const ing: RecipeIngredient = {
      name: "Mehl",
      amount: 400,
      unit: "g",
      category: "Backen",
      notes: "",
      is_optional: false,
    };
    expect(quantityNeeded(ing)).toBe(400);
  });

  test("returns 0 for null amount", () => {
    const ing: RecipeIngredient = {
      name: "Salz",
      amount: null,
      unit: null,
      category: "Gewürz",
      notes: "",
      is_optional: false,
    };
    expect(quantityNeeded(ing)).toBe(0);
  });
});
