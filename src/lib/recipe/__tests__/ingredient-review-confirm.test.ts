import { describe, expect, test } from "vitest";
import type { PantryCheckResult } from "../types";
import {
  buildReviewConfirmItems,
  countShoppingListPreview,
  hasUnresolvedOpenedPacks,
  makePantryRowKey,
} from "../ingredient-review-confirm";

function baseResult(overrides: Partial<PantryCheckResult> = {}): PantryCheckResult {
  return {
    ingredient: {
      name: "X",
      amount: 100,
      unit: "g",
      category: "c",
      notes: "",
      is_optional: false,
    },
    aldi_product: { product_id: "p1", name: "Prod", name_normalized: "prod" } as PantryCheckResult["aldi_product"],
    match_tier: 1,
    match_confidence: 1,
    is_substitute: false,
    in_pantry: false,
    pantry_status: "not_present",
    pantry_quantity_sufficient: false,
    quantity_needed: 100,
    quantity_to_buy: 100,
    ...overrides,
  };
}

describe("ingredient-review-confirm", () => {
  test("makePantryRowKey is stable per bucket and index", () => {
    const r = baseResult();
    expect(makePantryRowKey("buy", 0, r)).toBe(makePantryRowKey("buy", 0, r));
    expect(makePantryRowKey("buy", 0, r)).not.toBe(makePantryRowKey("buy", 1, r));
  });

  test("hasUnresolvedOpenedPacks is true when unresolved or missing", () => {
    const r = baseResult();
    expect(hasUnresolvedOpenedPacks([r], {})).toBe(true);
    expect(hasUnresolvedOpenedPacks([r], { [makePantryRowKey("cf", 0, r)]: "unresolved" })).toBe(true);
    expect(hasUnresolvedOpenedPacks([r], { [makePantryRowKey("cf", 0, r)]: "sufficient" })).toBe(false);
    expect(hasUnresolvedOpenedPacks([r], { [makePantryRowKey("cf", 0, r)]: "buy" })).toBe(false);
  });

  test("countShoppingListPreview sums buy, confirmation buy, and free-text", () => {
    const grouped = {
      available: [],
      to_buy: [baseResult({ is_substitute: false })],
      unavailable: [baseResult({ match_tier: 4, aldi_product: null })],
      needs_confirmation: [baseResult()],
    };
    const buyK = makePantryRowKey("buy", 0, grouped.to_buy[0]);
    const unK = makePantryRowKey("un", 0, grouped.unavailable[0]);
    const cfK = makePantryRowKey("cf", 0, grouped.needs_confirmation[0]);
    expect(
      countShoppingListPreview(grouped, { [cfK]: "unresolved" }, {}, { [buyK]: true }, { [unK]: false }),
    ).toBe(1);
    expect(
      countShoppingListPreview(grouped, { [cfK]: "buy" }, {}, { [buyK]: true }, { [unK]: true }),
    ).toBe(3);
  });

  test("countShoppingListPreview excludes substitute when original chosen", () => {
    const sub = baseResult({ is_substitute: true });
    const grouped = {
      available: [],
      to_buy: [sub],
      unavailable: [],
      needs_confirmation: [],
    };
    const k = makePantryRowKey("buy", 0, sub);
    expect(countShoppingListPreview(grouped, {}, { [k]: "aldi" }, {}, {})).toBe(1);
    expect(countShoppingListPreview(grouped, {}, { [k]: "original" }, {}, {})).toBe(0);
  });

  test("buildReviewConfirmItems collects rows with flags", () => {
    const buyPlain = baseResult({ is_substitute: false });
    const buySub = baseResult({ is_substitute: true, ingredient: { ...baseResult().ingredient, name: "Sub" } });
    const cf = baseResult({ ingredient: { ...baseResult().ingredient, name: "Cf" } });
    const un = baseResult({
      match_tier: 4,
      aldi_product: null,
      ingredient: { ...baseResult().ingredient, name: "Un" },
    });
    const grouped = {
      available: [],
      to_buy: [buyPlain, buySub],
      unavailable: [un],
      needs_confirmation: [cf],
    };
    const k0 = makePantryRowKey("buy", 0, buyPlain);
    const k1 = makePantryRowKey("buy", 1, buySub);
    const kcf = makePantryRowKey("cf", 0, cf);
    const kun = makePantryRowKey("un", 0, un);

    const items = buildReviewConfirmItems(
      grouped,
      { [kcf]: "buy" },
      { [k1]: "aldi" },
      { [k0]: true },
      { [kun]: true },
    );
    expect(items.length).toBe(4);
    expect(items.find((i) => i.ingredient.name === "Sub")?.review_substitute_choice).toBe("aldi");
    expect(items.find((i) => i.ingredient.name === "Un")?.review_add_free_text).toBe(true);
  });
});
