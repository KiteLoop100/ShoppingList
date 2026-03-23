import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getIdentifier, recipeExtractRateLimit } from "@/lib/api/rate-limit";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { extractRecipe } from "@/lib/recipe/extract";
import { log } from "@/lib/utils/logger";

export const maxDuration = 60;

const extractBodySchema = z.object({
  url: z
    .string()
    .min(1)
    .max(2000)
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://"),
});

function mapFailureToMethod(msg: string): "json-ld" | "microdata" | "ai-fallback" {
  if (msg === "no_recipe_found" || msg.includes("ANTHROPIC")) return "ai-fallback";
  if (
    msg.includes("Failed to fetch") ||
    msg === "Invalid URL" ||
    msg === "Invalid URL protocol"
  ) {
    return "json-ld";
  }
  return "ai-fallback";
}

function userFacingError(msg: string): string {
  if (msg === "no_recipe_found") {
    return "Kein Rezept auf dieser Seite gefunden.";
  }
  if (msg.includes("ANTHROPIC_API_KEY")) {
    return "Recipe extraction is not configured.";
  }
  return msg;
}

function httpStatusForError(msg: string): number {
  if (msg === "Invalid URL" || msg === "Invalid URL protocol") return 400;
  if (msg.includes("Failed to fetch URL")) return 502;
  if (msg === "no_recipe_found") return 422;
  return 500;
}

export async function POST(request: Request) {
  const validated = await validateBody(request, extractBodySchema);
  if (validated instanceof NextResponse) return validated;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.id;

  const identifier = getIdentifier(request, userId);
  const rateLimited = await checkRateLimit(recipeExtractRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const url = validated.url.trim();

  try {
    const result = await extractRecipe(url);
    const { error } = await supabase.from("recipe_imports").insert({
      user_id: userId,
      source_url: url,
      extraction_method: result.method,
      success: true,
      error_message: null,
    });
    if (error) {
      log.error("[recipe/extract] recipe_imports insert failed:", error);
    }
    return NextResponse.json({ recipe: result.recipe, method: result.method });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const extractionMethod = mapFailureToMethod(message);

    const { error: insertErr } = await supabase.from("recipe_imports").insert({
      user_id: userId,
      source_url: url,
      extraction_method: extractionMethod,
      success: false,
      error_message: message.slice(0, 2000),
    });
    if (insertErr) {
      log.error("[recipe/extract] recipe_imports failure insert failed:", insertErr);
    }

    const status = httpStatusForError(message);
    return NextResponse.json({ error: userFacingError(message) }, { status });
  }
}
