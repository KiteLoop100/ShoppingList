import { describe, expect, test } from "vitest";
import { savedRecipeToExtracted } from "@/lib/recipe/saved-recipe-mapper";
import type { SavedRecipe } from "@/lib/recipe/types";

const base: SavedRecipe = {
  id: "a",
  user_id: "u",
  title: "Test",
  source_url: "https://www.chefkoch.de/r/1",
  source_name: "Chefkoch",
  source_type: "url_import",
  original_servings: 4,
  servings_label: "Portionen",
  ingredients: [
    {
      name: "Nudeln",
      amount: 400,
      unit: "g",
      category: "Nudeln",
      notes: "",
      is_optional: false,
    },
  ],
  prep_time_minutes: 10,
  cook_time_minutes: 20,
  difficulty: "normal",
  aldi_adapted: true,
  created_at: new Date().toISOString(),
  last_used_at: null,
};

describe("savedRecipeToExtracted", () => {
  test("maps url_import to ExtractedRecipe", () => {
    const ex = savedRecipeToExtracted(base);
    expect(ex.title).toBe("Test");
    expect(ex.servings).toBe(4);
    expect(ex.source_url).toContain("chefkoch");
    expect(ex.difficulty).toBe("normal");
  });

  test("maps unknown difficulty to null", () => {
    const ex = savedRecipeToExtracted({ ...base, difficulty: "weird" });
    expect(ex.difficulty).toBeNull();
  });

  test("maps null source_url to null in ExtractedRecipe", () => {
    const ex = savedRecipeToExtracted({
      ...base,
      source_url: null,
      source_type: "ai_cook",
    });
    expect(ex.source_url).toBeNull();
  });
});
