import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { createSupabaseServerFromRequest } from "@/lib/supabase/server";
import { log } from "@/lib/utils/logger";

const recipeIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string(),
  notes: z.string(),
  is_optional: z.boolean(),
});

const saveRecipeBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    source_url: z.union([z.string().url().max(2000), z.null()]),
    source_name: z.string().min(1).max(200),
    source_type: z.enum(["url_import", "ai_cook"]),
    original_servings: z.number().int().min(1).max(99),
    servings_label: z.string().min(1).max(80),
    ingredients: z.array(recipeIngredientSchema).min(1).max(100),
    prep_time_minutes: z.number().int().nullable(),
    cook_time_minutes: z.number().int().nullable(),
    difficulty: z.string().max(80).nullable(),
    aldi_adapted: z.boolean(),
  })
  .strict()
  .refine(
    (data) =>
      data.source_type === "ai_cook" ? data.source_url === null : true,
    "ai_cook recipes must have source_url null",
  );

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const validated = await validateBody(request, saveRecipeBodySchema);
  if (validated instanceof NextResponse) return validated;

  const supabase = createSupabaseServerFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const row = {
    user_id: user.id,
    title: validated.title,
    source_url: validated.source_url,
    source_name: validated.source_name,
    source_type: validated.source_type,
    original_servings: validated.original_servings,
    servings_label: validated.servings_label,
    ingredients: validated.ingredients,
    prep_time_minutes: validated.prep_time_minutes,
    cook_time_minutes: validated.cook_time_minutes,
    difficulty: validated.difficulty,
    aldi_adapted: validated.aldi_adapted,
  };

  try {
    if (validated.source_url) {
      const { data: existing, error: findErr } = await supabase
        .from("saved_recipes")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_url", validated.source_url)
        .maybeSingle();

      if (findErr) {
        log.error("[recipe/save] lookup failed:", findErr);
        return NextResponse.json({ error: "Could not save recipe" }, { status: 500 });
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("saved_recipes")
          .update({
            title: row.title,
            source_name: row.source_name,
            source_type: row.source_type,
            original_servings: row.original_servings,
            servings_label: row.servings_label,
            ingredients: row.ingredients,
            prep_time_minutes: row.prep_time_minutes,
            cook_time_minutes: row.cook_time_minutes,
            difficulty: row.difficulty,
            aldi_adapted: row.aldi_adapted,
          })
          .eq("id", existing.id)
          .eq("user_id", user.id);

        if (updErr) {
          log.error("[recipe/save] update failed:", updErr);
          return NextResponse.json({ error: "Could not save recipe" }, { status: 500 });
        }
        return NextResponse.json({ id: existing.id });
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("saved_recipes")
      .insert(row)
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      log.error("[recipe/save] insert failed:", insErr);
      return NextResponse.json({ error: "Could not save recipe" }, { status: 500 });
    }

    return NextResponse.json({ id: inserted.id });
  } catch (e) {
    log.error("[recipe/save] unexpected:", e);
    return NextResponse.json({ error: "Could not save recipe" }, { status: 500 });
  }
}
