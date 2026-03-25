import { describe, expect, test } from "vitest";
import { saveRecipeBodySchema } from "@/lib/recipe/save-recipe-body-schema";

const minimalValid = {
  title: "Test",
  source_url: "https://example.com/r" as const,
  source_name: "Ex",
  source_type: "url_import" as const,
  original_servings: 4,
  servings_label: "Portionen",
  ingredients: [
    {
      name: "X",
      amount: 1,
      unit: "g",
      category: "",
      notes: "",
      is_optional: false,
    },
  ],
  prep_time_minutes: null,
  cook_time_minutes: null,
  difficulty: null,
  aldi_adapted: false,
};

describe("saveRecipeBodySchema", () => {
  test("accepts omitted instructions (URL import)", () => {
    const r = saveRecipeBodySchema.safeParse(minimalValid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.instructions).toBeUndefined();
  });

  test("accepts explicit null instructions", () => {
    const r = saveRecipeBodySchema.safeParse({ ...minimalValid, instructions: null });
    expect(r.success).toBe(true);
  });

  test("accepts instructions array for ai_cook saves", () => {
    const r = saveRecipeBodySchema.safeParse({
      ...minimalValid,
      source_url: null,
      source_type: "ai_cook",
      instructions: ["Schritt 1", "Schritt 2"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.instructions).toEqual(["Schritt 1", "Schritt 2"]);
  });

  test("rejects ai_cook with non-null source_url", () => {
    const r = saveRecipeBodySchema.safeParse({
      ...minimalValid,
      source_type: "ai_cook",
      source_url: "https://example.com",
    });
    expect(r.success).toBe(false);
  });
});
