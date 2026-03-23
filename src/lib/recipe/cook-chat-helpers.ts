/**
 * Build wire-format history for POST /api/recipe/cook-chat (excludes welcome + error bubbles).
 */

import type { CookChatMessage } from "@/lib/recipe/types";

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
