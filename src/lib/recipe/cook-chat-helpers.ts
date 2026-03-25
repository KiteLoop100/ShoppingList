/**
 * Build wire-format history for POST /api/recipe/cook-chat (excludes welcome + error bubbles).
 */

import type { AICookResponse, CookChatMessage } from "@/lib/recipe/types";

function tryParseAICookContent(content: string): AICookResponse | undefined {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return undefined;
  try {
    const o = JSON.parse(trimmed) as unknown;
    if (!o || typeof o !== "object") return undefined;
    const rec = o as Record<string, unknown>;
    if (rec.type !== "suggestions" && rec.type !== "clarification" && rec.type !== "recipe_detail") {
      return undefined;
    }
    if (typeof rec.message !== "string") return undefined;
    return o as AICookResponse;
  } catch {
    return undefined;
  }
}

/**
 * Structured cook payload for rendering: explicit field or JSON in `content` (e.g. persisted turns).
 */
export function getEffectiveStructuredResponse(message: CookChatMessage): AICookResponse | undefined {
  if (message.structuredResponse) return message.structuredResponse;
  if (message.role !== "assistant" || message.messageKind) return undefined;
  return tryParseAICookContent(message.content);
}

export function toCookChatApiHistory(messages: CookChatMessage[]): CookChatMessage[] {
  const withoutWelcome = messages.slice(1);
  const turns = withoutWelcome.filter(
    (m) => m.role === "user" || (m.role === "assistant" && !m.messageKind),
  );
  return turns.map((m) => ({
    role: m.role,
    content:
      m.role === "assistant" && m.structuredResponse
        ? JSON.stringify(m.structuredResponse)
        : m.content,
    timestamp: m.timestamp,
  }));
}
