import { describe, test, expect, vi, afterEach } from "vitest";
import { filterExpiredPerishables } from "@/components/inventory/inventory-perishable-filter";
import type { InventoryItem } from "../inventory-types";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "test-1",
    user_id: "u1",
    product_id: "p1",
    competitor_product_id: null,
    display_name: "Test",
    demand_group_code: "62",
    thumbnail_url: null,
    quantity: 1,
    status: "sealed",
    source: "receipt",
    source_receipt_id: null,
    added_at: "2026-03-01T00:00:00Z",
    opened_at: null,
    consumed_at: null,
    best_before: null,
    purchase_date: null,
    is_frozen: false,
    frozen_at: null,
    thawed_at: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterExpiredPerishables", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("keeps items with best_before in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));

    const items = [makeItem({ best_before: "2026-03-20" })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("keeps items with best_before recently expired (within 3 days)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T12:00:00Z"));

    const items = [makeItem({ best_before: "2026-03-10" })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("filters items with best_before expired more than 3 days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));

    const items = [makeItem({ best_before: "2026-03-10" })];
    expect(filterExpiredPerishables(items)).toHaveLength(0);
  });

  test("never filters frozen items even with expired best_before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"));

    const items = [makeItem({ best_before: "2026-03-01", is_frozen: true })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("falls back to category-based filter when best_before is null (produce)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

    const fresh = makeItem({
      id: "fresh",
      demand_group_code: "62",
      best_before: null,
      updated_at: "2026-03-10T00:00:00Z",
    });
    const stale = makeItem({
      id: "stale",
      demand_group_code: "62",
      best_before: null,
      updated_at: "2026-02-01T00:00:00Z",
    });

    const result = filterExpiredPerishables([fresh, stale]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("fresh");
  });

  test("keeps dry goods without best_before regardless of age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));

    const items = [makeItem({
      demand_group_code: "80",
      best_before: null,
      updated_at: "2026-01-01T00:00:00Z",
    })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("handles invalid best_before date gracefully", () => {
    const items = [makeItem({ best_before: "invalid-date" })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });
});
