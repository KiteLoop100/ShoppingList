import { vi, describe, test, expect, beforeEach } from "vitest";

const mockPairwiseData: Array<{
  store_id: string;
  level: string;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b_count: number;
  b_before_a_count: number;
}> = [];

const mockCheckoffSequences: Array<{
  store_id: string;
  is_valid: boolean;
}> = [];

const mockStores: Array<{
  store_id: string;
  retailer: string;
}> = [];

vi.mock("@/lib/db", () => {
  const whereHandler = (field: string) => ({
    equals: (val: unknown) => ({
      toArray: () => {
        if (field === "level") {
          return Promise.resolve(
            mockPairwiseData.filter((r) => r.level === val)
          );
        }
        if (field === "[store_id+level]") {
          const [storeId, level] = val as [string, string];
          return Promise.resolve(
            mockPairwiseData.filter(
              (r) => r.store_id === storeId && r.level === level
            )
          );
        }
        if (field === "store_id" && mockCheckoffSequences.length > 0) {
          return {
            filter: (fn: (s: { is_valid: boolean }) => boolean) => ({
              count: () =>
                Promise.resolve(
                  mockCheckoffSequences.filter(
                    (s) => s.store_id === val && fn(s)
                  ).length
                ),
            }),
          };
        }
        if (field === "store_id") {
          return Promise.resolve(
            mockStores.filter((s) => s.store_id === val)
          );
        }
        if (field === "retailer") {
          return Promise.resolve(
            mockStores.filter((s) => s.retailer === val)
          );
        }
        return Promise.resolve([]);
      },
      filter: (fn: (s: { is_valid: boolean }) => boolean) => ({
        count: () =>
          Promise.resolve(
            mockCheckoffSequences.filter(
              (s) => s.store_id === val && fn(s)
            ).length
          ),
      }),
      first: () => {
        if (field === "store_id") {
          return Promise.resolve(
            mockStores.find((s) => s.store_id === val) ?? undefined
          );
        }
        return Promise.resolve(undefined);
      },
    }),
  });

  return {
    db: {
      pairwise_comparisons: { where: whereHandler },
      checkoff_sequences: { where: whereHandler },
      stores: { where: whereHandler },
    },
  };
});

const { getHierarchicalOrder } = await import("../hierarchical-order");

describe("getHierarchicalOrder cross-chain aggregation", () => {
  beforeEach(() => {
    mockPairwiseData.length = 0;
    mockCheckoffSequences.length = 0;
    mockStores.length = 0;
  });

  test("uses same-retailer stores for Layer 2 when available", async () => {
    mockStores.push(
      { store_id: "rewe-1", retailer: "REWE" },
      { store_id: "rewe-2", retailer: "REWE" },
      { store_id: "aldi-1", retailer: "ALDI SÜD" }
    );

    // REWE-2 has pairwise data: Obst before Milch
    mockPairwiseData.push({
      store_id: "rewe-2",
      level: "group",
      scope: null,
      item_a: "Milch",
      item_b: "Obst",
      a_before_b_count: 0,
      b_before_a_count: 10,
    });

    // ALDI has opposite: Milch before Obst
    mockPairwiseData.push({
      store_id: "aldi-1",
      level: "group",
      scope: null,
      item_a: "Milch",
      item_b: "Obst",
      a_before_b_count: 10,
      b_before_a_count: 0,
    });

    const result = await getHierarchicalOrder({
      storeId: "rewe-1",
      groups: ["Obst", "Milch"],
      subgroupsByGroup: new Map(),
      productsByScope: new Map(),
      defaultGroupOrder: ["Milch", "Obst"],
      defaultSubgroupOrder: () => [],
      defaultProductOrder: () => [],
    });

    // Should prefer REWE chain data (Obst before Milch), not ALDI data
    expect(result.groupOrder).toEqual(["Obst", "Milch"]);
  });

  test("falls back to all stores when no same-retailer data", async () => {
    mockStores.push({ store_id: "edeka-1", retailer: "EDEKA" });

    // Only ALDI data exists
    mockPairwiseData.push({
      store_id: "aldi-1",
      level: "group",
      scope: null,
      item_a: "Brot",
      item_b: "Milch",
      a_before_b_count: 10,
      b_before_a_count: 0,
    });

    const result = await getHierarchicalOrder({
      storeId: "edeka-1",
      groups: ["Milch", "Brot"],
      subgroupsByGroup: new Map(),
      productsByScope: new Map(),
      defaultGroupOrder: ["Milch", "Brot"],
      defaultSubgroupOrder: () => [],
      defaultProductOrder: () => [],
    });

    // Should fall back to all stores data (Brot before Milch from ALDI)
    expect(result.groupOrder).toEqual(["Brot", "Milch"]);
  });

  test("uses defaults when no pairwise data exists", async () => {
    mockStores.push({ store_id: "dm-1", retailer: "dm" });

    const result = await getHierarchicalOrder({
      storeId: "dm-1",
      groups: ["Brot", "Obst"],
      subgroupsByGroup: new Map(),
      productsByScope: new Map(),
      defaultGroupOrder: ["Obst", "Brot"],
      defaultSubgroupOrder: () => [],
      defaultProductOrder: () => [],
    });

    // With only default prior, Obst should come before Brot
    expect(result.groupOrder).toEqual(["Obst", "Brot"]);
  });
});
