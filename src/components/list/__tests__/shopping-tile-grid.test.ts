import { describe, test, expect } from "vitest";

/**
 * Tests for the ShoppingTileGrid helper logic (toRows, row collapsing).
 * The actual component uses React hooks, so we test the pure functions
 * and the row-collapsing algorithm separately.
 */

function toRows(ids: string[]): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < ids.length; i += 2) {
    rows.push(ids.slice(i, Math.min(i + 2, ids.length)));
  }
  return rows;
}

function getVisibleRows(stableOrder: string[], checkedIds: Set<string>): string[][] {
  const rows = toRows(stableOrder);
  return rows.filter((row) => !row.every((id) => checkedIds.has(id)));
}

function collapseFullRows(
  stableOrder: string[],
  checkedIds: Set<string>,
): { newOrder: string[]; newCheckedIds: Set<string> } {
  const rows = toRows(stableOrder);
  const fullRowIds = new Set(
    rows.filter((r) => r.every((id) => checkedIds.has(id))).flat(),
  );
  if (fullRowIds.size === 0) return { newOrder: stableOrder, newCheckedIds: checkedIds };

  const newOrder = stableOrder.filter((id) => !fullRowIds.has(id));
  const newCheckedIds = new Set(checkedIds);
  fullRowIds.forEach((id) => newCheckedIds.delete(id));
  return { newOrder, newCheckedIds };
}

describe("toRows", () => {
  test("groups items into pairs", () => {
    expect(toRows(["a", "b", "c", "d"])).toEqual([["a", "b"], ["c", "d"]]);
  });

  test("handles odd number of items", () => {
    expect(toRows(["a", "b", "c"])).toEqual([["a", "b"], ["c"]]);
  });

  test("handles single item", () => {
    expect(toRows(["a"])).toEqual([["a"]]);
  });

  test("handles empty array", () => {
    expect(toRows([])).toEqual([]);
  });
});

describe("getVisibleRows", () => {
  test("shows all rows when nothing is checked", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set<string>();
    expect(getVisibleRows(order, checked)).toEqual([["a", "b"], ["c", "d"]]);
  });

  test("keeps row visible when only one tile is checked", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set(["a"]);
    const rows = getVisibleRows(order, checked);
    expect(rows).toEqual([["a", "b"], ["c", "d"]]);
  });

  test("hides row when both tiles are checked", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set(["a", "b"]);
    const rows = getVisibleRows(order, checked);
    expect(rows).toEqual([["c", "d"]]);
  });

  test("hides single-item last row when checked", () => {
    const order = ["a", "b", "c"];
    const checked = new Set(["c"]);
    const rows = getVisibleRows(order, checked);
    expect(rows).toEqual([["a", "b"]]);
  });

  test("hides multiple full rows", () => {
    const order = ["a", "b", "c", "d", "e", "f"];
    const checked = new Set(["a", "b", "e", "f"]);
    const rows = getVisibleRows(order, checked);
    expect(rows).toEqual([["c", "d"]]);
  });

  test("returns empty when all checked", () => {
    const order = ["a", "b"];
    const checked = new Set(["a", "b"]);
    expect(getVisibleRows(order, checked)).toEqual([]);
  });
});

describe("collapseFullRows", () => {
  test("removes fully checked rows from stableOrder", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set(["a", "b"]);
    const { newOrder, newCheckedIds } = collapseFullRows(order, checked);
    expect(newOrder).toEqual(["c", "d"]);
    expect(newCheckedIds.size).toBe(0);
  });

  test("does not remove partially checked rows", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set(["a"]);
    const { newOrder, newCheckedIds } = collapseFullRows(order, checked);
    expect(newOrder).toEqual(["a", "b", "c", "d"]);
    expect(newCheckedIds).toEqual(new Set(["a"]));
  });

  test("collapses single-item last row", () => {
    const order = ["a", "b", "c"];
    const checked = new Set(["c"]);
    const { newOrder, newCheckedIds } = collapseFullRows(order, checked);
    expect(newOrder).toEqual(["a", "b"]);
    expect(newCheckedIds.size).toBe(0);
  });

  test("preserves order after collapsing middle row", () => {
    const order = ["a", "b", "c", "d", "e", "f"];
    const checked = new Set(["c", "d"]);
    const { newOrder } = collapseFullRows(order, checked);
    expect(newOrder).toEqual(["a", "b", "e", "f"]);
  });

  test("no-op when nothing is checked", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set<string>();
    const { newOrder, newCheckedIds } = collapseFullRows(order, checked);
    expect(newOrder).toEqual(order);
    expect(newCheckedIds.size).toBe(0);
  });

  test("collapses all rows when everything is checked", () => {
    const order = ["a", "b", "c", "d"];
    const checked = new Set(["a", "b", "c", "d"]);
    const { newOrder, newCheckedIds } = collapseFullRows(order, checked);
    expect(newOrder).toEqual([]);
    expect(newCheckedIds.size).toBe(0);
  });
});
