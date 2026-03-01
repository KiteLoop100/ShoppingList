import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCategories, buildCategoryListPrompt } from "@/lib/categories/constants";
import { claudeRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaude } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";

const assignCategorySchema = z.object({
  productName: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = assignCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { productName } = parsed.data;

  const rateLimitResponse = await checkRateLimit(
    claudeRateLimit,
    getIdentifier(req)
  );
  if (rateLimitResponse) return rateLimitResponse;

  const CATEGORIES = await loadCategories(supabase);
  const CATEGORY_LIST = buildCategoryListPrompt(CATEGORIES);

  const prompt = `Du bist ein Supermarkt-Kategorie-Zuordner. Ordne das folgende Produkt genau EINER Kategorie zu.

Produkt: "${productName}"

Verfügbare Kategorien:
${CATEGORY_LIST}

Antworte NUR mit der category_id (UUID), nichts anderes. Keine Erklärung, kein Text drumherum.`;

  try {
    const text = (await callClaude({
      model: CLAUDE_MODEL_HAIKU,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
    })).trim();

    const matched = CATEGORIES.find((c) => text.includes(c.id));
    if (!matched) {
      log.error("[assign-category] Could not parse category from response:", text);
      return NextResponse.json(
        { error: "Could not determine category" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      category_id: matched.id,
      category_name: matched.name,
    });
  } catch (err) {
    log.error("[assign-category] Claude error:", err);
    return NextResponse.json(
      { error: "Claude API error" },
      { status: 502 }
    );
  }
}
