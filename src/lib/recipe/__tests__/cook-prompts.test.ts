import { describe, expect, test } from "vitest";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { Product } from "@/types";
import {
  buildCookSystemPrompt,
  cookMessageToClaudeText,
  formatCatalogForPrompt,
  formatPantryForPrompt,
  MAX_CATALOG_PROMPT_PRODUCTS,
  sortInventoryForPrompt,
} from "@/lib/recipe/cook-prompts";
import type { CookChatMessage } from "@/lib/recipe/types";

function inv(partial: Partial<InventoryItem> & Pick<InventoryItem, "display_name">): InventoryItem {
  return {
    id: partial.id ?? "i1",
    user_id: partial.user_id ?? "u1",
    product_id: partial.product_id ?? null,
    competitor_product_id: partial.competitor_product_id ?? null,
    display_name: partial.display_name,
    demand_group_code: partial.demand_group_code ?? null,
    thumbnail_url: partial.thumbnail_url ?? null,
    quantity: partial.quantity ?? 1,
    status: partial.status ?? "sealed",
    source: partial.source ?? "manual",
    source_receipt_id: partial.source_receipt_id ?? null,
    added_at: partial.added_at ?? new Date().toISOString(),
    opened_at: partial.opened_at ?? null,
    consumed_at: partial.consumed_at ?? null,
    best_before: partial.best_before ?? null,
    purchase_date: partial.purchase_date ?? null,
    is_frozen: partial.is_frozen ?? false,
    frozen_at: partial.frozen_at ?? null,
    thawed_at: partial.thawed_at ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
    updated_at: partial.updated_at ?? new Date().toISOString(),
  };
}

describe("sortInventoryForPrompt", () => {
  test("orders soonest best_before first, unknown dates last", () => {
    const a = inv({ display_name: "A", best_before: "2026-04-01" });
    const b = inv({ display_name: "B", best_before: "2026-03-15" });
    const c = inv({ display_name: "C", best_before: null });
    const sorted = sortInventoryForPrompt([a, c, b]).map((x) => x.display_name);
    expect(sorted).toEqual(["B", "A", "C"]);
  });
});

describe("formatPantryForPrompt", () => {
  test("compact format with MHD when best-before within 7 days", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    const iso = soon.toISOString().slice(0, 10);
    const lines = formatPantryForPrompt([
      inv({
        display_name: "Milch",
        quantity: 2,
        status: "opened",
        best_before: `${iso}T00:00:00.000Z`,
      }),
    ]);
    expect(lines).toContain("Milch");
    expect(lines).toContain("×2");
    expect(lines).toContain("offen");
    expect(lines).toContain("⚠️ abl.");
  });

  test("omits MHD when best-before is far in the future", () => {
    const far = new Date();
    far.setDate(far.getDate() + 60);
    const iso = far.toISOString().slice(0, 10);
    const lines = formatPantryForPrompt([
      inv({
        display_name: "H-Milch 1L",
        quantity: 2,
        status: "sealed",
        best_before: `${iso}T12:00:00.000Z`,
      }),
    ]);
    expect(lines).toContain("H-Milch 1L");
    expect(lines).toContain("×2");
    expect(lines).toContain("verschl.");
    expect(lines).not.toContain("abl.");
  });
});

describe("formatCatalogForPrompt", () => {
  test("caps at MAX_CATALOG_PROMPT_PRODUCTS (one € per product)", () => {
    const many: Product[] = Array.from({ length: MAX_CATALOG_PROMPT_PRODUCTS + 40 }, (_, i) => ({
      product_id: `p${i}`,
      name: `P${i}`,
      name_normalized: `p${i}`,
      brand: null,
      demand_sub_group: "Sub",
      demand_group_code: "01",
      price: 1.99,
      price_updated_at: null,
      assortment_type: "daily_range",
      availability: "national",
      region: null,
      country: "DE",
      special_start_date: null,
      special_end_date: null,
      status: "active",
      source: "admin",
      created_at: "",
      updated_at: "",
    }));
    const out = formatCatalogForPrompt(many);
    expect((out.match(/€/g) ?? []).length).toBe(MAX_CATALOG_PROMPT_PRODUCTS);
    expect(out).toMatch(/^SUB:/);
  });

  test("shows dash when price is null", () => {
    const p: Product = {
      product_id: "x",
      name: "X",
      name_normalized: "x",
      brand: null,
      demand_sub_group: null,
      demand_group_code: "01",
      price: null,
      price_updated_at: null,
      assortment_type: "daily_range",
      availability: "national",
      region: null,
      country: "DE",
      special_start_date: null,
      special_end_date: null,
      status: "active",
      source: "admin",
      created_at: "",
      updated_at: "",
    };
    expect(formatCatalogForPrompt([p])).toContain("—");
  });
});

describe("buildCookSystemPrompt", () => {
  test("embeds pantry and catalog blocks", () => {
    const s = buildCookSystemPrompt("PANTRY", "CAT");
    expect(s).toContain("PANTRY");
    expect(s).toContain("CAT");
    expect(s).toMatch(/JSON/i);
  });
});

describe("cookMessageToClaudeText", () => {
  test("returns user content as-is", () => {
    const m: CookChatMessage = { role: "user", content: "Hi", timestamp: "t" };
    expect(cookMessageToClaudeText(m)).toBe("Hi");
  });

  test("extracts message from assistant JSON payload", () => {
    const m: CookChatMessage = {
      role: "assistant",
      content: JSON.stringify({ type: "suggestions", message: "Hallo!" }),
      timestamp: "t",
    };
    expect(cookMessageToClaudeText(m)).toBe("Hallo!");
  });
});
