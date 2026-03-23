import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchAllIngredients } from "../ingredient-matcher";
import * as catalog from "../ingredient-matcher-catalog";
import type { Product } from "@/types";
import type { RecipeIngredient } from "../types";

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api/claude-client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api/claude-client")>();
  return { ...mod, callClaude: vi.fn() };
});

vi.mock("../ingredient-matcher-catalog", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../ingredient-matcher-catalog")>();
  return {
    ...mod,
    getRelevantProducts: vi.fn(),
  };
});

import { callClaude } from "@/lib/api/claude-client";

function minimalProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: "p1",
    name: "Cucina Spaghetti",
    name_normalized: "cucina spaghetti",
    brand: "Cucina",
    demand_group_code: "52",
    price: 0.99,
    price_updated_at: null,
    assortment_type: "daily_range",
    availability: "national",
    region: null,
    country: "DE",
    special_start_date: null,
    special_end_date: null,
    status: "active",
    source: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    weight_or_quantity: "500 g",
    ...overrides,
  };
}

describe("matchAllIngredients", () => {
  const sb = {} as SupabaseClient;
  const ingredients: RecipeIngredient[] = [
    {
      name: "Spaghetti",
      amount: 500,
      unit: "g",
      category: "Nudeln",
      notes: "",
      is_optional: false,
    },
  ];

  beforeEach(() => {
    vi.mocked(catalog.getRelevantProducts).mockResolvedValue([minimalProduct()]);
    vi.mocked(callClaude).mockResolvedValue(
      JSON.stringify([
        {
          ingredient_index: 0,
          product_id: "p1",
          product_name: "Cucina Spaghetti",
          match_tier: 1,
          match_confidence: 0.95,
          is_substitute: false,
          substitute_note: "",
        },
      ]),
    );
  });

  test("maps Claude rows to IngredientMatch with product", async () => {
    const out = await matchAllIngredients(sb, ingredients, {
      aldi_mode: true,
      country: "DE",
      check_pantry: false,
    });
    expect(out).toHaveLength(1);
    expect(out[0].match_tier).toBe(1);
    expect(out[0].aldi_product?.product_id).toBe("p1");
  });

  test("passes extended timeout to Claude (large catalog + many ingredients)", async () => {
    await matchAllIngredients(sb, ingredients, {
      aldi_mode: true,
      country: "DE",
      check_pantry: false,
    });
    expect(vi.mocked(callClaude).mock.calls[0][0]).toMatchObject({
      timeoutMs: 180_000,
    });
  });

  test("aldi_mode false downgrades tier 3 to tier 4", async () => {
    vi.mocked(callClaude).mockResolvedValue(
      JSON.stringify([
        {
          ingredient_index: 0,
          product_id: "p1",
          product_name: "Ersatz",
          match_tier: 3,
          match_confidence: 0.8,
          is_substitute: true,
          substitute_note: "Test",
        },
      ]),
    );
    const out = await matchAllIngredients(sb, ingredients, {
      aldi_mode: false,
      country: "DE",
      check_pantry: false,
    });
    expect(out[0].match_tier).toBe(4);
    expect(out[0].aldi_product).toBeNull();
  });

  test("invalid product_id from model becomes tier 4", async () => {
    vi.mocked(callClaude).mockResolvedValue(
      JSON.stringify([
        {
          ingredient_index: 0,
          product_id: "unknown-uuid",
          product_name: "X",
          match_tier: 1,
          match_confidence: 1,
          is_substitute: false,
          substitute_note: "",
        },
      ]),
    );
    const out = await matchAllIngredients(sb, ingredients, {
      aldi_mode: true,
      country: "DE",
      check_pantry: false,
    });
    expect(out[0].match_tier).toBe(4);
    expect(out[0].aldi_product).toBeNull();
  });
});
