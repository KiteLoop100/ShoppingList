import { describe, expect, test } from "vitest";
import { getEffectiveStructuredResponse, toCookChatApiHistory } from "@/lib/recipe/cook-chat-helpers";
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

describe("getEffectiveStructuredResponse", () => {
  test("prefers explicit structuredResponse", () => {
    const structured: AICookResponse = {
      type: "recipe_detail",
      message: "Hier ist das Rezept.",
      suggestions: null,
      question: null,
      recipe: {
        title: "Pasta",
        servings: 2,
        time_minutes: 20,
        ingredients: [],
        steps: [],
        pantry_matches: [],
      },
    };
    const m: CookChatMessage = {
      role: "assistant",
      content: "ignored if structured set",
      timestamp: "1",
      structuredResponse: structured,
    };
    expect(getEffectiveStructuredResponse(m)).toEqual(structured);
  });

  test("parses JSON assistant content when structuredResponse is absent", () => {
    const structured: AICookResponse = {
      type: "suggestions",
      message: "Los",
      suggestions: [],
      question: null,
      recipe: null,
    };
    const m: CookChatMessage = {
      role: "assistant",
      content: JSON.stringify(structured),
      timestamp: "1",
    };
    expect(getEffectiveStructuredResponse(m)?.type).toBe("suggestions");
  });

  test("returns undefined for user messages", () => {
    expect(
      getEffectiveStructuredResponse({
        role: "user",
        content: '{"type":"recipe_detail"}',
        timestamp: "1",
      }),
    ).toBeUndefined();
  });

  test("returns undefined for error assistant bubbles", () => {
    const structured: AICookResponse = {
      type: "clarification",
      message: "x",
      suggestions: null,
      question: "y",
      recipe: null,
    };
    expect(
      getEffectiveStructuredResponse({
        role: "assistant",
        content: JSON.stringify(structured),
        timestamp: "1",
        messageKind: "error",
      }),
    ).toBeUndefined();
  });
});
