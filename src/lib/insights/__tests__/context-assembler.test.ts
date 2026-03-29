import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleInsightContext } from "../context-assembler";
import { formatContextForPrompt } from "../format-context";
import { parseNutritionSafe } from "../context-queries";
import {
  insightRequestSchema,
  insightResponseSchema,
  TOPIC_PROMPT_MAP,
} from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type ChainResult = { data: unknown; error: unknown; count?: number };

function createChain(result: ChainResult) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: ChainResult) => void) => resolve(result);
      }
      return vi.fn().mockReturnValue(new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

function createMockSupabase(tables: Record<string, ChainResult>) {
  return {
    from: vi.fn((table: string) => {
      const result = tables[table] ?? { data: [], error: null };
      return createChain(result);
    }),
  } as unknown as SupabaseClient;
}

const makeReceipt = (id: string, date: string, amount: number) => ({
  receipt_id: id,
  purchase_date: date,
  total_amount: amount,
  retailer: "ALDI",
});

const makeItem = (receiptId: string, productId: string | null, name: string, price: number) => ({
  receipt_id: receiptId,
  product_id: productId,
  competitor_product_id: null,
  receipt_name: name,
  quantity: 1,
  total_price: price,
});

const makeProduct = (id: string, name: string, extras: Record<string, unknown> = {}) => ({
  product_id: id,
  name,
  brand: null,
  demand_group_code: "83",
  nutrition_info: null,
  is_bio: false,
  is_vegan: false,
  is_private_label: true,
  ...extras,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("assembleInsightContext", () => {
  it("happy path: aggregates receipts, trips, and auto-reorder", async () => {
    const receipts = [
      makeReceipt("r1", "2026-03-01", 45.0),
      makeReceipt("r2", "2026-03-08", 52.0),
      makeReceipt("r3", "2026-03-15", 38.0),
      makeReceipt("r4", "2026-03-20", 61.0),
      makeReceipt("r5", "2026-03-25", 33.0),
    ];
    const items = [
      makeItem("r1", "p1", "Milch", 1.09),
      makeItem("r2", "p1", "Milch", 1.09),
      makeItem("r3", "p1", "Milch", 1.09),
      makeItem("r1", "p2", "Butter", 1.69),
      makeItem("r2", "p2", "Butter", 1.69),
    ];
    const products = [
      makeProduct("p1", "Milsani Vollmilch 1L"),
      makeProduct("p2", "Milsani Deutsche Markenbutter"),
    ];
    const trips = [
      { trip_id: "t1", started_at: "2026-03-01T10:00:00Z", completed_at: "2026-03-01T10:30:00Z", total_items: 5, estimated_total_price: 45 },
      { trip_id: "t2", started_at: "2026-03-08T10:00:00Z", completed_at: "2026-03-08T10:25:00Z", total_items: 6, estimated_total_price: 52 },
      { trip_id: "t3", started_at: "2026-03-15T10:00:00Z", completed_at: "2026-03-15T10:20:00Z", total_items: 4, estimated_total_price: 38 },
    ];
    const autoReorder = [
      { product_id: "p1", reorder_value: 7, reorder_unit: "days" },
      { product_id: "p2", reorder_value: 2, reorder_unit: "weeks" },
    ];
    const demandGroups = [{ code: "83", name: "Milch/Sahne/Butter" }];

    const supabase = createMockSupabase({
      receipts: { data: receipts, error: null },
      receipt_items: { data: items, error: null },
      shopping_trips: { data: trips, error: null },
      auto_reorder_settings: { data: autoReorder, error: null },
      products: { data: products, error: null },
      competitor_products: { data: [], error: null },
      demand_groups: { data: demandGroups, error: null },
    });

    const ctx = await assembleInsightContext(supabase, "user-1");

    expect(ctx.receipt_count).toBe(5);
    expect(ctx.total_spent).toBe(229);
    expect(ctx.trip_count).toBe(3);
    expect(ctx.top_products.length).toBe(2);
    expect(ctx.top_products[0].name).toBe("Milsani Vollmilch 1L");
    expect(ctx.top_products[0].count).toBe(3);
    expect(ctx.category_breakdown.length).toBe(1);
    expect(ctx.category_breakdown[0].group).toBe("Milch/Sahne/Butter");
    expect(ctx.auto_reorder_items.length).toBe(2);
  });

  it("sparse data: 1 receipt, 0 trips", async () => {
    const supabase = createMockSupabase({
      receipts: { data: [makeReceipt("r1", "2026-03-20", 15.5)], error: null },
      receipt_items: { data: [makeItem("r1", null, "Bread", 2.49), makeItem("r1", null, "Cheese", 3.99)], error: null },
      shopping_trips: { data: [], error: null },
      auto_reorder_settings: { data: [], error: null },
      products: { data: [], error: null },
      competitor_products: { data: [], error: null },
      demand_groups: { data: [], error: null },
    });

    const ctx = await assembleInsightContext(supabase, "user-1");

    expect(ctx.receipt_count).toBe(1);
    expect(ctx.trip_count).toBe(0);
    expect(ctx.top_products.length).toBe(2);
  });

  it("empty user: 0 receipts, 0 trips", async () => {
    const supabase = createMockSupabase({
      receipts: { data: [], error: null },
      receipt_items: { data: [], error: null },
      shopping_trips: { data: [], error: null },
      auto_reorder_settings: { data: [], error: null },
      products: { data: [], error: null },
      competitor_products: { data: [], error: null },
      demand_groups: { data: [], error: null },
    });

    const ctx = await assembleInsightContext(supabase, "user-1");

    expect(ctx.receipt_count).toBe(0);
    expect(ctx.total_spent).toBe(0);
    expect(ctx.trip_count).toBe(0);
    expect(ctx.top_products).toEqual([]);
    expect(ctx.nutrition_summary).toBeUndefined();
  });

  it("partial query failure: trips fail, receipts succeed", async () => {
    const { log } = await import("@/lib/utils/logger");
    const supabase = createMockSupabase({
      receipts: { data: [makeReceipt("r1", "2026-03-20", 20)], error: null },
      receipt_items: { data: [makeItem("r1", null, "Apples", 2.99)], error: null },
      shopping_trips: { data: null, error: { message: "connection refused" } },
      auto_reorder_settings: { data: [], error: null },
      products: { data: [], error: null },
      competitor_products: { data: [], error: null },
      demand_groups: { data: [], error: null },
    });

    const ctx = await assembleInsightContext(supabase, "user-1");

    expect(ctx.receipt_count).toBe(1);
    expect(ctx.trip_count).toBe(0);
    expect(log.warn).toHaveBeenCalled();
  });
});

describe("parseNutritionSafe", () => {
  it("extracts valid numeric fields", () => {
    const result = parseNutritionSafe({ energy_kcal: 250, fat: 12.5, protein: 8, carbs: 30, sugar: 5, salt: 1.2 });
    expect(result).toEqual({ energy_kcal: 250, fat: 12.5, protein: 8, carbs: 30, sugar: 5, salt: 1.2 });
  });

  it("returns null for empty object", () => {
    expect(parseNutritionSafe({})).toBeNull();
  });

  it("returns null for string input", () => {
    expect(parseNutritionSafe("not an object")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseNutritionSafe(null)).toBeNull();
  });

  it("skips non-numeric fields", () => {
    const result = parseNutritionSafe({ energy_kcal: "250kcal", fat: 12.5, random_field: "abc" });
    expect(result).toEqual({ fat: 12.5 });
  });

  it("returns null when all known fields are non-numeric", () => {
    expect(parseNutritionSafe({ energy_kcal: null, fat: null, random: 42 })).toBeNull();
  });
});

describe("formatContextForPrompt", () => {
  it("produces output under 8000 chars for normal data", () => {
    const ctx = {
      receipt_count: 5,
      date_range: { from: "2026-01-01", to: "2026-03-25" },
      total_spent: 229,
      avg_per_trip: 45.8,
      shopping_frequency_per_week: 1.5,
      top_products: Array.from({ length: 20 }, (_, i) => ({
        name: `Product ${i + 1}`,
        count: 20 - i,
        total_spent: (20 - i) * 2.5,
      })),
      category_breakdown: Array.from({ length: 10 }, (_, i) => ({
        group: `Category ${i + 1}`,
        spent: (10 - i) * 15,
        items: (10 - i) * 3,
      })),
      weekly_spending: Array.from({ length: 12 }, (_, i) => ({
        week: `2026-01-${String(i * 7 + 1).padStart(2, "0")}`,
        amount: 40 + i * 2,
      })),
      organic_ratio: 0.15,
      vegan_ratio: 0.08,
      auto_reorder_items: [
        { name: "Milk", interval: "7 days" },
        { name: "Butter", interval: "2 weeks" },
      ],
      trip_count: 3,
    };

    const text = formatContextForPrompt(ctx);
    expect(text.length).toBeLessThanOrEqual(8000);
    expect(text).toContain("TOP PRODUCTS");
    expect(text).toContain("SPENDING BY CATEGORY");
  });
});

describe("insightRequestSchema", () => {
  it("accepts valid savings request", () => {
    const result = insightRequestSchema.safeParse({ topic: "savings", locale: "de" });
    expect(result.success).toBe(true);
  });

  it("accepts valid custom request with query", () => {
    const result = insightRequestSchema.safeParse({
      topic: "custom",
      custom_query: "How much do I spend on sweets?",
      locale: "en",
    });
    expect(result.success).toBe(true);
  });

  it("rejects custom topic without custom_query", () => {
    const result = insightRequestSchema.safeParse({ topic: "custom", locale: "de" });
    expect(result.success).toBe(false);
  });

  it("rejects custom topic with empty custom_query", () => {
    const result = insightRequestSchema.safeParse({ topic: "custom", custom_query: "   ", locale: "de" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid topic", () => {
    const result = insightRequestSchema.safeParse({ topic: "invalid", locale: "de" });
    expect(result.success).toBe(false);
  });

  it("rejects household_size outside range", () => {
    const result = insightRequestSchema.safeParse({ topic: "nutrition_analysis", locale: "de", household_size: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts household_size within range", () => {
    const result = insightRequestSchema.safeParse({ topic: "nutrition_analysis", locale: "de", household_size: 4 });
    expect(result.success).toBe(true);
  });
});

describe("insightResponseSchema", () => {
  it("accepts valid full response", () => {
    const result = insightResponseSchema.safeParse({
      title: "Analysis",
      sections: [{ content: "Some content" }],
      summary: "Summary text",
      follow_up_suggestions: ["Ask more"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty sections array", () => {
    const result = insightResponseSchema.safeParse({
      title: "Analysis",
      sections: [],
      summary: "Summary text",
      follow_up_suggestions: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts follow_up_suggestions: null (transforms to [])", () => {
    const result = insightResponseSchema.safeParse({
      title: "Analysis",
      sections: [{ content: "Content" }],
      summary: "Summary",
      follow_up_suggestions: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.follow_up_suggestions).toEqual([]);
    }
  });

  it("accepts suggested_product_name: null (nullish)", () => {
    const result = insightResponseSchema.safeParse({
      title: "Analysis",
      sections: [{ content: "Content", suggested_product_name: null }],
      summary: "Summary",
      follow_up_suggestions: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects sections as string", () => {
    const result = insightResponseSchema.safeParse({
      title: "Analysis",
      sections: "not an array",
      summary: "Summary",
      follow_up_suggestions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = insightResponseSchema.safeParse({
      sections: [{ content: "Content" }],
      summary: "Summary",
      follow_up_suggestions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("TOPIC_PROMPT_MAP", () => {
  it("maps nutrition to health (correct cross-mapping)", () => {
    expect(TOPIC_PROMPT_MAP.nutrition).toBe("health");
  });

  it("maps nutrition_analysis to nutrition (correct cross-mapping)", () => {
    expect(TOPIC_PROMPT_MAP.nutrition_analysis).toBe("nutrition");
  });

  it("maps all topics to distinct prompt keys", () => {
    const values = Object.values(TOPIC_PROMPT_MAP);
    expect(new Set(values).size).toBe(values.length);
  });

  it("covers all INSIGHT_TOPICS", () => {
    const topics = ["savings", "nutrition", "nutrition_analysis", "spending", "habits", "custom"] as const;
    for (const topic of topics) {
      expect(TOPIC_PROMPT_MAP[topic]).toBeDefined();
    }
  });
});
