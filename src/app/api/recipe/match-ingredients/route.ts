import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, claudeRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import {
  checkPantry,
  matchAllIngredients,
  quantityNeeded,
} from "@/lib/recipe/ingredient-matcher";
import type { IngredientMatch, PantryCheckResult } from "@/lib/recipe/types";
import { log } from "@/lib/utils/logger";

/** Claude match can exceed 60s (large catalog JSON + long model latency). */
export const maxDuration = 300;

const recipeIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string(),
  notes: z.string(),
  is_optional: z.boolean(),
});

const bodySchema = z
  .object({
    ingredients: z.array(recipeIngredientSchema).min(1).max(50),
    aldi_mode: z.boolean(),
    country: z.enum(["DE", "AT"]),
    check_pantry: z.boolean(),
  })
  .strict();

function matchToStubPantry(m: IngredientMatch): PantryCheckResult {
  const need = quantityNeeded(m.ingredient);
  return {
    ...m,
    in_pantry: false,
    pantry_status: "not_present",
    pantry_quantity_sufficient: false,
    quantity_needed: need,
    quantity_to_buy: m.ingredient.amount === null ? 0 : need,
  };
}

function groupPantryResults(results: PantryCheckResult[]) {
  const unavailable = results.filter((r) => r.match_tier === 4 || !r.aldi_product);
  const needs_confirmation = results.filter(
    (r) =>
      r.match_tier < 4 &&
      !!r.aldi_product &&
      r.in_pantry &&
      r.pantry_status === "opened" &&
      r.pantry_quantity_sufficient === null,
  );
  const available = results.filter(
    (r) =>
      r.match_tier < 4 &&
      !!r.aldi_product &&
      r.in_pantry &&
      r.pantry_quantity_sufficient === true,
  );
  const to_buy = results.filter((r) => {
    if (r.match_tier === 4 || !r.aldi_product) return false;
    if (r.in_pantry && r.pantry_status === "opened" && r.pantry_quantity_sufficient === null) {
      return false;
    }
    if (r.in_pantry && r.pantry_quantity_sufficient === true) return false;
    return true;
  });
  return { available, to_buy, unavailable, needs_confirmation };
}

function groupWithoutPantry(matches: IngredientMatch[]) {
  const stubs = matches.map(matchToStubPantry);
  const unavailable = stubs.filter((r) => r.match_tier === 4 || !r.aldi_product);
  const available = stubs.filter(
    (r) => r.match_tier < 4 && !!r.aldi_product && r.ingredient.amount === null,
  );
  const to_buy = stubs.filter((r) => {
    if (r.match_tier === 4 || !r.aldi_product) return false;
    if (r.ingredient.amount === null) return false;
    return true;
  });
  return {
    available,
    to_buy,
    unavailable,
    needs_confirmation: [] as PantryCheckResult[],
  };
}

export async function POST(request: Request) {
  const validated = await validateBody(request, bodySchema);
  if (validated instanceof NextResponse) return validated;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.id;

  const identifier = getIdentifier(request, userId);
  const rateLimited = await checkRateLimit(claudeRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { ingredients, aldi_mode, country, check_pantry: checkPantryFlag } = validated;

  try {
    const matches = await matchAllIngredients(supabase, ingredients, {
      aldi_mode,
      country,
      check_pantry: checkPantryFlag,
      user_id: userId,
    });

    if (checkPantryFlag) {
      const withPantry = await checkPantry(supabase, matches, userId);
      const grouped = groupPantryResults(withPantry);
      return NextResponse.json(grouped);
    }

    return NextResponse.json(groupWithoutPantry(matches));
  } catch (e) {
    log.error("[recipe/match-ingredients]", e);
    const message = e instanceof Error ? e.message : "Match failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
