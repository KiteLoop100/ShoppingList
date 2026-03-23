import { describe, expect, test } from "vitest";
import { scaleIngredients } from "@/lib/recipe/servings-scaler";
import type { RecipeIngredient } from "@/lib/recipe/types";

function ing(partial: Partial<RecipeIngredient> & Pick<RecipeIngredient, "name">): RecipeIngredient {
  return {
    name: partial.name,
    amount: partial.amount ?? null,
    unit: partial.unit ?? null,
    category: partial.category ?? "",
    notes: partial.notes ?? "",
    is_optional: partial.is_optional ?? false,
  };
}

describe("scaleIngredients", () => {
  test("returns new array and does not mutate original", () => {
    const base: RecipeIngredient[] = [ing({ name: "Mehl", amount: 200, unit: "g", category: "" })];
    const out = scaleIngredients(base, 4, 8);
    expect(out).not.toBe(base);
    expect(out[0].amount).toBe(400);
    expect(base[0].amount).toBe(200);
  });

  test("passes through amount === null unchanged", () => {
    const base: RecipeIngredient[] = [ing({ name: "Salz", amount: null, unit: null, category: "" })];
    const out = scaleIngredients(base, 4, 8);
    expect(out[0].amount).toBeNull();
  });

  test("does not scale Prise / Msp", () => {
    const base: RecipeIngredient[] = [
      ing({ name: "Salz", amount: 1, unit: "Prise", category: "" }),
      ing({ name: "Pfeffer", amount: 2, unit: "Msp", category: "" }),
    ];
    const out = scaleIngredients(base, 4, 8);
    expect(out[0].amount).toBe(1);
    expect(out[1].amount).toBe(2);
  });

  test("scales Stück with round and minimum 1", () => {
    const base: RecipeIngredient[] = [ing({ name: "Eier", amount: 3, unit: "Stk", category: "" })];
    expect(scaleIngredients(base, 4, 4)[0].amount).toBe(3);
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(6);
    expect(scaleIngredients(base, 4, 2)[0].amount).toBe(2);
  });

  test("grams: rounds to 10s above 200g after scale", () => {
    const base: RecipeIngredient[] = [ing({ name: "Nudeln", amount: 500, unit: "g", category: "" })];
    // 500 * (8/4) = 1000 → >200 → 10er
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(1000);
    const base2 = [ing({ name: "Mehl", amount: 333, unit: "g", category: "" })];
    // 333 * 2 = 666 → round to 670
    expect(scaleIngredients(base2, 4, 8)[0].amount).toBe(670);
  });

  test("grams: 50–200 uses 5g steps", () => {
    const base: RecipeIngredient[] = [ing({ name: "Butter", amount: 75, unit: "g", category: "" })];
    // 75 * 2 = 150 → in 50–200 → 5er → 150
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(150);
  });

  test("grams: below 50 rounds to 1g", () => {
    const base: RecipeIngredient[] = [ing({ name: "Hefe", amount: 21, unit: "g", category: "" })];
    // 21 * 2 = 42
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(42);
  });

  test("ml: same bands as g", () => {
    const base: RecipeIngredient[] = [ing({ name: "Milch", amount: 180, unit: "ml", category: "" })];
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(360);
  });

  test("EL / TL: rounds to 0.5, minimum 0.5", () => {
    const el = [ing({ name: "Öl", amount: 3, unit: "EL", category: "" })];
    expect(scaleIngredients(el, 4, 2)[0].amount).toBe(1.5);
    const tl = [ing({ name: "Backpulver", amount: 0.5, unit: "TL", category: "" })];
    expect(scaleIngredients(tl, 4, 8)[0].amount).toBe(1);
    const tiny = [ing({ name: "X", amount: 0.25, unit: "TL", category: "" })];
    expect(scaleIngredients(tiny, 4, 4)[0].amount).toBe(0.5);
  });

  test("kg scales via gram rounding then back to kg", () => {
    const base: RecipeIngredient[] = [ing({ name: "Mehl", amount: 0.5, unit: "kg", category: "" })];
    // 0.5 * 2 = 1 kg → 1000g → roundGrams → 1000 → 1
    expect(scaleIngredients(base, 4, 8)[0].amount).toBe(1);
  });
});
