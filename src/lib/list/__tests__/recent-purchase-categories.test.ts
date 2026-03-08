import { describe, test, expect } from "vitest";
import {
  getCategoryGroup,
  sortRecentByCategory,
  computeSections,
} from "../recent-purchase-categories";

describe("getCategoryGroup", () => {
  test("returns 'produce' for Obst/Gemüse/Salate codes", () => {
    expect(getCategoryGroup("38")).toBe("produce");
    expect(getCategoryGroup("58")).toBe("produce");
    expect(getCategoryGroup("88")).toBe("produce");
  });

  test("returns 'chilled' for refrigerated codes", () => {
    expect(getCategoryGroup("83")).toBe("chilled");
    expect(getCategoryGroup("84")).toBe("chilled");
    expect(getCategoryGroup("69")).toBe("chilled");
    expect(getCategoryGroup("51")).toBe("chilled");
  });

  test("returns 'frozen' for Tiefkühl codes", () => {
    expect(getCategoryGroup("75")).toBe("frozen");
    expect(getCategoryGroup("76")).toBe("frozen");
    expect(getCategoryGroup("77")).toBe("frozen");
    expect(getCategoryGroup("78")).toBe("frozen");
  });

  test("returns 'dry' for pantry/household/snack codes", () => {
    expect(getCategoryGroup("54")).toBe("dry");
    expect(getCategoryGroup("45")).toBe("dry");
    expect(getCategoryGroup("06")).toBe("dry");
    expect(getCategoryGroup("41")).toBe("dry");
  });

  test("returns 'dry' for null/undefined/unknown codes", () => {
    expect(getCategoryGroup(null)).toBe("dry");
    expect(getCategoryGroup(undefined)).toBe("dry");
    expect(getCategoryGroup("ZZ")).toBe("dry");
  });
});

describe("sortRecentByCategory", () => {
  const productMap = new Map([
    ["p-apple", { demand_group_code: "58" }],
    ["p-pasta", { demand_group_code: "54" }],
    ["p-milk", { demand_group_code: "83" }],
    ["p-carrot", { demand_group_code: "38" }],
    ["p-cheese", { demand_group_code: "84" }],
    ["p-coffee", { demand_group_code: "45" }],
    ["p-pizza", { demand_group_code: "78" }],
  ]);

  test("sorts produce → chilled → frozen → dry", () => {
    const items = [
      { product_id: "p-pasta", frequency: 5 },
      { product_id: "p-pizza", frequency: 2 },
      { product_id: "p-milk", frequency: 3 },
      { product_id: "p-apple", frequency: 7 },
      { product_id: "p-cheese", frequency: 2 },
      { product_id: "p-carrot", frequency: 4 },
      { product_id: "p-coffee", frequency: 1 },
    ];

    const sorted = sortRecentByCategory(items, productMap);
    const ids = sorted.map((s) => s.product_id);

    expect(ids).toEqual([
      "p-apple",
      "p-carrot",
      "p-milk",
      "p-cheese",
      "p-pizza",
      "p-pasta",
      "p-coffee",
    ]);
  });

  test("preserves original order within the same category group", () => {
    const items = [
      { product_id: "p-pasta", frequency: 5 },
      { product_id: "p-coffee", frequency: 1 },
    ];

    const sorted = sortRecentByCategory(items, productMap);
    expect(sorted[0].product_id).toBe("p-pasta");
    expect(sorted[1].product_id).toBe("p-coffee");
  });

  test("does not mutate the original array", () => {
    const items = [
      { product_id: "p-milk", frequency: 3 },
      { product_id: "p-apple", frequency: 7 },
    ];
    const original = [...items];
    sortRecentByCategory(items, productMap);
    expect(items).toEqual(original);
  });

  test("handles empty input", () => {
    expect(sortRecentByCategory([], productMap)).toEqual([]);
  });
});

describe("computeSections", () => {
  const productMap = new Map([
    ["p-apple", { demand_group_code: "58" }],
    ["p-carrot", { demand_group_code: "38" }],
    ["p-milk", { demand_group_code: "83" }],
    ["p-cheese", { demand_group_code: "84" }],
    ["p-pizza", { demand_group_code: "78" }],
    ["p-pasta", { demand_group_code: "54" }],
  ]);

  test("computes section boundaries including frozen", () => {
    const sorted = [
      { product_id: "p-apple" },
      { product_id: "p-carrot" },
      { product_id: "p-milk" },
      { product_id: "p-cheese" },
      { product_id: "p-pizza" },
      { product_id: "p-pasta" },
    ];

    const sections = computeSections(sorted, productMap);
    expect(sections).toEqual([
      { key: "produce", startIndex: 0, count: 2 },
      { key: "chilled", startIndex: 2, count: 2 },
      { key: "frozen", startIndex: 4, count: 1 },
      { key: "dry", startIndex: 5, count: 1 },
    ]);
  });

  test("omits empty groups", () => {
    const sorted = [
      { product_id: "p-milk" },
      { product_id: "p-cheese" },
    ];

    const sections = computeSections(sorted, productMap);
    expect(sections).toEqual([
      { key: "chilled", startIndex: 0, count: 2 },
    ]);
  });

  test("handles empty input", () => {
    expect(computeSections([], productMap)).toEqual([]);
  });
});
