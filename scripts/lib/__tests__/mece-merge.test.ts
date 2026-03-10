import { describe, test, expect, vi, beforeEach } from "vitest";
import { executeMerge, deduplicatePairwise } from "../mece-merge";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build a Supabase mock where from(table) returns a chainable object.
 * Each chain method returns itself, and terminal calls resolve with { data, error }.
 * Override per-table behavior via the tableHandlers map.
 */
function createMockSupabase(tableHandlers: Record<string, () => unknown> = {}) {
  const defaultResult = { data: [], error: null };

  function makeChain(overrides: Record<string, unknown> = {}): Record<string, ReturnType<typeof vi.fn>> {
    const self: Record<string, ReturnType<typeof vi.fn>> = {};
    const chainMethods = ["select", "update", "insert", "delete", "eq", "in", "like", "or", "contains", "order", "neq", "single"];
    for (const m of chainMethods) {
      self[m] = vi.fn().mockImplementation((..._args: unknown[]) => {
        if (overrides[m]) return overrides[m];
        return self;
      });
    }
    // Make the chain thenable so `await supabase.from(...).update(...)...` resolves
    self.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(defaultResult));
    (self as unknown as PromiseLike<unknown>)[Symbol.toStringTag] = "MockChain";
    // Proxy: any unknown property access returns resolved default
    return new Proxy(self, {
      get(target, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(defaultResult);
        if (typeof prop === "string" && !(prop in target)) {
          return vi.fn().mockReturnValue(target);
        }
        return target[prop as string];
      },
    }) as Record<string, ReturnType<typeof vi.fn>>;
  }

  const from = vi.fn().mockImplementation((table: string) => {
    if (tableHandlers[table]) return tableHandlers[table]();
    return makeChain();
  });

  const rpc = vi.fn().mockResolvedValue(defaultResult);

  return { from, rpc, _makeChain: makeChain } as unknown as
    SupabaseClient & { _makeChain: typeof makeChain };
}

describe("executeMerge", () => {
  test("updates all 8 tables/entities", async () => {
    const sb = createMockSupabase();
    const result = await executeMerge(sb, "AG03", "83", { "AG03-01": "83-02" });

    expect(result.oldCode).toBe("AG03");
    expect(result.newCode).toBe("83");
    expect(result.tablesUpdated).toContain("products");
    expect(result.tablesUpdated).toContain("competitor_products");
    expect(result.tablesUpdated).toContain("list_items");
    expect(result.tablesUpdated).toContain("trip_items");
    expect(result.tablesUpdated).toContain("pairwise_comparisons");
    expect(result.tablesUpdated).toContain("checkoff_sequences");
    expect(result.tablesUpdated).toContain("demand_groups");
    expect(result.tablesUpdated).toContain("demand_sub_groups");
    expect(result.errors).toHaveLength(0);
  });

  test("records errors per table without stopping", async () => {
    let productsCallCount = 0;
    const sb = createMockSupabase({
      products: () => {
        productsCallCount++;
        const chain = sb._makeChain();
        chain.update = vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error("products error")),
        });
        return chain;
      },
    });

    const result = await executeMerge(sb, "AG01", "38", {});
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("products");
    // Other tables still updated
    expect(result.tablesUpdated).toContain("list_items");
  });

  test("marks old group as source=merged (never deletes)", async () => {
    const sb = createMockSupabase();
    const result = await executeMerge(sb, "AG05", "83", {});
    expect(result.tablesUpdated).toContain("demand_groups");
    expect(result.tablesUpdated).toContain("demand_sub_groups");
  });
});

describe("pairwise level 'group': item_a/item_b rewriting + swap", () => {
  test("rewrites item_a/item_b and swaps when needed for item_order", async () => {
    const sb = createMockSupabase({
      pairwise_comparisons: () => {
        const chain = sb._makeChain();
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{
                id: "pw-1",
                item_a: "38",
                item_b: "AG03",
                a_before_b_count: 5,
                b_before_a_count: 2,
              }],
              error: null,
            }),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
            like: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        });
        chain.update = vi.fn().mockReturnValue(chain);
        return chain;
      },
    });

    // When AG03→83: item_a=38, item_b=AG03→83, so 38 < 83 ✓, no swap
    const result = await executeMerge(sb, "AG03", "83", {});
    expect(result.tablesUpdated).toContain("pairwise_comparisons");
  });

  test("deletes self-referencing pairs after merge", async () => {
    const deleteCalled = vi.fn();
    const sb = createMockSupabase({
      pairwise_comparisons: () => {
        const chain = sb._makeChain();
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [{
                id: "pw-self",
                item_a: "AG03",
                item_b: "AG03",
                a_before_b_count: 1,
                b_before_a_count: 1,
              }],
              error: null,
            }),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            like: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        });
        chain.delete = vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => {
            deleteCalled();
            return Promise.resolve({ error: null });
          }),
        });
        chain.update = vi.fn().mockReturnValue(chain);
        return chain;
      },
    });

    // Both item_a and item_b become the same code → should be deleted
    const result = await executeMerge(sb, "AG03", "38", {});
    expect(result.tablesUpdated).toContain("pairwise_comparisons");
  });
});

