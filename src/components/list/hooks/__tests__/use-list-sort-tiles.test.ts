import { vi, describe, test, expect } from "vitest";
import type { LocalListItem } from "@/lib/db";
import type { DemandGroup } from "@/types";
import type { ProductMetaForSort } from "@/lib/list/list-helpers";

vi.mock("@/lib/store/aisle-order", () => ({
  getDemandGroupOrderForList: vi.fn().mockResolvedValue(new Map<string, number>()),
}));

const mockGetHierarchicalOrder = vi.fn();
vi.mock("@/lib/store/hierarchical-order", () => ({
  getHierarchicalOrder: (...args: unknown[]) => mockGetHierarchicalOrder(...args),
}));

vi.mock("@/lib/store/sync-pairwise-from-supabase", () => ({
  syncPairwiseFromSupabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { sortListItems } from "../use-list-sort";

function makeItem(overrides: Partial<LocalListItem> = {}): LocalListItem {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: null,
    custom_name: null,
    display_name: "Test Item",
    quantity: 1,
    is_checked: false,
    checked_at: null,
    sort_position: 0,
    demand_group_code: "01-Obst",
    added_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const demandGroups: DemandGroup[] = [
  { code: "01-Obst", name: "Obst & Gemüse", name_en: "Fruit & Veg", icon: "🍎", color: "#4caf50", sort_position: 1 },
  { code: "02-Milch", name: "Milchprodukte", name_en: "Dairy", icon: "🥛", color: "#2196f3", sort_position: 2 },
];

const demandGroupMap = new Map<string, DemandGroup>(
  demandGroups.map(dg => [dg.code, dg]),
);

const productMetaMap = new Map<string, ProductMetaForSort>();
const syncedStoreIds = { current: new Set<string>() };

describe("sortListItems with shopping-order-tiles", () => {
  test("shopping-order-tiles sorts items the same as shopping-order", async () => {
    mockGetHierarchicalOrder.mockResolvedValue({
      groupOrder: ["01-Obst", "02-Milch"],
      subgroupOrder: new Map(),
      productOrder: new Map(),
    });

    const items = [
      makeItem({ item_id: "i1", demand_group_code: "02-Milch", display_name: "Milch" }),
      makeItem({ item_id: "i2", demand_group_code: "01-Obst", display_name: "Apfel" }),
    ];

    const shoppingOrderResult = await sortListItems(
      items, "shopping-order", null, demandGroups, demandGroupMap, productMetaMap, syncedStoreIds,
    );

    const tilesResult = await sortListItems(
      items, "shopping-order-tiles", null, demandGroups, demandGroupMap, productMetaMap, syncedStoreIds,
    );

    expect(tilesResult.unchecked.map(i => i.item_id))
      .toEqual(shoppingOrderResult.unchecked.map(i => i.item_id));
  });

  test("shopping-order-tiles uses hierarchical order, not sort_position", async () => {
    mockGetHierarchicalOrder.mockResolvedValue({
      groupOrder: ["02-Milch", "01-Obst"],
      subgroupOrder: new Map(),
      productOrder: new Map(),
    });

    const items = [
      makeItem({ item_id: "i1", demand_group_code: "01-Obst", sort_position: 0, display_name: "Apfel" }),
      makeItem({ item_id: "i2", demand_group_code: "02-Milch", sort_position: 1, display_name: "Milch" }),
    ];

    const result = await sortListItems(
      items, "shopping-order-tiles", null, demandGroups, demandGroupMap, productMetaMap, syncedStoreIds,
    );

    expect(result.unchecked[0].item_id).toBe("i2");
    expect(result.unchecked[1].item_id).toBe("i1");
  });
});

describe("SortMode cycling", () => {
  const SORT_CYCLE = ["my-order", "shopping-order", "shopping-order-tiles"] as const;

  function getNextMode(current: string): string {
    const idx = SORT_CYCLE.indexOf(current as typeof SORT_CYCLE[number]);
    return SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
  }

  test("cycles my-order -> shopping-order", () => {
    expect(getNextMode("my-order")).toBe("shopping-order");
  });

  test("cycles shopping-order -> shopping-order-tiles", () => {
    expect(getNextMode("shopping-order")).toBe("shopping-order-tiles");
  });

  test("cycles shopping-order-tiles -> my-order", () => {
    expect(getNextMode("shopping-order-tiles")).toBe("my-order");
  });

  test("full cycle returns to start", () => {
    let mode: string = "my-order";
    mode = getNextMode(mode);
    mode = getNextMode(mode);
    mode = getNextMode(mode);
    expect(mode).toBe("my-order");
  });
});
