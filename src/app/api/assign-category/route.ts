import { NextResponse } from "next/server";
import { z } from "zod";
import { loadDemandGroups, buildDemandGroupListPrompt } from "@/lib/categories/constants";
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

  const DEMAND_GROUPS = await loadDemandGroups(supabase);
  const GROUP_LIST = buildDemandGroupListPrompt(DEMAND_GROUPS);

  const prompt = `Du bist ein Supermarkt-Kategorie-Zuordner für ALDI SÜD. Ordne das folgende Produkt genau EINER Warengruppe (Demand Group) zu.

Produkt: "${productName}"

Verfügbare Warengruppen (Code: Name):
${GROUP_LIST}

Antworte NUR mit dem Code (z.B. "83"), nichts anderes. Keine Erklärung, kein Text drumherum.`;

  try {
    const text = (await callClaude({
      model: CLAUDE_MODEL_HAIKU,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
    })).trim();

    const matched = DEMAND_GROUPS.find((g) => text.includes(g.code));
    if (!matched) {
      log.error("[assign-category] Could not parse demand_group from response:", text);
      return NextResponse.json(
        { error: "Could not determine category" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      demand_group_code: matched.code,
      demand_group_name: matched.name,
      // Legacy fields for backward compatibility during migration
      category_id: matched.code,
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