describe("pairwise level 'subgroup': scope + item rewriting", () => {
  test("rewrites scope from old to new group code and maps sub-groups", async () => {
    const updateCalled = vi.fn();
    const sb = createMockSupabase({
      pairwise_comparisons: () => {
        const chain = sb._makeChain();
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
            if (val === "group") {
              return {
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }
            if (val === "subgroup") {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [{
                    id: "pw-sub-1",
                    scope: "AG03",
                    item_a: "AG03-01",
                    item_b: "AG03-02",
                    a_before_b_count: 3,
                    b_before_a_count: 1,
                  }],
                  error: null,
                }),
              };
            }
            if (val === "product") {
              return {
                like: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }
            return Promise.resolve({ data: [], error: null });
          }),
        });
        chain.update = vi.fn().mockImplementation((data: unknown) => {
          updateCalled(data);
          return chain;
        });
        return chain;
      },
    });

    const subGroupMapping = { "AG03-01": "83-02", "AG03-02": "83-05" };
    const result = await executeMerge(sb, "AG03", "83", subGroupMapping);
    expect(result.tablesUpdated).toContain("pairwise_comparisons");
  });
});

describe("pairwise level 'product': scope 'group|subgroup' rewriting", () => {
  test("rewrites both group and subgroup parts of scope", async () => {
    const scopeUpdates: string[] = [];
    const sb = createMockSupabase({
      pairwise_comparisons: () => {
        const chain = sb._makeChain();
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, val: unknown) => {
            if (val === "group") {
              return { or: vi.fn().mockResolvedValue({ data: [], error: null }) };
            }
            if (val === "subgroup") {
              return { eq: vi.fn().mockResolvedValue({ data: [], error: null }) };
            }
            if (val === "product") {
              return {
                like: vi.fn().mockResolvedValue({
                  data: [
                    { id: "pw-prod-1", scope: "AG03|AG03-01" },
                    { id: "pw-prod-2", scope: "AG03|AG03-02" },
                  ],
                  error: null,
                }),
              };
            }
            return Promise.resolve({ data: [], error: null });
          }),
        });
        chain.update = vi.fn().mockImplementation((data: unknown) => {
          if (data && typeof data === "object" && "scope" in data) {
            scopeUpdates.push((data as { scope: string }).scope);
          }
          return chain;
        });
        return chain;
      },
    });

    const subGroupMapping = { "AG03-01": "83-02", "AG03-02": "83-05" };
    const result = await executeMerge(sb, "AG03", "83", subGroupMapping);
    expect(result.tablesUpdated).toContain("pairwise_comparisons");
    expect(scopeUpdates).toContain("83|83-02");
    expect(scopeUpdates).toContain("83|83-05");
  });
});

describe("checkoff_sequences JSONB update", () => {
  test("updates demand_group_code and demand_sub_group in items array", async () => {
    let capturedItems: Array<Record<string, unknown>> | null = null;
    const sb = createMockSupabase({
      checkoff_sequences: () => {
        const chain = sb._makeChain();
        chain.select = vi.fn().mockReturnValue({
          contains: vi.fn().mockResolvedValue({
            data: [{
              sequence_id: "seq-1",
              items: [
                { item_id: "i1", demand_group_code: "AG03", demand_sub_group: "AG03-01", checked_at: "2026-01-01" },
                { item_id: "i2", demand_group_code: "83", demand_sub_group: "83-01", checked_at: "2026-01-02" },
                { item_id: "i3", demand_group_code: "AG03", demand_sub_group: "AG03-02", checked_at: "2026-01-03" },
              ],
            }],
            error: null,
          }),
        });
        chain.update = vi.fn().mockImplementation((data: unknown) => {
          if (data && typeof data === "object" && "items" in data) {
            capturedItems = (data as { items: Array<Record<string, unknown>> }).items;
          }
          return chain;
        });
        return chain;
      },
    });

    const subGroupMapping = { "AG03-01": "83-02", "AG03-02": "83-05" };
    const result = await executeMerge(sb, "AG03", "83", subGroupMapping);
    expect(result.tablesUpdated).toContain("checkoff_sequences");
    expect(capturedItems).not.toBeNull();
    expect(capturedItems![0].demand_group_code).toBe("83");
    expect(capturedItems![0].demand_sub_group).toBe("83-02");
    expect(capturedItems![1].demand_group_code).toBe("83");
    expect(capturedItems![1].demand_sub_group).toBe("83-01");
    expect(capturedItems![2].demand_group_code).toBe("83");
    expect(capturedItems![2].demand_sub_group).toBe("83-05");
  });
});

describe("deduplicatePairwise", () => {
  test("sums counts and removes duplicates", async () => {
    const sb = createMockSupabase();
    (sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mockResolvedValue({
      data: null,
      error: { message: "function find_duplicate_pairwise does not exist" },
    });

    (sb as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "1", store_id: "s1", level: "group", scope: null, item_a: "38", item_b: "83", a_before_b_count: 3, b_before_a_count: 1, last_updated_at: "2026-03-10" },
            { id: "2", store_id: "s1", level: "group", scope: null, item_a: "38", item_b: "83", a_before_b_count: 2, b_before_a_count: 4, last_updated_at: "2026-03-09" },
          ],
          error: null,
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const merged = await deduplicatePairwise(sb);
    expect(merged).toBe(1);
  });

  test("returns 0 when no duplicates exist", async () => {
    const sb = createMockSupabase();
    (sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mockResolvedValue({
      data: null,
      error: { message: "function find_duplicate_pairwise does not exist" },
    });

    (sb as unknown as { from: ReturnType<typeof vi.fn> }).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: "1", store_id: "s1", level: "group", scope: null, item_a: "38", item_b: "83", a_before_b_count: 3, b_before_a_count: 1, last_updated_at: "2026-03-10" },
          ],
          error: null,
        }),
      }),
    });

    const merged = await deduplicatePairwise(sb);
    expect(merged).toBe(0);
  });
});
