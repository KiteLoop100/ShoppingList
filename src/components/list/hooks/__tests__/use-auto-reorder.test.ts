import { vi, describe, test, expect, beforeEach } from "vitest";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { AutoReorderSetting } from "@/lib/list/auto-reorder-service";
import type { LocalListItem, LocalShoppingList } from "@/lib/db";
import type { DemandGroup, Product } from "@/types";

const mockAddListItem = vi.fn().mockResolvedValue({});
const mockUpdateListItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/list", () => ({
  addListItem: (...args: unknown[]) => mockAddListItem(...args),
  updateListItem: (...args: unknown[]) => mockUpdateListItem(...args),
}));

import {
  isDeferredSpecial,
  computeReorderActivationDate,
  processAutoReorder,
} from "../use-auto-reorder";

function makeListItem(overrides: Partial<LocalListItem> = {}): LocalListItem {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Test Item",
    quantity: 1,
    is_checked: false,
    checked_at: null,
    sort_position: 0,
    demand_group_code: "01",
    added_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const stubList: LocalShoppingList = {
  list_id: "list-1",
  user_id: "user-1",
  name: "Einkaufsliste",
  store_id: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const stubDemandGroupMap = new Map<string, DemandGroup>([
  ["01", { code: "01", name: "Obst", name_en: "Fruit", icon: "🍎", color: "#ff0000", sort_position: 1 }],
]);

describe("isDeferredSpecial", () => {
  test("returns true when special_start_date is in the future", () => {
    const futureDate = "2099-12-31";
    expect(isDeferredSpecial("special", futureDate, "DE")).toBe(true);
  });

  test("returns true for special_food assortment type", () => {
    expect(isDeferredSpecial("special_food", "2099-06-01", "DE")).toBe(true);
  });

  test("returns true for special_nonfood assortment type", () => {
    expect(isDeferredSpecial("special_nonfood", "2099-06-01", "DE")).toBe(true);
  });

  test("returns false for non-special assortment types", () => {
    expect(isDeferredSpecial("daily_range", "2099-12-31", "DE")).toBe(false);
  });

  test("returns false when specialStartDate is null", () => {
    expect(isDeferredSpecial("special", null, "DE")).toBe(false);
  });

  test("returns false when special_start_date is in the past", () => {
    expect(isDeferredSpecial("special", "2020-01-01", "DE")).toBe(false);
  });
});

describe("computeReorderActivationDate", () => {
  test("adds days correctly", () => {
    const result = computeReorderActivationDate("2026-03-01T10:00:00Z", 3, "days");
    expect(result).toBe("2026-03-04");
  });

  test("adds weeks correctly", () => {
    const result = computeReorderActivationDate("2026-03-01T10:00:00Z", 2, "weeks");
    expect(result).toBe("2026-03-15");
  });

  test("adds months correctly", () => {
    const result = computeReorderActivationDate("2026-01-15T10:00:00Z", 1, "months");
    expect(result).toBe("2026-02-15");
  });
});

describe("processAutoReorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("marks elsewhere item as deferred with reason 'elsewhere'", async () => {
    const item = makeListItem({
      item_id: "e1",
      buy_elsewhere_retailer: "REWE",
      competitor_product_id: "comp-1",
    });
    const items = [item];

    await processAutoReorder(
      items,
      new Map(),
      new Map(),
      [],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    const result = item as ListItemWithMeta;
    expect(result.is_deferred).toBe(true);
    expect(result.deferred_reason).toBe("elsewhere");
    expect(result.is_buy_elsewhere).toBe(true);
    expect(result.buy_elsewhere_retailer).toBe("REWE");
  });

  test("marks manually deferred item when deferred_until is in the future", async () => {
    const item = makeListItem({
      item_id: "m1",
      deferred_until: "2099-12-31",
    });
    const items = [item];

    await processAutoReorder(
      items,
      new Map(),
      new Map(),
      [],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    const result = item as ListItemWithMeta;
    expect(result.is_deferred).toBe(true);
    expect(result.deferred_reason).toBe("manual");
    expect(result.available_from).toBe("2099-12-31");
  });

  test("clears expired deferred_until by calling updateListItem", async () => {
    const item = makeListItem({
      item_id: "exp1",
      deferred_until: "2020-01-01",
    });

    await processAutoReorder(
      [item],
      new Map(),
      new Map(),
      [],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    expect(mockUpdateListItem).toHaveBeenCalledWith("exp1", { deferred_until: null });
  });

  test("marks item with has_auto_reorder when product_id is in reorderMap", async () => {
    const item = makeListItem({ item_id: "ar1", product_id: "prod-x" });
    const reorderMap = new Map<string, AutoReorderSetting>([
      ["prod-x", {
        id: "s1", user_id: "u1", product_id: "prod-x",
        reorder_value: 7, reorder_unit: "days", last_checked_at: "2026-01-01T00:00:00Z", is_active: true,
      }],
    ]);

    await processAutoReorder(
      [item],
      reorderMap,
      new Map(),
      [],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    expect((item as ListItemWithMeta).has_auto_reorder).toBe(true);
  });

  test("items without auto-reorder setting remain unchanged", async () => {
    const item = makeListItem({ item_id: "plain1", product_id: "prod-plain" });

    await processAutoReorder(
      [item],
      new Map(),
      new Map(),
      [],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    expect((item as ListItemWithMeta).has_auto_reorder).toBeUndefined();
    expect((item as ListItemWithMeta).is_deferred).toBeUndefined();
  });

  test("adds reorder item to list when activation date has passed", async () => {
    const items: LocalListItem[] = [];
    const product: Product = {
      product_id: "reorder-prod",
      name: "Milch",
      name_normalized: "milch",
      brand: null,
      price: 1.19,
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
      demand_group: "Milch",
      demand_group_code: "01",
      popularity_score: 0.8,
    };
    const reorderMap = new Map<string, AutoReorderSetting>([
      ["reorder-prod", {
        id: "s2", user_id: "u1", product_id: "reorder-prod",
        reorder_value: 7, reorder_unit: "days",
        last_checked_at: "2026-02-01T00:00:00Z",
        is_active: true,
      }],
    ]);

    await processAutoReorder(
      items,
      reorderMap,
      new Map(),
      [product],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    expect(mockAddListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        list_id: "list-1",
        product_id: "reorder-prod",
        display_name: "Milch",
        quantity: 1,
      }),
    );
  });

  test("pushes future reorder item as deferred with reason 'reorder'", async () => {
    const items: LocalListItem[] = [];
    const product: Product = {
      product_id: "future-prod",
      name: "Butter",
      name_normalized: "butter",
      brand: null,
      price: 2.49,
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
      demand_group: "Butter",
      demand_group_code: "01",
      popularity_score: 0.5,
    };
    const reorderMap = new Map<string, AutoReorderSetting>([
      ["future-prod", {
        id: "s3", user_id: "u1", product_id: "future-prod",
        reorder_value: 30, reorder_unit: "days",
        last_checked_at: "2026-03-01T00:00:00Z",
        is_active: true,
      }],
    ]);

    await processAutoReorder(
      items,
      reorderMap,
      new Map(),
      [product],
      [],
      stubList,
      stubDemandGroupMap,
      "2026-03-04",
    );

    expect(mockAddListItem).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
    const pushed = items[0] as ListItemWithMeta;
    expect(pushed.is_deferred).toBe(true);
    expect(pushed.deferred_reason).toBe("reorder");
    expect(pushed.display_name).toBe("Butter");
  });
});
