import { describe, expect, test } from "vitest";
import { buildManualExtractedRecipe } from "@/lib/recipe/build-manual-extracted";
import { MANUAL_RECIPE_SOURCE_NAME } from "@/lib/recipe/constants";

describe("buildManualExtractedRecipe", () => {
  test("returns null when title is empty", () => {
    expect(
      buildManualExtractedRecipe({
        title: "   ",
        servings: 4,
        rows: [{ name: "Mehl", amount: 200, unit: "g" }],
      }),
    ).toBeNull();
  });

  test("returns null when no ingredient names", () => {
    expect(
      buildManualExtractedRecipe({
        title: "Kuchen",
        servings: 4,
        rows: [{ name: "  ", amount: 1, unit: "Stk" }],
      }),
    ).toBeNull();
  });

  test("builds ExtractedRecipe with null source_url and manual source", () => {
    const r = buildManualExtractedRecipe({
      title: "Omas Suppe",
      servings: 4,
      rows: [
        { name: "Kartoffeln", amount: 500, unit: "g" },
        { name: "Salz", amount: null, unit: "Prise" },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Omas Suppe");
    expect(r!.servings).toBe(4);
    expect(r!.servings_label).toBe("Portionen");
    expect(r!.source_url).toBeNull();
    expect(r!.source_name).toBe(MANUAL_RECIPE_SOURCE_NAME);
    expect(r!.prep_time_minutes).toBeNull();
    expect(r!.ingredients).toHaveLength(2);
    expect(r!.ingredients[1].amount).toBeNull();
  });

  test("clamps servings to 1–12", () => {
    const low = buildManualExtractedRecipe({
      title: "A",
      servings: 0,
      rows: [{ name: "X", amount: null, unit: "g" }],
    });
    expect(low!.servings).toBe(1);
    const high = buildManualExtractedRecipe({
      title: "A",
      servings: 99,
      rows: [{ name: "X", amount: null, unit: "g" }],
    });
    expect(high!.servings).toBe(12);
  });
});
