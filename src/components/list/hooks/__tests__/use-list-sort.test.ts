import { vi, describe, test, expect, beforeEach } from "vitest";
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
  { code: "03-Brot", name: "Brot & Backwaren", name_en: "Bakery", icon: "🍞", color: "#ff9800", sort_position: 3 },
];

const demandGroupMap = new Map<string, DemandGroup>(
  demandGroups.map(dg => [dg.code, dg]),
);

const emptyProductMeta = new Map<string, ProductMetaForSort>();
const syncedStoreIds = { current: new Set<string>() };

describe("sortListItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncedStoreIds.current.clear();
  });

  // ── my-order ─────────────────────────────────────────────────────────

  test("'my-order' sorts unchecked items by sort_position", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "a", sort_position: 3, demand_group_code: "01-Obst" }),
      makeItem({ item_id: "b", sort_position: 1, demand_group_code: "02-Milch" }),
      makeItem({ item_id: "c", sort_position: 2, demand_group_code: "01-Obst" }),
    ];

    const result = await sortListItems(
      items, "my-order", null, demandGroups, demandGroupMap, emptyProductMeta, syncedStoreIds,
    );

    const ids = result.unchecked.map(i => i.item_id);
    expect(ids).toEqual(["b", "c", "a"]);
  });

  test("'my-order' preserves add order when sort_positions are equal", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "first", sort_position: 0, demand_group_code: "01-Obst" }),
      makeItem({ item_id: "second", sort_position: 0, demand_group_code: "01-Obst" }),
    ];

    const result = await sortListItems(
      items, "my-order", null, demandGroups, demandGroupMap, emptyProductMeta, syncedStoreIds,
    );

    const ids = result.unchecked.map(i => i.item_id);
    expect(ids[0]).toBe("first");
    expect(ids[1]).toBe("second");
  });

  // ── category sort (default) ──────────────────────────────────────────

  test("default sort groups items by demand_group sort_position", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "brot", demand_group_code: "03-Brot", sort_position: 0 }),
      makeItem({ item_id: "obst", demand_group_code: "01-Obst", sort_position: 0 }),
      makeItem({ item_id: "milch", demand_group_code: "02-Milch", sort_position: 0 }),
    ];

    const result = await sortListItems(
      items, "category" as any, null, demandGroups, demandGroupMap, emptyProductMeta, syncedStoreIds,
    );

    const ids = result.unchecked.map(i => i.item_id);
    expect(ids).toEqual(["obst", "milch", "brot"]);
  });

  // ── shopping-order ───────────────────────────────────────────────────

  test("'shopping-order' uses hierarchical order to group by demand_group", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "s-brot", demand_group_code: "03-Brot", product_id: "p3" }),
      makeItem({ item_id: "s-obst", demand_group_code: "01-Obst", product_id: "p1" }),
      makeItem({ item_id: "s-milch", demand_group_code: "02-Milch", product_id: "p2" }),
    ];
    const productMetaMap = new Map<string, ProductMetaForSort>([
      ["p1", { demand_group_code: "01-Obst", demand_sub_group: null, popularity_score: 0.5 }],
      ["p2", { demand_group_code: "02-Milch", demand_sub_group: null, popularity_score: 0.5 }],
      ["p3", { demand_group_code: "03-Brot", demand_sub_group: null, popularity_score: 0.5 }],
    ]);

    mockGetHierarchicalOrder.mockResolvedValue({
      groupOrder: ["02-Milch", "01-Obst", "03-Brot"],
      subgroupOrder: new Map(),
      productOrder: new Map(),
    });

    const result = await sortListItems(
      items, "shopping-order", "store-1", demandGroups, demandGroupMap, productMetaMap, syncedStoreIds,
    );

    const ids = result.unchecked.map(i => i.item_id);
    expect(ids[0]).toBe("s-milch");
    expect(ids[1]).toBe("s-obst");
    expect(ids[2]).toBe("s-brot");
  });

  // ── Aktionsartikel at end ────────────────────────────────────────────

  test("'shopping-order' places Aktionsartikel group at end", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "regular", demand_group_code: "01-Obst", product_id: "p-reg" }),
      makeItem({ item_id: "special", demand_group_code: "02-Milch", product_id: "p-special" }),
    ];
    const productMetaMap = new Map<string, ProductMetaForSort>([
      ["p-reg", { demand_group_code: "01-Obst", demand_sub_group: null, popularity_score: 0.5 }],
      ["p-special", { demand_group_code: "02-Milch", demand_sub_group: null, popularity_score: 0.5, is_special: true }],
    ]);

    mockGetHierarchicalOrder.mockResolvedValue({
      groupOrder: ["01-Obst", "02-Milch", "AK"],
      subgroupOrder: new Map(),
      productOrder: new Map(),
    });

    const result = await sortListItems(
      items, "shopping-order", "store-1", demandGroups, demandGroupMap, productMetaMap, syncedStoreIds,
    );

    const ids = result.unchecked.map(i => i.item_id);
    expect(ids.indexOf("regular")).toBeLessThan(ids.indexOf("special"));
  });

  // ── checked / deferred separation ────────────────────────────────────

  test("separates checked items into checked list", async () => {
    const items: LocalListItem[] = [
      makeItem({ item_id: "active", is_checked: false }),
      makeItem({ item_id: "done", is_checked: true, checked_at: "2026-03-04T10:00:00Z" }),
    ];

    const result = await sortListItems(
      items, "my-order", null, demandGroups, demandGroupMap, emptyProductMeta, syncedStoreIds,
    );

    expect(result.unchecked.map(i => i.item_id)).toEqual(["active"]);
    expect(result.checked.map(i => i.item_id)).toEqual(["done"]);
  });

  test("separates deferred items into deferred list", async () => {
    const deferredItem = makeItem({ item_id: "deferred-1" });
    (deferredItem as any).is_deferred = true;
    (deferredItem as any).available_from = "2026-04-01";
    (deferredItem as any).deferred_reason = "special";

    const items: LocalListItem[] = [
      makeItem({ item_id: "active" }),
      deferredItem,
    ];

    const result = await sortListItems(
      items, "my-order", null, demandGroups, demandGroupMap, emptyProductMeta, syncedStoreIds,
    );

    expect(result.unchecked.map(i => i.item_id)).toEqual(["active"]);
    expect(result.deferred.map(i => i.item_id)).toEqual(["deferred-1"]);
  });
});
