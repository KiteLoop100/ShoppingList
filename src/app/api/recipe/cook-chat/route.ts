import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { checkRateLimit, getIdentifier, recipeAiDailyRateLimit } from "@/lib/api/rate-limit";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { loadInventory } from "@/lib/inventory/inventory-service";
import { getRelevantProducts } from "@/lib/recipe/ingredient-matcher-catalog";
import {
  buildCookSystemPrompt,
  COOK_JSON_RETRY_USER,
  cookMessageToClaudeText,
  formatCatalogForPrompt,
  formatPantryForPrompt,
  resolveCatalogCountry,
} from "@/lib/recipe/cook-prompts";
import { normalizeCookChatClaudePayload } from "@/lib/recipe/cook-response-normalize";
import type { AICookResponse, CookChatMessage, GeneratedRecipeDetail } from "@/lib/recipe/types";
import { log } from "@/lib/utils/logger";

export const maxDuration = 60;

const MAX_CLAUDE_MESSAGES = 20;

const CLAUDE_UNAVAILABLE = {
  error:
    "Entschuldigung, der Koch-Assistent ist gerade nicht erreichbar. Bitte versuche es gleich nochmal.",
} as const;

const cookChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

const bodySchema = z
  .object({
    message: z.string().min(1).max(500),
    conversation_id: z.string().uuid().optional(),
    conversation_history: z.array(cookChatMessageSchema).max(20),
  })
  .strict();

const recipeIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  category: z.string(),
  notes: z.string(),
  is_optional: z.boolean(),
});

const recipeSuggestionSchema = z.object({
  title: z.string(),
  time_minutes: z.number(),
  ingredients_available: z.array(z.string()),
  ingredients_missing: z.array(z.string()),
  all_available: z.boolean(),
});

