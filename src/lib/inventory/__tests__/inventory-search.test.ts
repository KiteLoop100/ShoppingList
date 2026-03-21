import { describe, test, expect } from "vitest";
import { filterInventoryByName, pickInventoryItemForBarcode } from "../inventory-search";
import type { InventoryItem } from "../inventory-types";

function makeItem(name: string, id = name, overrides: Partial<InventoryItem> = {}): InventoryItem {
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
    ...overrides,
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

describe("pickInventoryItemForBarcode", () => {
  test("returns null when no product ids given", () => {
    expect(pickInventoryItemForBarcode(ITEMS, null, null)).toBeNull();
  });

  test("returns null when no line matches ALDI product_id", () => {
    expect(pickInventoryItemForBarcode(ITEMS, "unknown-pid", null)).toBeNull();
  });

  test("picks FEFO line by earliest best_before for same product_id", () => {
    const pid = "aldi-123";
    const lines: InventoryItem[] = [
      makeItem("Later", "a", { product_id: pid, best_before: "2026-06-01" }),
      makeItem("Sooner", "b", { product_id: pid, best_before: "2026-04-01" }),
      makeItem("No date", "c", { product_id: pid, best_before: null }),
    ];
    expect(pickInventoryItemForBarcode(lines, pid, null)?.id).toBe("b");
  });

  test("null best_before sorts after dated lines", () => {
    const pid = "aldi-456";
    const lines: InventoryItem[] = [
      makeItem("No date", "c", { product_id: pid, best_before: null }),
      makeItem("Dated", "d", { product_id: pid, best_before: "2026-05-01" }),
    ];
    expect(pickInventoryItemForBarcode(lines, pid, null)?.id).toBe("d");
  });

  test("skips consumed lines", () => {
    const pid = "aldi-789";
    const lines: InventoryItem[] = [
      makeItem("Consumed", "x", { product_id: pid, status: "consumed" }),
      makeItem("Active", "y", { product_id: pid, status: "sealed" }),
    ];
    expect(pickInventoryItemForBarcode(lines, pid, null)?.id).toBe("y");
  });

  test("matches competitor_product_id when ALDI id not used", () => {
    const cid = "comp-1";
    const lines: InventoryItem[] = [
      makeItem("Other", "o", { competitor_product_id: "other" }),
      makeItem("Match", "m", { competitor_product_id: cid }),
    ];
    expect(pickInventoryItemForBarcode(lines, null, cid)?.id).toBe("m");
  });
});
