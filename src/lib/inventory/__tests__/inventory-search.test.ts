import { describe, test, expect } from "vitest";
import { filterInventoryByName } from "../inventory-search";
import type { InventoryItem } from "../inventory-types";

function makeItem(name: string, id = name): InventoryItem {
  return {
    id,
    user_id: "u1",
    product_id: null,
    competitor_product_id: null,
    display_name: name,
    demand_group_code: null,
    thumbnail_url: null,
    quantity: 1,
    status: "sealed",
    source: "manual",
    source_receipt_id: null,
    added_at: "2026-03-12T10:00:00Z",
    opened_at: null,
    consumed_at: null,
    best_before: null,
    purchase_date: null,
    is_frozen: false,
    frozen_at: null,
    thawed_at: null,
    created_at: "2026-03-12T10:00:00Z",
    updated_at: "2026-03-12T10:00:00Z",
  };
}

const ITEMS: InventoryItem[] = [
  makeItem("Vollmilch 3,5%", "1"),
  makeItem("Bio Butter", "2"),
  makeItem("Hähnchenbrust", "3"),
  makeItem("Milchreis", "4"),
  makeItem("Apfelsaft", "5"),
];

describe("filterInventoryByName", () => {
  test("returns all items for empty query", () => {
    expect(filterInventoryByName(ITEMS, "")).toEqual(ITEMS);
  });

  test("returns all items for whitespace-only query", () => {
    expect(filterInventoryByName(ITEMS, "   ")).toEqual(ITEMS);
  });

  test("filters by substring match (case-insensitive)", () => {
    const result = filterInventoryByName(ITEMS, "milch");
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["1", "4"]);
  });

  test("handles uppercase query", () => {
    const result = filterInventoryByName(ITEMS, "BUTTER");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  test("returns empty array when no match", () => {
    expect(filterInventoryByName(ITEMS, "pizza")).toEqual([]);
  });

  test("handles partial match at start", () => {
    const result = filterInventoryByName(ITEMS, "apfel");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  test("handles partial match in middle", () => {
    const result = filterInventoryByName(ITEMS, "brust");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  test("trims whitespace from query", () => {
    const result = filterInventoryByName(ITEMS, "  butter  ");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  test("returns empty array for empty items list", () => {
    expect(filterInventoryByName([], "milch")).toEqual([]);
  });

  test("handles special characters in display_name", () => {
    const items = [makeItem("Hähnchen-Filet (Bio)")];
    expect(filterInventoryByName(items, "filet")).toHaveLength(1);
    expect(filterInventoryByName(items, "(bio)")).toHaveLength(1);
  });
});
