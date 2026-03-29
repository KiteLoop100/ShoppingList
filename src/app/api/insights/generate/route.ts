import { NextResponse } from "next/server";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { checkRateLimit, claudeRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { validateBody } from "@/lib/api/validate-request";
import { assembleInsightContext } from "@/lib/insights/context-assembler";
import { formatContextForPrompt } from "@/lib/insights/format-context";
import { buildSystemPrompt } from "@/lib/insights/prompts/shared-preamble";
import { buildSavingsPrompt } from "@/lib/insights/prompts/savings-prompt";
import { buildHealthPrompt } from "@/lib/insights/prompts/health-prompt";
import { buildNutritionPrompt } from "@/lib/insights/prompts/nutrition-prompt";
import { buildSpendingPrompt } from "@/lib/insights/prompts/spending-prompt";
import { buildHabitsPrompt } from "@/lib/insights/prompts/habits-prompt";
import { buildCustomPrompt } from "@/lib/insights/prompts/custom-prompt";
import {
  insightRequestSchema,
  insightResponseSchema,
  TOPIC_PROMPT_MAP,
  type InsightTopic,
} from "@/lib/insights/types";
import { log } from "@/lib/utils/logger";

export const maxDuration = 60;

const INSIGHTS_UNAVAILABLE = {
  error: "Insights sind gerade nicht verfügbar. Bitte versuche es später.",
} as const;

function getTopicPrompt(
  topic: InsightTopic,
  locale: string,
  householdSize?: number,
): string {
  const promptKey = TOPIC_PROMPT_MAP[topic];
  switch (promptKey) {
    case "savings":
      return buildSavingsPrompt(locale);
    case "health":
      return buildHealthPrompt(locale);
    case "nutrition":
      return buildNutritionPrompt(locale, householdSize ?? 2);
    case "spending":
      return buildSpendingPrompt(locale);
    case "habits":
      return buildHabitsPrompt(locale);
    case "custom":
      return "";
    default:
      return "";
  }
}

export async function POST(request: Request) {
  const validated = await validateBody(request, insightRequestSchema);
  if (validated instanceof NextResponse) return validated;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const apiKey = requireApiKey();
  if (apiKey instanceof NextResponse) return apiKey;

  const identifier = getIdentifier(request, auth.user.id);
  const rateLimited = await checkRateLimit(claudeRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  try {
    const context = await assembleInsightContext(supabase, auth.user.id);
    const contextText = formatContextForPrompt(context);
    const systemPrompt = buildSystemPrompt(contextText, validated.locale);

    let userPrompt: string;
    if (validated.topic === "custom") {
      userPrompt = buildCustomPrompt(validated.locale, validated.custom_query ?? "");
    } else {
      userPrompt = getTopicPrompt(validated.topic, validated.locale, validated.household_size);
    }

    const raw = await callClaudeJSON<unknown>({
      model: CLAUDE_MODEL_SONNET,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 1500,
      temperature: 0.4,
    });

    const parsed = insightResponseSchema.safeParse(raw);
    if (!parsed.success) {
      log.error("[insights] Claude response validation failed:", parsed.error.message);
      return NextResponse.json(INSIGHTS_UNAVAILABLE, { status: 500 });
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    log.error("[insights] Generation failed:", err);
    return NextResponse.json(INSIGHTS_UNAVAILABLE, { status: 500 });
  }
}
