import { describe, test, expect } from "vitest";
import { extractAllPairwise, type SequenceItemForPairwise } from "../pairwise-extract";

function makeSeqItem(
  overrides: Partial<SequenceItemForPairwise>,
): SequenceItemForPairwise {
  return {
    demand_group_code: null,
    demand_sub_group: null,
    product_id: null,
    checked_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("extractAllPairwise", () => {
  test("extracts group-level pairs using demand_group_code", () => {
    const items: SequenceItemForPairwise[] = [
      makeSeqItem({ demand_group_code: "83", checked_at: "2026-01-01T10:00:00Z" }),
      makeSeqItem({ demand_group_code: "84", checked_at: "2026-01-01T10:01:00Z" }),
      makeSeqItem({ demand_group_code: "57", checked_at: "2026-01-01T10:02:00Z" }),
    ];

    const result = extractAllPairwise(items);
    const groupPairs = result.filter((r) => r.level === "group");

    expect(groupPairs).toHaveLength(3);
    const pair83_84 = groupPairs.find(
      (p) => (p.item_a === "83" && p.item_b === "84") || (p.item_a === "84" && p.item_b === "83"),
    );
    expect(pair83_84).toBeDefined();
    expect(pair83_84!.scope).toBeNull();
  });

  test("extracts subgroup-level pairs scoped by demand_group_code", () => {
    const items: SequenceItemForPairwise[] = [
      makeSeqItem({ demand_group_code: "83", demand_sub_group: "83-01", checked_at: "2026-01-01T10:00:00Z" }),
      makeSeqItem({ demand_group_code: "83", demand_sub_group: "83-04", checked_at: "2026-01-01T10:01:00Z" }),
    ];

    const result = extractAllPairwise(items);
    const subPairs = result.filter((r) => r.level === "subgroup");

    expect(subPairs).toHaveLength(1);
    expect(subPairs[0].scope).toBe("83");
  });

  test("extracts product-level pairs with code-based scope", () => {
    const items: SequenceItemForPairwise[] = [
      makeSeqItem({ demand_group_code: "83", demand_sub_group: "83-04", product_id: "p1", checked_at: "2026-01-01T10:00:00Z" }),
      makeSeqItem({ demand_group_code: "83", demand_sub_group: "83-04", product_id: "p2", checked_at: "2026-01-01T10:01:00Z" }),
    ];

    const result = extractAllPairwise(items);
    const prodPairs = result.filter((r) => r.level === "product");

    expect(prodPairs).toHaveLength(1);
    expect(prodPairs[0].scope).toBe("83|83-04");
  });

  test("returns empty array for empty input", () => {
    expect(extractAllPairwise([])).toEqual([]);
  });

  test("skips null/empty demand_group_code entries for group level", () => {
    const items: SequenceItemForPairwise[] = [
      makeSeqItem({ demand_group_code: "83", checked_at: "2026-01-01T10:00:00Z" }),
      makeSeqItem({ demand_group_code: null, checked_at: "2026-01-01T10:01:00Z" }),
      makeSeqItem({ demand_group_code: "", checked_at: "2026-01-01T10:02:00Z" }),
    ];

    const result = extractAllPairwise(items);
    const groupPairs = result.filter((r) => r.level === "group");
    expect(groupPairs).toHaveLength(0);
  });
});
