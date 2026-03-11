import { describe, test, expect } from "vitest";
import { filterExpiredPerishables } from "../inventory-perishable-filter";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

const MS_PER_DAY = 86_400_000;

function makeItem(overrides: Partial<InventoryItem> & { demand_group_code: string | null; updated_at: string }): InventoryItem {
  return {
    id: "test-" + Math.random().toString(36).slice(2, 8),
    user_id: "user-1",
    product_id: "prod-1",
    competitor_product_id: null,
    display_name: "Test Item",
    thumbnail_url: null,
    quantity: 1,
    status: "sealed",
    source: "receipt",
    source_receipt_id: null,
    added_at: overrides.updated_at,
    opened_at: null,
    consumed_at: null,
    created_at: overrides.updated_at,
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

describe("filterExpiredPerishables", () => {
  test("filters produce item older than 10 days", () => {
    const items = [makeItem({ demand_group_code: "38", updated_at: daysAgo(11) })];
    expect(filterExpiredPerishables(items)).toHaveLength(0);
  });

  test("keeps produce item younger than 10 days", () => {
    const items = [makeItem({ demand_group_code: "58", updated_at: daysAgo(9) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("filters chilled item older than 14 days", () => {
    const items = [makeItem({ demand_group_code: "84", updated_at: daysAgo(15) })];
    expect(filterExpiredPerishables(items)).toHaveLength(0);
  });

  test("keeps chilled item younger than 14 days", () => {
    const items = [makeItem({ demand_group_code: "51", updated_at: daysAgo(5) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters dry items regardless of age", () => {
    const items = [makeItem({ demand_group_code: "41", updated_at: daysAgo(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters frozen items regardless of age", () => {
    const items = [makeItem({ demand_group_code: "76", updated_at: daysAgo(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters items with null demand_group_code", () => {
    const items = [makeItem({ demand_group_code: null, updated_at: daysAgo(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("produce at exactly 10 days is kept (boundary)", () => {
    const items = [makeItem({ demand_group_code: "38", updated_at: daysAgo(10) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("mixed list filters only expired perishables", () => {
    const items = [
      makeItem({ display_name: "Fenchel", demand_group_code: "38", updated_at: daysAgo(11) }),
      makeItem({ display_name: "Butter", demand_group_code: "83", updated_at: daysAgo(5) }),
      makeItem({ display_name: "Pasta", demand_group_code: "54", updated_at: daysAgo(200) }),
      makeItem({ display_name: "TK Spinat", demand_group_code: "76", updated_at: daysAgo(60) }),
      makeItem({ display_name: "Alte Milch", demand_group_code: "83", updated_at: daysAgo(20) }),
    ];
    const result = filterExpiredPerishables(items);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.display_name)).toEqual(["Butter", "Pasta", "TK Spinat"]);
  });
});
