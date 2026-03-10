import { NextResponse } from "next/server";
import { z } from "zod";
import {
  loadDemandGroups,
  loadDemandSubGroups,
  buildDemandGroupsAndSubGroupsPrompt,
  type DemandGroupEntry,
  type DemandSubGroupEntry,
} from "@/lib/categories/constants";
import { claudeRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";
import { generateNextAgCode } from "@/lib/categories/generate-ag-code";
import type { SupabaseClient } from "@supabase/supabase-js";

const assignCategorySchema = z.object({
  productName: z.string().min(1).max(500),
});

interface Stage1Result {
  action: "matched";
  demand_group_code: string;
  demand_sub_group?: string;
}

interface Stage2AIResponse {
  action: "create_new";
  demand_group: {
    code: string;
    name: string;
    name_en: string;
    suggested_parent_meta: string;
  };
  demand_sub_group: {
    code: string;
    name: string;
    name_en: string;
  };
}

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

  try {
    const groups = await loadDemandGroups(supabase);
    const subGroups = await loadDemandSubGroups(supabase);

    // Stage 1: match against existing groups + sub-groups
    const stage1 = await tryMatchExisting(productName, groups, subGroups);
    if (stage1) {
      const groupEntry = groups.find((g) => g.code === stage1.demand_group_code);
      return NextResponse.json({
        demand_group_code: stage1.demand_group_code,
        demand_group_name: groupEntry?.name ?? stage1.demand_group_code,
        demand_sub_group: stage1.demand_sub_group ?? null,
        action: "matched" as const,
      });
    }

    // Stage 2: AI proposes a new group
    const created = await createNewGroup(supabase, productName, groups);
    return NextResponse.json({
      demand_group_code: created.demand_group_code,
      demand_group_name: created.demand_group_name,
      demand_sub_group: created.demand_sub_group,
      action: "created" as const,
    });
  } catch (err) {
    log.error("[assign-category] Error:", err);
    return NextResponse.json(
      { error: "Claude API error" },
      { status: 502 }
    );
  }
}

async function tryMatchExisting(
  productName: string,
  groups: DemandGroupEntry[],
  subGroups: DemandSubGroupEntry[],
): Promise<Stage1Result | null> {
  const groupsPrompt = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);

  const result = await callClaudeJSON<{
    demand_group_code: string;
    demand_sub_group?: string;
    confidence: string;
  }>({
    model: CLAUDE_MODEL_HAIKU,
    system: `Du bist ein Supermarkt-Kategorie-Zuordner für ALDI SÜD.
Ordne das Produkt einer bestehenden Demand Group und Sub-Group zu.
Antworte als JSON: {"demand_group_code": "83", "demand_sub_group": "83-02", "confidence": "high"|"medium"|"low"}
Wenn KEINE passende Gruppe existiert, antworte: {"demand_group_code": null, "confidence": "none"}`,
    messages: [{
      role: "user",
      content: `Produkt: "${productName}"\n\n${groupsPrompt}`,
    }],
    max_tokens: 200,
  });

  if (!result.demand_group_code || result.confidence === "none") {
    return null;
  }

  const matched = groups.find((g) => g.code === result.demand_group_code);
  if (!matched) return null;

  let matchedSubGroup: string | undefined;
  if (result.demand_sub_group) {
    const sub = subGroups.find((s) => s.code === result.demand_sub_group);
    if (sub) matchedSubGroup = sub.code;
  }

  return {
    action: "matched",
    demand_group_code: matched.code,
    demand_sub_group: matchedSubGroup,
  };
}

async function createNewGroup(
  supabase: SupabaseClient,
  productName: string,
  existingGroups: DemandGroupEntry[],
): Promise<{
  demand_group_code: string;
  demand_group_name: string;
  demand_sub_group: string;
}> {
  const existingList = existingGroups
    .map((g) => `${g.code}: ${g.name}`)
    .join("\n");

  const aiResult = await callClaudeJSON<Stage2AIResponse>({
    model: CLAUDE_MODEL_HAIKU,
    system: `Du bist ein Supermarkt-Kategorie-Experte. Das Produkt passt in KEINE der bestehenden Warengruppen.
Schlage eine neue Demand Group vor. Der Code wird vom Server generiert -- verwende "AUTO" als Platzhalter.
Antworte als JSON:
{
  "action": "create_new",
  "demand_group": {"code": "AUTO", "name": "...", "name_en": "...", "suggested_parent_meta": "M01"},
  "demand_sub_group": {"code": "AUTO", "name": "...", "name_en": "..."}
}
suggested_parent_meta: Code einer bestehenden Meta-Kategorie (M01-M12) unter die diese Gruppe fällt.`,
    messages: [{
      role: "user",
      content: `Produkt: "${productName}"\n\nBestehende Gruppen (Code: Name):\n${existingList}`,
    }],
    max_tokens: 300,
  });

  const agCode = await generateNextAgCode(supabase);
  const subCode = `${agCode}-01`;

  const parentMeta = aiResult.demand_group?.suggested_parent_meta || null;

  const { error: groupError } = await supabase
    .from("demand_groups")
    .insert({
      code: agCode,
      name: aiResult.demand_group.name,
      name_en: aiResult.demand_group.name_en,
      parent_group: parentMeta,
      source: "ai_generated",
      reviewed_at: null,
      is_meta: false,
      sort_position: 9000,
    })
    .select()
    .single();

  if (groupError && !groupError.message.includes("duplicate")) {
    log.error("[assign-category] Failed to insert demand_group:", groupError.message);
    throw new Error(`Failed to create demand group: ${groupError.message}`);
  }

  const { error: subError } = await supabase
    .from("demand_sub_groups")
    .insert({
      code: subCode,
      name: aiResult.demand_sub_group.name,
      name_en: aiResult.demand_sub_group.name_en,
      demand_group_code: agCode,
      source: "ai_generated",
      reviewed_at: null,
      sort_position: 1,
    })
    .select()
    .single();

  if (subError && !subError.message.includes("duplicate")) {
    log.error("[assign-category] Failed to insert demand_sub_group:", subError.message);
    throw new Error(`Failed to create demand sub-group: ${subError.message}`);
  }

  log.info(`[assign-category] Created new group ${agCode} (${aiResult.demand_group.name}) for "${productName}"`);

  return {
    demand_group_code: agCode,
    demand_group_name: aiResult.demand_group.name,
    demand_sub_group: subCode,
  };
}

