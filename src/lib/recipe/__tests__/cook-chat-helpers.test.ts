import { describe, expect, test } from "vitest";
import { toCookChatApiHistory } from "@/lib/recipe/cook-chat-helpers";
import type { AICookResponse, CookChatMessage } from "@/lib/recipe/types";

describe("toCookChatApiHistory", () => {
  test("drops welcome and serializes structured assistant content", () => {
    const welcome: CookChatMessage = {
      role: "assistant",
      content: "Willkommen",
      timestamp: "1",
    };
    const user: CookChatMessage = {
      role: "user",
      content: "Hi",
      timestamp: "2",
    };
    const structured: AICookResponse = {
      type: "suggestions",
      message: "Hier sind Ideen",
      suggestions: [],
      question: null,
      recipe: null,
    };
    const assistant: CookChatMessage = {
      role: "assistant",
      content: structured.message,
      timestamp: "3",
      structuredResponse: structured,
    };
    const out = toCookChatApiHistory([welcome, user, assistant]);
    expect(out).toEqual([
      { role: "user", content: "Hi", timestamp: "2" },
      { role: "assistant", content: JSON.stringify(structured), timestamp: "3" },
    ]);
  });

  test("omits error assistant bubbles", () => {
    const welcome: CookChatMessage = {
      role: "assistant",
      content: "W",
      timestamp: "1",
    };
    const user: CookChatMessage = {
      role: "user",
      content: "x",
      timestamp: "2",
    };
    const err: CookChatMessage = {
      role: "assistant",
      content: "fail",
      timestamp: "3",
      messageKind: "error",
    };
    expect(toCookChatApiHistory([welcome, user, err])).toEqual([{ role: "user", content: "x", timestamp: "2" }]);
  });
});
