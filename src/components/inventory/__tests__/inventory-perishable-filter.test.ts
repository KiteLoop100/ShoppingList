import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { filterExpiredPerishables } from "../inventory-perishable-filter";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

/** A fixed instant that is not a DST transition. June 15 2026, 12:00 UTC. */
const FIXED_NOW = new Date("2026-06-15T12:00:00.000Z");

const originalTimeZone =
  process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

function makeItem(
  overrides: Partial<InventoryItem> & { demand_group_code: string | null; updated_at: string },
): InventoryItem {
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
    best_before: null,
    purchase_date: null,
    is_frozen: false,
    frozen_at: null,
    thawed_at: null,
    created_at: overrides.updated_at,
    ...overrides,
  };
}

/** Calendar days before FIXED_NOW, at the same UTC time of day. */
function daysBeforeFixed(days: number): string {
  const date = new Date(FIXED_NOW.getTime());
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

describe("filterExpiredPerishables", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("filters produce item older than 10 days", () => {
    const items = [makeItem({ demand_group_code: "38", updated_at: daysBeforeFixed(11) })];
    expect(filterExpiredPerishables(items)).toHaveLength(0);
  });

  test("keeps produce item younger than 10 days", () => {
    const items = [makeItem({ demand_group_code: "58", updated_at: daysBeforeFixed(9) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("filters chilled item older than 14 days", () => {
    const items = [makeItem({ demand_group_code: "84", updated_at: daysBeforeFixed(15) })];
    expect(filterExpiredPerishables(items)).toHaveLength(0);
  });

  test("keeps chilled item younger than 14 days", () => {
    const items = [makeItem({ demand_group_code: "51", updated_at: daysBeforeFixed(5) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters dry items regardless of age", () => {
    const items = [makeItem({ demand_group_code: "41", updated_at: daysBeforeFixed(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters frozen items regardless of age", () => {
    const items = [makeItem({ demand_group_code: "76", updated_at: daysBeforeFixed(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("never filters items with null demand_group_code", () => {
    const items = [makeItem({ demand_group_code: null, updated_at: daysBeforeFixed(100) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("produce at exactly 10 calendar days is kept (boundary)", () => {
    const items = [makeItem({ demand_group_code: "38", updated_at: daysBeforeFixed(10) })];
    expect(filterExpiredPerishables(items)).toHaveLength(1);
  });

  test("mixed list filters only expired perishables", () => {
    const items = [
      makeItem({ display_name: "Fenchel", demand_group_code: "38", updated_at: daysBeforeFixed(11) }),
      makeItem({ display_name: "Butter", demand_group_code: "83", updated_at: daysBeforeFixed(5) }),
      makeItem({ display_name: "Pasta", demand_group_code: "54", updated_at: daysBeforeFixed(200) }),
      makeItem({ display_name: "TK Spinat", demand_group_code: "76", updated_at: daysBeforeFixed(60) }),
      makeItem({ display_name: "Alte Milch", demand_group_code: "83", updated_at: daysBeforeFixed(20) }),
    ];
    const result = filterExpiredPerishables(items);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.display_name)).toEqual(["Butter", "Pasta", "TK Spinat"]);
  });
});

/**
 * Europe DST 2026: spring forward 2026-03-29 02:00 CET → 03:00 CEST,
 * autumn back 2026-10-25 03:00 CEST → 02:00 CET.
 * Wall clocks below have no "Z", so each zone interprets them as its own local time.
 */
const TIME_ZONES = ["UTC", "Europe/Berlin"] as const;

for (const timeZone of TIME_ZONES) {
  describe(`calendar-day boundaries in ${timeZone}`, () => {
    beforeEach(() => {
      process.env.TZ = timeZone;
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      process.env.TZ = originalTimeZone;
    });

    test("the process calendar is this zone", () => {
      // 2026-10-25 12:00 UTC is 13:00 CET, after the autumn fallback.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
      expect(new Date("2026-10-25T12:00:00Z").getTimezoneOffset()).toBe(
        timeZone === "UTC" ? 0 : -60,
      );
    });

    test("autumn: produce at the same local time 10 calendar days earlier is kept", () => {
      // Berlin elapsed time is 241h (the clock went back). UTC elapsed time is 240h.
      vi.setSystemTime(new Date("2026-10-25T12:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          updated_at: new Date("2026-10-15T12:00:00").toISOString(),
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(1);
    });

    test("autumn: produce 11 calendar days earlier is removed", () => {
      vi.setSystemTime(new Date("2026-10-25T12:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          updated_at: new Date("2026-10-14T12:00:00").toISOString(),
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(0);
    });

    test("spring: produce is kept through the late evening of calendar day 10", () => {
      // Spans the spring-forward. Elapsed time is about 262h, well past 240h.
      vi.setSystemTime(new Date("2026-03-29T23:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          updated_at: new Date("2026-03-19T00:30:00").toISOString(),
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(1);
    });

    test("spring: produce 11 calendar days earlier is removed", () => {
      vi.setSystemTime(new Date("2026-03-29T23:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          updated_at: new Date("2026-03-18T00:30:00").toISOString(),
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(0);
    });

    test("autumn: best_before keeps the whole 3rd calendar day of grace", () => {
      vi.setSystemTime(new Date("2026-10-28T18:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          best_before: "2026-10-25",
          updated_at: "2026-01-01T00:00:00.000Z",
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(1);
    });

    test("autumn: best_before is removed on calendar day 4", () => {
      vi.setSystemTime(new Date("2026-10-29T00:30:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          best_before: "2026-10-25",
          updated_at: "2026-01-01T00:00:00.000Z",
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(0);
    });

    test("spring: best_before keeps the whole 3rd calendar day of grace", () => {
      vi.setSystemTime(new Date("2026-03-29T12:00:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          best_before: "2026-03-26",
          updated_at: "2026-01-01T00:00:00.000Z",
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(1);
    });

    test("spring: best_before is removed on calendar day 4", () => {
      vi.setSystemTime(new Date("2026-03-30T00:30:00"));
      const items = [
        makeItem({
          demand_group_code: "38",
          best_before: "2026-03-26",
          updated_at: "2026-01-01T00:00:00.000Z",
        }),
      ];
      expect(filterExpiredPerishables(items)).toHaveLength(0);
    });
  });
}
