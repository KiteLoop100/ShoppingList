/**
 * Ingredient → ALDI catalog matching (F-RECIPE) + optional pantry comparison.
 * @see specs/F-RECIPE-FEATURES-SPEC.md — §2.3, §4.1
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import { callClaude, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";
import { buildCatalogPayload, getRelevantProducts } from "./ingredient-matcher-catalog";
import { checkPantry } from "./ingredient-matcher-pantry";
import type { IngredientMatch, RecipeIngredient } from "./types";

/** Default Claude client timeout is 30s; 500-product JSON + many ingredients often needs longer. */
const RECIPE_MATCH_CLAUDE_TIMEOUT_MS = 180_000;

export type { PantryCheckResult } from "./types";
export { getRelevantProducts } from "./ingredient-matcher-catalog";
export { checkPantry, parseAmountPerPack, quantityNeeded } from "./ingredient-matcher-pantry";

export interface MatchOptions {
  aldi_mode: boolean;
  country: "DE" | "AT";
  check_pantry: boolean;
  user_id?: string;
}

interface ClaudeMatchRow {
  ingredient_index: number;
  product_id: string | null;
  product_name: string | null;
  match_tier: number;
  match_confidence: number;
  is_substitute: boolean;
  substitute_note: string;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function tierOr4(n: unknown): 1 | 2 | 3 | 4 {
  const t = typeof n === "number" ? Math.round(n) : Number.parseInt(String(n), 10);
  if (t === 1 || t === 2 || t === 3 || t === 4) return t;
  return 4;
}

function systemPrompt(country: "DE" | "AT"): string {
  const label = country === "AT" ? "Hofer/ALDI Österreich" : "ALDI Süd";
  return [
    `Du bist ein Experte für ${label}-Produkte in ${country}.`,
    "Ordne die folgenden Rezept-Zutaten den passendsten ALDI-Produkten zu.",
    "",
    "Für jede Zutat bestimme:",
    "- match_tier: 1 (exakt), 2 (gleiche Kategorie), 3 (Ersatzprodukt), 4 (nicht verfügbar)",
    "- Das passendste ALDI-Produkt (product_id und name)",
    "- match_confidence: 0.0-1.0",
    "- is_substitute: true/false",
    "- substitute_note: Erklärung wenn Ersatzprodukt (deutsch)",
    "",
    "Antworte NUR mit validem JSON-Array, ohne Markdown:",
    "[",
    "  {",
    '    "ingredient_index": 0,',
    '    "product_id": "uuid-hier" oder null,',
    '    "product_name": "ALDI Produktname" oder null,',
    '    "match_tier": 1,',
    '    "match_confidence": 0.95,',
    '    "is_substitute": false,',
    '    "substitute_note": ""',
    "  }",
    "]",
  ].join("\n");
}

function matchRowToIngredientMatch(
  ing: RecipeIngredient,
  row: ClaudeMatchRow | undefined,
  productById: Map<string, Product>,
): IngredientMatch {
  if (!row) {
    return {
      ingredient: ing,
      aldi_product: null,
      match_tier: 4,
      match_confidence: 0,
      is_substitute: false,
    };
  }
  const tier = tierOr4(row.match_tier);
  const pid = row.product_id && productById.has(row.product_id) ? row.product_id : null;
  const product = pid ? productById.get(pid)! : null;
  const effectiveTier = pid ? tier : 4;
  return {
    ingredient: ing,
    aldi_product: effectiveTier === 4 ? null : product,
    match_tier: effectiveTier,
    match_confidence: clamp01(row.match_confidence),
    is_substitute: Boolean(row.is_substitute) && effectiveTier !== 4,
    substitute_note: row.substitute_note?.trim() || undefined,
  };
}

function applyAldiMode(match: IngredientMatch): IngredientMatch {
  if (match.match_tier !== 3) return match;
  return {
    ...match,
    aldi_product: null,
    match_tier: 4,
    is_substitute: false,
    substitute_note: undefined,
  };
}

/**
 * Maps recipe lines to catalog products using one Claude request and a cached catalog slice.
 */
export async function matchAllIngredients(
  supabase: SupabaseClient,
  ingredients: RecipeIngredient[],
  options: MatchOptions,
): Promise<IngredientMatch[]> {
  if (ingredients.length === 0) return [];

  const products = await getRelevantProducts(supabase, options.country);
  const productById = new Map(products.map((p) => [p.product_id, p]));
  const catalogJson = JSON.stringify(buildCatalogPayload(products));
  const ingredientsJson = JSON.stringify(
    ingredients.map((ing, i) => ({
      index: i,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      category: ing.category,
      notes: ing.notes,
      is_optional: ing.is_optional,
    })),
  );

  let rows: ClaudeMatchRow[] = [];
  try {
    const claudeOptions = {
      system: systemPrompt(options.country),
      messages: [
        {
          role: "user" as const,
          content: `Zutaten: ${ingredientsJson}\n\nALDI-Produktkatalog: ${catalogJson}`,
        },
      ],
      max_tokens: 8192,
      temperature: 0.2,
    };
    const rawClaudeText = await callClaude({
      ...claudeOptions,
      timeoutMs: RECIPE_MATCH_CLAUDE_TIMEOUT_MS,
    });
    rows = parseClaudeJsonResponse<ClaudeMatchRow[]>(rawClaudeText);
    if (!Array.isArray(rows)) rows = [];
  } catch (e) {
    log.error("[ingredient-matcher] Claude match failed:", e);
    rows = [];
  }

  const byIndex = new Map<number, ClaudeMatchRow>();
  for (const r of rows) {
    if (typeof r.ingredient_index === "number" && r.ingredient_index >= 0) {
      byIndex.set(r.ingredient_index, r);
    }
  }

  return ingredients.map((ing, i) => {
    const raw = matchRowToIngredientMatch(ing, byIndex.get(i), productById);
    return options.aldi_mode ? raw : applyAldiMode(raw);
  });
}
