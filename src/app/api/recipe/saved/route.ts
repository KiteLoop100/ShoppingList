import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/guards";
import { createSupabaseServerFromRequest } from "@/lib/supabase/server";
import { log } from "@/lib/utils/logger";
import type { SavedRecipe } from "@/lib/recipe/types";

const patchBodySchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

function parseInstructionsColumn(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  if (!raw.every((x) => typeof x === "string")) return null;
  return raw;
}

function mapRow(row: Record<string, unknown>): SavedRecipe {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title),
    source_url: row.source_url == null ? null : String(row.source_url),
    source_name: String(row.source_name),
    source_type: row.source_type === "ai_cook" ? "ai_cook" : "url_import",
    original_servings: Number(row.original_servings),
    servings_label: String(row.servings_label),
    ingredients: row.ingredients as SavedRecipe["ingredients"],
    instructions: parseInstructionsColumn(row.instructions),
    prep_time_minutes:
      row.prep_time_minutes == null ? null : Number(row.prep_time_minutes),
    cook_time_minutes:
      row.cook_time_minutes == null ? null : Number(row.cook_time_minutes),
    difficulty: row.difficulty == null ? null : String(row.difficulty),
    aldi_adapted: Boolean(row.aldi_adapted),
    created_at: String(row.created_at),
    last_used_at: row.last_used_at == null ? null : String(row.last_used_at),
  };
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = createSupabaseServerFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("saved_recipes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      log.error("[recipe/saved] GET by id failed:", error);
      return NextResponse.json({ error: "Could not load recipe" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ recipe: mapRow(data as Record<string, unknown>) });
  }

  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = Math.min(100, Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 20 : 20));
  const offset = Math.max(0, offsetRaw ? parseInt(offsetRaw, 10) || 0 : 0);

  const { data, error, count } = await supabase
    .from("saved_recipes")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    log.error("[recipe/saved] GET list failed:", error);
    return NextResponse.json({ error: "Could not load recipes" }, { status: 500 });
  }

  const recipes = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  return NextResponse.json({
    recipes,
    total: count ?? recipes.length,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createSupabaseServerFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("saved_recipes")
    .update({ last_used_at: now })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("[recipe/saved] PATCH failed:", error);
    return NextResponse.json({ error: "Could not update recipe" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createSupabaseServerFromRequest(request);
  if (!supabase) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("saved_recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    log.error("[recipe/saved] DELETE failed:", error);
    return NextResponse.json({ error: "Could not delete recipe" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
