import type { ExtractedRecipe, SavedRecipe } from "@/lib/recipe/types";

function mapDifficulty(raw: string | null): ExtractedRecipe["difficulty"] {
  if (raw === "einfach" || raw === "normal" || raw === "anspruchsvoll") {
    return raw;
  }
  return null;
}

/**
 * Maps a persisted row to the shape used by recipe import Step 2 (preview).
 */
export function savedRecipeToExtracted(saved: SavedRecipe): ExtractedRecipe {
  return {
    title: saved.title,
    servings: Math.max(1, saved.original_servings),
    servings_label: saved.servings_label,
    ingredients: saved.ingredients,
    source_url: saved.source_url?.trim() ? saved.source_url.trim() : null,
    source_name: saved.source_name,
    prep_time_minutes: saved.prep_time_minutes,
    cook_time_minutes: saved.cook_time_minutes,
    difficulty: mapDifficulty(saved.difficulty),
  };
}
