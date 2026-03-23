/**
 * Builds {@link ExtractedRecipe} from manual ingredient entry (Decision D7).
 */
import type { ExtractedRecipe, RecipeIngredient } from "@/lib/recipe/types";
import { MANUAL_RECIPE_SOURCE_NAME } from "@/lib/recipe/constants";

export type ManualIngredientRow = {
  name: string;
  amount: number | null;
  unit: string | null;
};

export function buildManualExtractedRecipe(params: {
  title: string;
  servings: number;
  rows: ManualIngredientRow[];
}): ExtractedRecipe | null {
  const title = params.title.trim();
  if (!title) return null;

  const servings = Math.max(1, Math.min(12, Math.round(params.servings)));
  const ingredients: RecipeIngredient[] = [];
  for (const r of params.rows) {
    const name = r.name.trim();
    if (!name) continue;
    ingredients.push({
      name,
      amount: r.amount,
      unit: r.unit,
      category: "",
      notes: "",
      is_optional: false,
    });
  }

  if (ingredients.length === 0) return null;

  return {
    title,
    servings,
    servings_label: "Portionen",
    ingredients,
    source_url: null,
    source_name: MANUAL_RECIPE_SOURCE_NAME,
    prep_time_minutes: null,
    cook_time_minutes: null,
    difficulty: null,
  };
}
