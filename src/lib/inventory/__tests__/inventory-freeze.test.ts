import { describe, test, expect } from "vitest";
import { getCategoryGroup, isNativelyFrozen } from "@/lib/list/recent-purchase-categories";
import { filterExpiredPerishables } from "@/components/inventory/inventory-perishable-filter";
import type { InventoryItem } from "../inventory-types";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "test-1",
    user_id: "u1",
    product_id: "p1",
    competitor_product_id: null,
    display_name: "Test Product",
    demand_group_code: "62",
    thumbnail_url: null,
    quantity: 1,
    status: "sealed",
    source: "manual",
    source_receipt_id: null,
    added_at: new Date().toISOString(),
    opened_at: null,
    consumed_at: null,
    best_before: null,
    purchase_date: null,
    is_frozen: false,
    frozen_at: null,
    thawed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getCategoryGroup with isFrozen", () => {
  test("chilled item without frozen flag stays chilled", () => {
    expect(getCategoryGroup("62", false)).toBe("chilled");
  });

  test("chilled item with frozen flag becomes frozen", () => {
    expect(getCategoryGroup("62", true)).toBe("frozen");
  });

  test("produce item with frozen flag becomes frozen", () => {
    expect(getCategoryGroup("38", true)).toBe("frozen");
  });

  test("dry item with frozen flag becomes frozen", () => {
    expect(getCategoryGroup("99", true)).toBe("frozen");
  });

  test("natively frozen item stays frozen regardless of flag", () => {
    expect(getCategoryGroup("75", false)).toBe("frozen");
    expect(getCategoryGroup("75", true)).toBe("frozen");
  });

  test("without isFrozen param, behaves as before", () => {
    expect(getCategoryGroup("62")).toBe("chilled");
    expect(getCategoryGroup("75")).toBe("frozen");
    expect(getCategoryGroup("38")).toBe("produce");
  });
});

describe("isNativelyFrozen", () => {
  test("returns true for TK codes", () => {
    expect(isNativelyFrozen("75")).toBe(true);
    expect(isNativelyFrozen("76")).toBe(true);
    expect(isNativelyFrozen("77")).toBe(true);
    expect(isNativelyFrozen("78")).toBe(true);
  });

  test("returns false for non-TK codes", () => {
    expect(isNativelyFrozen("62")).toBe(false);
    expect(isNativelyFrozen("38")).toBe(false);
    expect(isNativelyFrozen(null)).toBe(false);
  });
});

describe("filterExpiredPerishables with is_frozen", () => {
  test("frozen chilled item is NOT filtered out even if old", () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const frozenItem = makeItem({
      demand_group_code: "62",
      is_frozen: true,
      updated_at: oldDate,
    });
    const result = filterExpiredPerishables([frozenItem]);
    expect(result).toHaveLength(1);
  });

  test("non-frozen chilled item IS filtered out if old", () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const chilledItem = makeItem({
      demand_group_code: "62",
      is_frozen: false,
      updated_at: oldDate,
    });
    const result = filterExpiredPerishables([chilledItem]);
    expect(result).toHaveLength(0);
  });

  test("frozen produce item is NOT filtered out even if old", () => {
    const oldDate = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const frozenProduce = makeItem({
      demand_group_code: "38",
      is_frozen: true,
      updated_at: oldDate,
    });
    const result = filterExpiredPerishables([frozenProduce]);
    expect(result).toHaveLength(1);
  });

  test("dry items are never filtered regardless of is_frozen", () => {
    const oldDate = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const dryItem = makeItem({
      demand_group_code: "99",
      is_frozen: false,
      updated_at: oldDate,
    });
    const result = filterExpiredPerishables([dryItem]);
    expect(result).toHaveLength(1);
  });
});
