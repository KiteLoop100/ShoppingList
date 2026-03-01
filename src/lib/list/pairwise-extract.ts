/**
 * Extract pairwise comparisons from a validated checkoff sequence (LEARNING-LOGIC 2.4).
 * One sequence contributes one comparison per pair: which of (A,B) appeared first.
 */

import type { PairwiseLevel } from "@/types";

export interface SequenceItemForPairwise {
  demand_group: string | null;
  demand_sub_group: string | null;
  product_id: string | null;
  checked_at: string;
}

function normalizeKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Unique elements in order of first appearance (by checked_at). */
function uniqueInOrder<T>(
  items: SequenceItemForPairwise[],
  getKey: (it: SequenceItemForPairwise) => T
): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const it of items) {
    const k = getKey(it);
    if (k === null || k === undefined || k === "") continue;
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(k);
  }
  return result;
}

/** Sort items by checked_at and return unique keys in that order. */
function orderedKeys(
  items: SequenceItemForPairwise[],
  getKey: (it: SequenceItemForPairwise) => string
): string[] {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  );
  return uniqueInOrder(sorted, (it) => getKey(it));
}

export interface ExtractedPairwise {
  level: PairwiseLevel;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b: number;
  b_before_a: number;
}

/**
 * From one validated sequence, extract all pairwise counts.
 * Each pair (A,B) gets either +1 for a_before_b or +1 for b_before_a.
 */
export function extractAllPairwise(
  items: SequenceItemForPairwise[]
): ExtractedPairwise[] {
  const result: ExtractedPairwise[] = [];

  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  );

  // Level 1: demand groups in order of first appearance
  const groupOrder = orderedKeys(sorted, (it) => it.demand_group ?? "");
  for (let i = 0; i < groupOrder.length; i++) {
    for (let j = i + 1; j < groupOrder.length; j++) {
      const [item_a, item_b] = normalizeKey(groupOrder[i], groupOrder[j]);
      result.push({
        level: "group",
        scope: null,
        item_a,
        item_b,
        a_before_b: 1,
        b_before_a: 0,
      });
    }
  }

  // Level 2: within each demand_group, sub-groups in order of first appearance
  const byGroup = new Map<string, SequenceItemForPairwise[]>();
  for (const it of sorted) {
    const g = it.demand_group ?? "";
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(it);
  }
  for (const [group, groupItems] of byGroup) {
    const subOrder = orderedKeys(groupItems, (it) => it.demand_sub_group ?? "");
    for (let i = 0; i < subOrder.length; i++) {
      for (let j = i + 1; j < subOrder.length; j++) {
        const [item_a, item_b] = normalizeKey(subOrder[i], subOrder[j]);
        result.push({
          level: "subgroup",
          scope: group,
          item_a,
          item_b,
          a_before_b: 1,
          b_before_a: 0,
        });
      }
    }
  }

  // Level 3: within each (group, subgroup), products in order of first appearance
  const byScope = new Map<string, SequenceItemForPairwise[]>();
  for (const it of sorted) {
    const g = it.demand_group ?? "";
    const sg = it.demand_sub_group ?? "";
    if (!g || !sg) continue;
    const scope = `${g}|${sg}`;
    if (!byScope.has(scope)) byScope.set(scope, []);
    byScope.get(scope)!.push(it);
  }
  for (const [scope, scopeItems] of byScope) {
    const productOrder = orderedKeys(scopeItems, (it) => it.product_id ?? "");
    for (let i = 0; i < productOrder.length; i++) {
      for (let j = i + 1; j < productOrder.length; j++) {
        const [item_a, item_b] = normalizeKey(productOrder[i], productOrder[j]);
        result.push({
          level: "product",
          scope,
          item_a,
          item_b,
          a_before_b: 1,
          b_before_a: 0,
        });
      }
    }
  }

  return result;
}
