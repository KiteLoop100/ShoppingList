import { describe, test, expect } from "vitest";
import { groupByKey } from "../use-list-derived";
import { groupConsecutiveByCategory } from "../../list-section";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

function makeItem(overrides: Partial<ListItemWithMeta> = {}): ListItemWithMeta {
  return {
    item_id: "i1", list_id: "l1", product_id: "p1", custom_name: null,
    display_name: "Milk", quantity: 1, is_checked: false, checked_at: null,
    sort_position: 0, demand_group_code: "01", added_at: "",
    demand_group_name: "Dairy", demand_group_icon: "", demand_group_sort_position: 1,
    category_name: "Dairy", category_icon: "", category_sort_position: 1, price: 1.29,
    ...overrides,
  } as ListItemWithMeta;
}

describe("groupByKey", () => {
  test("groups items by key function and sorts by key", () => {
    const items = [
      { id: "1", group: "B" },
      { id: "2", group: "A" },
      { id: "3", group: "B" },
    ];
    const result = groupByKey(items, i => i.group);
    expect(result).toHaveLength(2);
    expect(result[0][0]).toBe("A");
    expect(result[0][1]).toHaveLength(1);
    expect(result[1][0]).toBe("B");
    expect(result[1][1]).toHaveLength(2);
  });

  test("returns empty array for empty input", () => {
    expect(groupByKey([], () => "x")).toEqual([]);
  });

  test("handles single-item groups", () => {
    const items = [{ k: "a" }, { k: "b" }, { k: "c" }];
    const result = groupByKey(items, i => i.k);
    expect(result).toHaveLength(3);
    result.forEach(([, group]) => expect(group).toHaveLength(1));
  });
});

describe("groupConsecutiveByCategory", () => {
  test("groups consecutive items with same category", () => {
    const items = [
      makeItem({ item_id: "1", category_name: "Dairy", demand_group_code: "01" }),
      makeItem({ item_id: "2", category_name: "Dairy", demand_group_code: "01" }),
      makeItem({ item_id: "3", category_name: "Baking", demand_group_code: "05" }),
    ];
    const groups = groupConsecutiveByCategory(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].categoryName).toBe("Dairy");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].categoryName).toBe("Baking");
    expect(groups[1].items).toHaveLength(1);
  });

  test("does not merge non-consecutive items with same category", () => {
    const items = [
      makeItem({ item_id: "1", category_name: "Dairy" }),
      makeItem({ item_id: "2", category_name: "Baking" }),
      makeItem({ item_id: "3", category_name: "Dairy" }),
    ];
    const groups = groupConsecutiveByCategory(items);
    expect(groups).toHaveLength(3);
    expect(groups[0].categoryName).toBe("Dairy");
    expect(groups[1].categoryName).toBe("Baking");
    expect(groups[2].categoryName).toBe("Dairy");
  });

  test("returns empty array for empty input", () => {
    expect(groupConsecutiveByCategory([])).toEqual([]);
  });

  test("single item produces single group", () => {
    const items = [makeItem({ item_id: "1", category_name: "Dairy" })];
    const groups = groupConsecutiveByCategory(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  test("preserves demandGroupCode in group", () => {
    const items = [makeItem({ item_id: "1", category_name: "Fruit", demand_group_code: "03-Obst" })];
    const groups = groupConsecutiveByCategory(items);
    expect(groups[0].demandGroupCode).toBe("03-Obst");
  });
});
