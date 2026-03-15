import { describe, test, expect } from "vitest";
import { estimateTotal, type ListItemWithMeta } from "../list-helpers";

function makeItem(overrides: Partial<ListItemWithMeta> = {}): ListItemWithMeta {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: null,
    custom_name: null,
    display_name: "Test Item",
    demand_group_code: "TK",
    quantity: 1,
    is_checked: false,
    sort_position: 0,
    created_at: new Date().toISOString(),
    checked_at: null,
    deferred_until: null,
    buy_elsewhere_retailer: null,
    competitor_product_id: null,
    demand_group_name: "Test",
    demand_group_icon: "📦",
    demand_group_sort_position: 0,
    category_name: "Test",
    category_icon: "📦",
    category_sort_position: 0,
    price: null,
    ...overrides,
  };
}

describe("estimateTotal", () => {
  test("sums prices and counts items without price", () => {
    const items = [
      makeItem({ item_id: "1", price: 1.49, quantity: 1 }),
      makeItem({ item_id: "2", price: 2.99, quantity: 2 }),
      makeItem({ item_id: "3", price: null, quantity: 1 }),
    ];

    const result = estimateTotal(items);

    expect(result.total).toBeCloseTo(7.47);
    expect(result.withoutPriceCount).toBe(1);
  });

  test("returns zero for empty array", () => {
    const result = estimateTotal([]);

    expect(result.total).toBe(0);
    expect(result.withoutPriceCount).toBe(0);
  });

  test("all items without price returns zero total", () => {
    const items = [
      makeItem({ item_id: "1", price: null }),
      makeItem({ item_id: "2", price: null }),
    ];

    const result = estimateTotal(items);

    expect(result.total).toBe(0);
    expect(result.withoutPriceCount).toBe(2);
  });

  test("respects quantity multiplier", () => {
    const items = [
      makeItem({ item_id: "1", price: 3.0, quantity: 3 }),
    ];

    const result = estimateTotal(items);

    expect(result.total).toBeCloseTo(9.0);
    expect(result.withoutPriceCount).toBe(0);
  });

  describe("dual-price calculation (list vs. cart)", () => {
    const allItems = [
      makeItem({ item_id: "1", price: 1.09, quantity: 1, is_checked: false }),
      makeItem({ item_id: "2", price: 1.49, quantity: 1, is_checked: false }),
      makeItem({ item_id: "3", price: 2.19, quantity: 1, is_checked: true }),
      makeItem({ item_id: "4", price: 1.69, quantity: 1, is_checked: true }),
      makeItem({ item_id: "5", price: null, quantity: 1, is_checked: false }),
    ];

    test("list total includes all items", () => {
      const result = estimateTotal(allItems);

      expect(result.total).toBeCloseTo(6.46);
      expect(result.withoutPriceCount).toBe(1);
    });

    test("cart total includes only checked items", () => {
      const checkedOnly = allItems.filter((i) => i.is_checked);
      const result = estimateTotal(checkedOnly);

      expect(result.total).toBeCloseTo(3.88);
      expect(result.withoutPriceCount).toBe(0);
    });

    test("cart total is zero when no items are checked", () => {
      const uncheckedOnly = allItems.filter((i) => !i.is_checked);
      const result = estimateTotal(uncheckedOnly);

      expect(result.total).toBeCloseTo(2.58);
      expect(result.withoutPriceCount).toBe(1);

      const emptyCart = allItems.filter((i) => i.is_checked && false);
      const cartResult = estimateTotal(emptyCart);
      expect(cartResult.total).toBe(0);
      expect(cartResult.withoutPriceCount).toBe(0);
    });

    test("deferred items are included in list total", () => {
      const withDeferred = [
        ...allItems,
        makeItem({ item_id: "6", price: 0.89, quantity: 1, is_checked: false, is_deferred: true }),
      ];
      const result = estimateTotal(withDeferred);

      expect(result.total).toBeCloseTo(7.35);
    });
  });

  describe("elsewhere-item exclusion (caller responsibility)", () => {
    const unchecked = [
      makeItem({ item_id: "u1", price: 1.09, quantity: 1, is_checked: false }),
      makeItem({ item_id: "u2", price: 1.49, quantity: 1, is_checked: false }),
    ];
    const checked = [
      makeItem({ item_id: "c1", price: 2.19, quantity: 1, is_checked: true }),
    ];
    const deferredRegular = [
      makeItem({ item_id: "d1", price: 0.89, quantity: 1, is_checked: false, is_deferred: true, deferred_reason: "manual" }),
    ];
    const deferredElsewhere = [
      makeItem({ item_id: "e1", price: 3.49, quantity: 1, is_checked: false, is_deferred: true, deferred_reason: "elsewhere", buy_elsewhere_retailer: "REWE" }),
      makeItem({ item_id: "e2", price: null, quantity: 1, is_checked: false, is_deferred: true, deferred_reason: "elsewhere", buy_elsewhere_retailer: "LIDL" }),
    ];

    test("list total excludes elsewhere items when filtered by caller", () => {
      const allDeferred = [...deferredRegular, ...deferredElsewhere];
      const nonElsewhere = allDeferred.filter(i => i.deferred_reason !== "elsewhere");
      const result = estimateTotal([...unchecked, ...checked, ...nonElsewhere]);

      expect(result.total).toBeCloseTo(1.09 + 1.49 + 2.19 + 0.89);
      expect(result.withoutPriceCount).toBe(0);
    });

    test("list total wrongly inflated when elsewhere items not filtered", () => {
      const allDeferred = [...deferredRegular, ...deferredElsewhere];
      const unfiltered = estimateTotal([...unchecked, ...checked, ...allDeferred]);

      expect(unfiltered.total).toBeCloseTo(1.09 + 1.49 + 2.19 + 0.89 + 3.49);
      expect(unfiltered.withoutPriceCount).toBe(1);
    });

    test("cart total is unaffected by elsewhere items", () => {
      const result = estimateTotal(checked);

      expect(result.total).toBeCloseTo(2.19);
      expect(result.withoutPriceCount).toBe(0);
    });

    test("item count excludes elsewhere when filtered by caller", () => {
      const allDeferred = [...deferredRegular, ...deferredElsewhere];
      const nonElsewhereDeferred = allDeferred.filter(i => i.deferred_reason !== "elsewhere");

      const listItemCount = unchecked.length + checked.length + nonElsewhereDeferred.length;

      expect(listItemCount).toBe(4);
      expect(unchecked.length + checked.length + allDeferred.length).toBe(6);
    });

    test("elsewhere items with price=null do not affect withoutPriceCount when filtered", () => {
      const nonElsewhere = deferredRegular.filter(i => i.deferred_reason !== "elsewhere");
      const result = estimateTotal([...unchecked, ...nonElsewhere]);

      expect(result.withoutPriceCount).toBe(0);
    });
  });
});
