import { describe, test, expect } from "vitest";
import {
  normalizeCookChatClaudePayload,
  normalizeRecipeDetail,
  parseAmountUnitString,
} from "../cook-response-normalize";

describe("parseAmountUnitString", () => {
  test("splits combined amount like 750g", () => {
    expect(parseAmountUnitString("750g")).toEqual({ amount: 750, unit: "g" });
  });

  test("splits amount with space and unit", () => {
    expect(parseAmountUnitString("2 EL")).toEqual({ amount: 2, unit: "EL" });
  });
});

describe("normalizeRecipeDetail", () => {
  test("maps item to name and splits string amount", () => {
    const raw = {
      title: "Pasta",
      servings: 2,
      time_minutes: 20,
      ingredients: [{ item: "Pasta", amount: "750g", available: true }],
      steps: ["Kochen"],
    };
    const out = normalizeRecipeDetail(raw) as {
      ingredients: Array<Record<string, unknown>>;
    };
    expect(out.ingredients[0]).toMatchObject({
      name: "Pasta",
      amount: 750,
      unit: "g",
      is_optional: false,
      category: "",
      notes: "",
    });
  });

  test("keeps numeric amount and unit field", () => {
    const raw = {
      ingredients: [{ name: "Salz", amount: 1, unit: "Prise", is_optional: true }],
    };
    const out = normalizeRecipeDetail(raw) as {
      ingredients: Array<Record<string, unknown>>;
    };
    expect(out.ingredients[0]).toMatchObject({
      name: "Salz",
      amount: 1,
      unit: "Prise",
      is_optional: true,
    });
  });
});

describe("normalizeCookChatClaudePayload", () => {
  test("only normalizes recipe when type is recipe_detail", () => {
    const payload = {
      type: "recipe_detail" as const,
      message: "Hier ist das Rezept.",
      suggestions: null,
      question: null,
      recipe: {
        title: "X",
        servings: 1,
        time_minutes: 10,
        ingredients: [{ item: "Zwiebel", amount: "1", available: true }],
        steps: ["a"],
      },
    };
    const n = normalizeCookChatClaudePayload(payload) as typeof payload;
    expect(n.recipe?.ingredients[0]).toMatchObject({
      name: "Zwiebel",
      amount: 1,
      unit: null,
      is_optional: false,
    });
  });

  test("passes through non-recipe_detail payloads", () => {
    const p = { type: "suggestions", message: "m", suggestions: [], question: null, recipe: null };
    expect(normalizeCookChatClaudePayload(p)).toEqual(p);
  });
});
