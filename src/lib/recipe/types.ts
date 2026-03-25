/**
 * Shared types for recipe URL import (F-RECIPE-IMPORT) and "What can I cook?" (F-RECIPE-COOK).
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Sections 4 (Shared Components) and 5 (Data Model)
 */

import type { Product } from "@/types";

/** Single ingredient line from a recipe or AI extraction. */
export interface RecipeIngredient {
  name: string;
  /** `null` for vague amounts ("nach Geschmack", "etwas"). */
  amount: number | null;
  /** Normalized unit (g, ml, Stück, EL, …); `null` if not applicable. */
  unit: string | null;
  /** Demand group / category hint for ALDI catalog matching. */
  category: string;
  /** Free-text hints, e.g. substitution notes from the source recipe. */
  notes: string;
  /** True when the source marks the ingredient as optional. */
  is_optional: boolean;
}

/** Parsed recipe payload after server-side URL extraction (before save). */
export interface ExtractedRecipe {
  title: string;
  servings: number;
  /** UI label from the source, e.g. "Portionen", "Stück", "Personen". */
  servings_label: string;
  ingredients: RecipeIngredient[];
  /** `null` for manual entry (Decision D7). */
  source_url: string | null;
  /** Human-readable site name, e.g. "Chefkoch", "BBC Good Food". */
  source_name: string;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  difficulty: "einfach" | "normal" | "anspruchsvoll" | null;
}

/** Row shape for `saved_recipes` (client ↔ Supabase). */
export interface SavedRecipe {
  id: string;
  user_id: string;
  title: string;
  /** `null` for AI-generated recipes with no external URL. */
  source_url: string | null;
  source_name: string;
  source_type: "url_import" | "ai_cook";
  original_servings: number;
  servings_label: string;
  ingredients: RecipeIngredient[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  /** Stored as plain text in DB; keep loose for forward compatibility. */
  difficulty: string | null;
  /** Kochschritte für ai_cook; `null` bei URL-Import. */
  instructions: string[] | null;
  aldi_adapted: boolean;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Result of mapping a recipe line to the ALDI (Hofer) catalog.
 * `aldi_product` uses the app-wide {@link Product} type (private-label and national assortment).
 */
export interface IngredientMatch {
  ingredient: RecipeIngredient;
  aldi_product: Product | null;
  /** 1 exact … 4 no ALDI equivalent; see {@link MATCH_TIER}. */
  match_tier: 1 | 2 | 3 | 4;
  /** Model or rules confidence in [0, 1]. */
  match_confidence: number;
  is_substitute: boolean;
  /** Shown when `is_substitute` is true, e.g. "Bauchspeck statt Guanciale". */
  substitute_note?: string;
}

/**
 * {@link IngredientMatch} plus pantry comparison when Nerd-Modus / inventory is active.
 * `sealed` / `opened` mirror `InventoryItem.status` in `@/lib/inventory/inventory-types`;
 * `not_present` means no matching inventory row for the resolved product.
 */
export interface PantryCheckResult extends IngredientMatch {
  in_pantry: boolean;
  pantry_status: "sealed" | "opened" | "not_present";
  /**
   * `null` when the pack is opened — the user must confirm whether the remaining amount is enough.
   */
  pantry_quantity_sufficient: boolean | null;
  /** Present when a quantity was resolved from inventory (same unit as recipe line where possible). */
  quantity_in_pantry?: number;
  quantity_needed: number;
  /** Amount still to buy; `0` when the pantry already covers the recipe. */
  quantity_to_buy: number;
  /** Step 3 (recipe import): user chose ALDI substitute vs buy original elsewhere. */
  review_substitute_choice?: "aldi" | "original";
  /** Step 3: add this unavailable line as free-text on the shopping list. */
  review_add_free_text?: boolean;
  /** Step 3: user excluded this buy row from the list (non-substitute toggles). */
  review_excluded_from_list?: boolean;
}

/** Response shape from `POST /api/recipe/match-ingredients`. */
export interface MatchIngredientsGrouped {
  available: PantryCheckResult[];
  to_buy: PantryCheckResult[];
  unavailable: PantryCheckResult[];
  needs_confirmation: PantryCheckResult[];
}

/** Structured model output from the cook assistant API. */
export interface AICookResponse {
  type: "suggestions" | "clarification" | "recipe_detail";
  message: string;
  suggestions: RecipeSuggestion[] | null;
  question: string | null;
  recipe: GeneratedRecipeDetail | null;
}

/** Compact recipe card in a multi-suggestion response. */
export interface RecipeSuggestion {
  title: string;
  time_minutes: number;
  ingredients_available: string[];
  ingredients_missing: string[];
  all_available: boolean;
}

/** Full recipe returned when the user opens a suggestion (steps + pantry-aware rows). */
export interface GeneratedRecipeDetail {
  title: string;
  servings: number;
  time_minutes: number;
  ingredients: RecipeIngredient[];
  /** Ordered cooking steps (HelloFresh-style). */
  steps: string[];
  pantry_matches: PantryCheckResult[];
}

/** Single turn in the cook chat transcript (persisted in `cook_conversations.messages`). */
export interface CookChatMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /**
   * Client-only: structured API payload for assistant bubbles (suggestions, clarification, recipe).
   * For API requests, serialize with `JSON.stringify` as `content` when sending history.
   */
  structuredResponse?: AICookResponse;
  /** Assistant bubble: rate limit or recoverable error UX. */
  messageKind?: "rate_limit" | "error";
}
