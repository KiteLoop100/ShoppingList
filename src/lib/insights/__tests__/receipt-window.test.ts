import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchReceiptWindowStatus,
  formatReceiptDate,
  windowCutoffDate,
} from "@/lib/insights/receipt-window";

interface FakeResults {
  count: number | null;
  countError?: string;
  latest: { purchase_date: string }[] | null;
  latestError?: string;
}

/** Minimal chainable fake: head:true selects are the count query, others the "latest date" query. */
function fakeSupabase(results: FakeResults) {
  const gte = vi.fn();
  const from = vi.fn(() => ({
    select: (_cols: string, opts?: { head?: boolean }) => {
      const isCount = opts?.head === true;
      const chain: Record<string, unknown> = {};
      const resolveValue = isCount
        ? { count: results.count, error: results.countError ? { message: results.countError } : null }
        : { data: results.latest, error: results.latestError ? { message: results.latestError } : null };
      for (const m of ["gte", "not", "order", "limit"]) {
        chain[m] = (...args: unknown[]) => {
          if (m === "gte") gte(...args);
          return chain;
        };
      }
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(res);
      return chain;
    },
  }));
  return { client: { from } as unknown as SupabaseClient, from, gte };
}

const NOW = new Date("2026-10-25T12:00:00Z");

describe("fetchReceiptWindowStatus", () => {
  test("no receipts at all: count 0 and no latest date", async () => {
    const { client } = fakeSupabase({ count: 0, latest: [] });
    await expect(fetchReceiptWindowStatus(client, NOW)).resolves.toEqual({
      countInWindow: 0,
      latestReceiptDate: null,
    });
  });

  test("only older receipts: count 0 but latest date is returned", async () => {
    const { client, gte } = fakeSupabase({ count: 0, latest: [{ purchase_date: "2026-07-13" }] });
    await expect(fetchReceiptWindowStatus(client, NOW)).resolves.toEqual({
      countInWindow: 0,
      latestReceiptDate: "2026-07-13",
    });
    expect(gte).toHaveBeenCalledWith("purchase_date", "2026-07-27");
  });

  test("3 or more receipts in the window: unchanged, no second query", async () => {
    const { client, from } = fakeSupabase({ count: 3, latest: [{ purchase_date: "2026-10-20" }] });
    await expect(fetchReceiptWindowStatus(client, NOW)).resolves.toEqual({
      countInWindow: 3,
      latestReceiptDate: null,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  test("null count is treated as 0", async () => {
    const { client } = fakeSupabase({ count: null, latest: [] });
    expect((await fetchReceiptWindowStatus(client, NOW)).countInWindow).toBe(0);
  });

  test("count query error throws (caller falls back to the normal page)", async () => {
    const { client } = fakeSupabase({ count: null, countError: "boom", latest: [] });
    await expect(fetchReceiptWindowStatus(client, NOW)).rejects.toThrow("boom");
  });

  test("latest-date query error only drops the date line", async () => {
    const { client } = fakeSupabase({ count: 1, latest: null, latestError: "nope" });
    await expect(fetchReceiptWindowStatus(client, NOW)).resolves.toEqual({
      countInWindow: 1,
      latestReceiptDate: null,
    });
  });
});

describe("windowCutoffDate", () => {
  test("is 90 days before now by default", () => {
    expect(windowCutoffDate(NOW)).toBe("2026-07-27");
  });
});

describe("formatReceiptDate", () => {
  test("formats German dates without time-zone shift", () => {
    expect(formatReceiptDate("2026-07-13", "de")).toBe("13.07.2026");
  });

  test("formats English dates", () => {
    expect(formatReceiptDate("2026-07-13", "en")).toBe("07/13/2026");
  });

  test("returns null for malformed input", () => {
    expect(formatReceiptDate("not-a-date", "de")).toBeNull();
    expect(formatReceiptDate("", "de")).toBeNull();
  });
});