const generatedRecipeDetailSchema = z.object({
  title: z.string(),
  servings: z.number(),
  time_minutes: z.number(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(z.string()),
  pantry_matches: z.array(z.unknown()).optional(),
});

const aiCookResponseSchema = z.object({
  type: z.enum(["suggestions", "clarification", "recipe_detail"]),
  message: z.string(),
  suggestions: z.array(recipeSuggestionSchema).nullable(),
  question: z.string().nullable(),
  recipe: generatedRecipeDetailSchema.nullable(),
});

function normalizeAiCookResponse(parsed: z.infer<typeof aiCookResponseSchema>): AICookResponse {
  const recipe: GeneratedRecipeDetail | null = parsed.recipe
    ? {
        ...parsed.recipe,
        pantry_matches: (parsed.recipe.pantry_matches ?? []) as GeneratedRecipeDetail["pantry_matches"],
      }
    : null;

  return {
    type: parsed.type,
    message: parsed.message,
    suggestions: parsed.suggestions,
    question: parsed.question,
    recipe,
  };
}

function tryParseAiCookResponse(raw: unknown): AICookResponse | null {
  const normalized = normalizeCookChatClaudePayload(raw);
  const r = aiCookResponseSchema.safeParse(normalized);
  if (!r.success) return null;
  return normalizeAiCookResponse(r.data);
}

function toClaudeMessages(turns: CookChatMessage[]) {
  return turns.map((m) => ({
    role: m.role,
    content: cookMessageToClaudeText(m),
  })) as { role: "user" | "assistant"; content: string }[];
}

export async function POST(request: Request) {
  try {
    const validated = await validateBody(request, bodySchema);
    if (validated instanceof NextResponse) return validated;

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.id;

    const supabase = requireSupabaseAdmin();
    if (supabase instanceof NextResponse) return supabase;

    console.log("COOK-CHAT: Step 1 - Loading inventory...");
    const inventoryItems = await loadInventory(supabase, userId);
    console.log("COOK-CHAT: Step 1 - Loading inventory — done");

    if (inventoryItems.length === 0) {
      const emptyResponse: AICookResponse = {
        type: "clarification",
        message:
          "Deine Vorratsliste ist leer. Füge Produkte in deinem Inventar hinzu, um personalisierte Vorschläge zu bekommen.",
        suggestions: null,
        question: "Möchtest du trotzdem allgemeine ALDI-Rezepte sehen?",
        recipe: null,
      };
      return NextResponse.json({
        conversation_id: randomUUID(),
        response: emptyResponse,
      });
    }

    const identifier = getIdentifier(request, userId);
    const rateLimited = await checkRateLimit(recipeAiDailyRateLimit, identifier);
    if (rateLimited) {
      return NextResponse.json(
        { error: "Du hast heute schon viele Rezepte generiert. Morgen geht's weiter!" },
        { status: 429 },
      );
    }

    console.log("COOK-CHAT: Step 2 - Loading catalog...");
    const country = await resolveCatalogCountry(supabase, userId);
    const products = await getRelevantProducts(supabase, country);
    console.log("COOK-CHAT: Step 2 - Loading catalog — done");

    console.log("COOK-CHAT: Step 3 - Building prompt...");
    const pantryFormatted = formatPantryForPrompt(inventoryItems);
    const catalogFormatted = formatCatalogForPrompt(products);
    const systemPrompt = buildCookSystemPrompt(pantryFormatted, catalogFormatted);
    console.log("COOK-CHAT: Step 3 - Building prompt — done");

    const now = new Date().toISOString();
    const userTurn: CookChatMessage = {
      role: "user",
      content: validated.message.trim(),
      timestamp: now,
    };

    let priorMessages: CookChatMessage[] = [];
    let existingId: string | null = null;

    if (validated.conversation_id) {
      const { data: row, error: fetchErr } = await supabase
        .from("cook_conversations")
        .select("id, user_id, messages")
        .eq("id", validated.conversation_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchErr) {
        log.error("[recipe/cook-chat] fetch conversation:", fetchErr.message);
        return NextResponse.json({ error: "Konversation konnte nicht geladen werden." }, { status: 500 });
      }
      if (!row) {
        return NextResponse.json({ error: "Konversation nicht gefunden." }, { status: 400 });
      }

      existingId = row.id;
      const raw = row.messages;
      if (Array.isArray(raw)) {
        priorMessages = raw as CookChatMessage[];
      }
    } else {
      priorMessages = validated.conversation_history;
    }

    const turnsForClaude = [...priorMessages, userTurn].slice(-MAX_CLAUDE_MESSAGES);
    const claudeMessages = toClaudeMessages(turnsForClaude);

    const history = priorMessages;
    const lastMessage = validated.message.trim();
    console.log(
      "COOK-CHAT: History length:",
      history.length,
      "Last message:",
      lastMessage.substring(0, 100),
    );

    const pantrySnapshotPayload = {
      formatted: pantryFormatted,
      item_count: inventoryItems.length,
      country,
    };

    const callModel = async (messages: { role: "user" | "assistant"; content: string }[]) => {
      return callClaudeJSON<unknown>({
        model: CLAUDE_MODEL_SONNET,
        system: systemPrompt,
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      });
    };

    let aiRaw: unknown;
    console.log("COOK-CHAT: Step 4 - Calling Claude... messages:", claudeMessages.length);
    try {
      aiRaw = await callModel(claudeMessages);
    } catch (err) {
      log.error("[recipe/cook-chat] Claude error:", err);
      return NextResponse.json(CLAUDE_UNAVAILABLE, { status: 500 });
    }
    console.log("COOK-CHAT: Step 4 - Calling Claude — done (initial)");

    console.log("COOK-CHAT: Step 5 - Parsing response...");
    let response = tryParseAiCookResponse(aiRaw);

    if (!response) {
      try {
        const retryMessages = [
          ...claudeMessages,
          { role: "user" as const, content: COOK_JSON_RETRY_USER },
        ];
        console.log("COOK-CHAT: Step 4 - Calling Claude... messages:", retryMessages.length);
        aiRaw = await callModel(retryMessages);
        console.log("COOK-CHAT: Step 4 - Calling Claude — done (retry)");
        response = tryParseAiCookResponse(aiRaw);
      } catch (err) {
        log.error("[recipe/cook-chat] Claude retry error:", err);
        return NextResponse.json(CLAUDE_UNAVAILABLE, { status: 500 });
      }
    }

    if (!response) {
      try {
        aiCookResponseSchema.parse(normalizeCookChatClaudePayload(aiRaw));
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("COOK-CHAT: Parse error details:", err.message);
        let rawResponse: string;
        try {
          rawResponse = typeof aiRaw === "string" ? aiRaw : JSON.stringify(aiRaw);
        } catch {
          rawResponse = String(aiRaw);
        }
        console.log(
          "COOK-CHAT: Raw Claude response (first 1000 chars):",
          rawResponse.substring(0, 1000),
        );
      }
      console.log("COOK-CHAT: Step 5 - Parsing response — done (failed)");
      return NextResponse.json(CLAUDE_UNAVAILABLE, { status: 500 });
    }
    console.log("COOK-CHAT: Step 5 - Parsing response — done");

    const assistantTurn: CookChatMessage = {
      role: "assistant",
      content: JSON.stringify(response),
      timestamp: new Date().toISOString(),
    };

    /** Cap stored transcript so JSONB does not grow without bound. */
    const finalMessages = [...priorMessages, userTurn, assistantTurn].slice(-50);
    const conversationId = existingId ?? randomUUID();
    const isNew = !existingId;

    console.log("COOK-CHAT: Step 6 - Saving conversation...");
    if (isNew) {
      const { error: insErr } = await supabase.from("cook_conversations").insert({
        id: conversationId,
        user_id: userId,
        messages: finalMessages,
        pantry_snapshot: pantrySnapshotPayload,
        updated_at: new Date().toISOString(),
      });
      if (insErr) {
        log.error("[recipe/cook-chat] insert conversation:", insErr.message);
        return NextResponse.json({ error: "Konversation konnte nicht gespeichert werden." }, { status: 500 });
      }
    } else {
      const { error: updErr } = await supabase
        .from("cook_conversations")
        .update({
          messages: finalMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", userId);
      if (updErr) {
        log.error("[recipe/cook-chat] update conversation:", updErr.message);
        return NextResponse.json({ error: "Konversation konnte nicht gespeichert werden." }, { status: 500 });
      }
    }
    console.log("COOK-CHAT: Step 6 - Saving conversation — done");

    return NextResponse.json({
      conversation_id: conversationId,
      response,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("COOK-CHAT: Unhandled error:", error.message, error.stack);
    } else {
      console.error("COOK-CHAT: Unhandled error:", String(error));
    }
    throw error;
  }
}
