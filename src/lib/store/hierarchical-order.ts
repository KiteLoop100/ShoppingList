/**
 * F03 Modus 2 + LEARNING-LOGIC 2.4: Three-level hierarchical sort order.
 * Level 1: Demand Groups, Level 2: Sub-groups within group, Level 3: Products within sub-group.
 * Each level uses the same pairwise algorithm with 3 layers (store / average / default).
 */

import { db } from "@/lib/db";
import type { PairwiseLevel } from "@/types";

const THRESHOLD_LEVEL_1 = 5;
const THRESHOLD_LEVEL_2 = 12;
const THRESHOLD_LEVEL_3 = 25;

export type PairwiseRow = {
  store_id: string;
  level: string;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b_count: number;
  b_before_a_count: number;
};

function pairKey(level: string, scope: string | null, item_a: string, item_b: string): string {
  const s = scope ?? "";
  return `${level}\t${s}\t${item_a}\t${item_b}`;
}

/** Aggregate counts across multiple stores (for layer 2). */
function aggregatePairwise(rows: PairwiseRow[]): Map<string, { a: number; b: number }> {
  const out = new Map<string, { a: number; b: number }>();
  for (const r of rows) {
    const key = pairKey(r.level, r.scope, r.item_a, r.item_b);
    const cur = out.get(key) ?? { a: 0, b: 0 };
    cur.a += r.a_before_b_count;
    cur.b += r.b_before_a_count;
    out.set(key, cur);
  }
  return out;
}

/**
 * Convert pairwise counts to a total order using probability P(A before B) = a / (a+b).
 * Uses a simple sort: compare each pair by probability, then topological sort.
 * Simplified: return ordered list of items by "score" = sum of P(item before X) over all X.
 */
function pairwiseToOrder(
  items: string[],
  getCounts: (a: string, b: string) => { aBeforeB: number; bBeforeA: number } | null
): string[] {
  if (items.length <= 1) return [...items];
  const score = (item: string): number => {
    let sum = 0;
    for (const other of items) {
      if (other === item) continue;
      const c = getCounts(item, other);
      if (!c) continue;
      const total = c.aBeforeB + c.bBeforeA;
      if (total === 0) continue;
      if (item < other) {
        sum += c.aBeforeB / total;
      } else {
        sum += c.bBeforeA / total;
      }
    }
    return sum;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}

/** Weight for layer 1 (store) based on valid trip count. */
function layerWeights(
  validTripCount: number,
  level: PairwiseLevel
): { w1: number; w2: number; w3: number } {
  const threshold =
    level === "group" ? THRESHOLD_LEVEL_1 : level === "subgroup" ? THRESHOLD_LEVEL_2 : THRESHOLD_LEVEL_3;
  if (validTripCount >= threshold) {
    return { w1: 0.9, w2: 0.08, w3: 0.02 };
  }
  if (validTripCount >= threshold / 2) {
    const t = validTripCount / (threshold / 2);
    return {
      w1: 0.3 + 0.6 * t,
      w2: 0.7 - 0.6 * t,
      w3: 0.02,
    };
  }
  if (validTripCount > 0) {
    return { w1: 0.3, w2: 0.68, w3: 0.02 };
  }
  return { w1: 0, w2: 0.7, w3: 0.3 };
}

/** Get valid checkoff sequence count for a store. */
export async function getValidSequenceCount(storeId: string): Promise<number> {
  const count = await db.checkoff_sequences
    .where("store_id")
    .equals(storeId)
    .filter((s) => s.is_valid)
    .count();
  return count;
}

/** Get store-specific pairwise rows for a level (and optional scope). */
export async function getStorePairwise(
  storeId: string,
  level: PairwiseLevel,
  scope?: string | null
): Promise<PairwiseRow[]> {
  let q = db.pairwise_comparisons.where("[store_id+level]").equals([storeId, level]);
  const rows = await q.toArray();
  if (scope !== undefined && scope !== null) {
    return rows.filter((r) => (r.scope ?? "") === scope);
  }
  return rows;
}

/** Get all pairwise rows (for aggregation across stores). */
export async function getAllStoresPairwise(
  level: PairwiseLevel,
  scope?: string | null
): Promise<PairwiseRow[]> {
  const rows = await db.pairwise_comparisons.where("level").equals(level).toArray();
  if (scope !== undefined && scope !== null) {
    return rows.filter((r) => (r.scope ?? "") === scope);
  }
  return rows;
}

export interface HierarchicalOrderInput {
  storeId: string | null;
  /** All demand groups that appear in the list (for level 1 order). */
  groups: string[];
  /** Per-group list of sub-groups. */
  subgroupsByGroup: Map<string, string[]>;
  /** Per (group|subgroup) list of product_ids. */
  productsByScope: Map<string, string[]>;
  /** Default group order (e.g. category default_sort_position mapped to demand_group names). */
  defaultGroupOrder: string[];
  /** Default subgroup order within a group (e.g. alphabetical). */
  defaultSubgroupOrder: (group: string) => string[];
  /** Default product order within a scope (e.g. by popularity_score). */
  defaultProductOrder: (scope: string) => string[];
}

export interface HierarchicalOrderResult {
  groupOrder: string[];
  subgroupOrder: Map<string, string[]>;
  productOrder: Map<string, string[]>;
}

/**
 * Compute full hierarchical order for a store (or fallback to defaults if no store).
 */
export async function getHierarchicalOrder(
  input: HierarchicalOrderInput
): Promise<HierarchicalOrderResult> {
  const {
    storeId,
    groups,
    subgroupsByGroup,
    productsByScope,
    defaultGroupOrder,
    defaultSubgroupOrder,
    defaultProductOrder,
  } = input;

  const validCount = storeId ? await getValidSequenceCount(storeId) : 0;

  const groupOrder = await resolveOrderForLevel(
    "group",
    null,
    groups,
    storeId,
    validCount,
    () => defaultGroupOrder
  );
  const subgroupOrder = new Map<string, string[]>();
  for (const g of groupOrder) {
    const subs = subgroupsByGroup.get(g) ?? [];
    const order = await resolveOrderForLevel(
      "subgroup",
      g,
      subs,
      storeId,
      validCount,
      () => defaultSubgroupOrder(g)
    );
    subgroupOrder.set(g, order);
  }
  const productOrder = new Map<string, string[]>();
  for (const [scope, pids] of productsByScope) {
    const order = await resolveOrderForLevel(
      "product",
      scope,
      pids,
      storeId,
      validCount,
      () => defaultProductOrder(scope)
    );
    productOrder.set(scope, order);
  }

  return { groupOrder, subgroupOrder, productOrder };

  async function resolveOrderForLevel(
    level: PairwiseLevel,
    scope: string | null,
    items: string[],
    storeId: string | null,
    validCount: number,
    getDefaultOrder: () => string[]
  ): Promise<string[]> {
    if (items.length <= 1) return [...items];

    const weights = layerWeights(validCount, level);

    const defaultOrder = getDefaultOrder();
    const defaultSet = new Set(defaultOrder);
    const allItems = [...new Set([...items, ...defaultOrder])];

    const getStoreCounts = async (): Promise<Map<string, { a: number; b: number }> | null> => {
      if (!storeId || weights.w1 <= 0) return null;
      const rows = await getStorePairwise(storeId, level, scope);
      const map = new Map<string, { a: number; b: number }>();
      for (const r of rows) {
        map.set(pairKey(level, scope, r.item_a, r.item_b), {
          a: r.a_before_b_count,
          b: r.b_before_a_count,
        });
      }
      return map;
    };

    const getAllStoresCounts = async (): Promise<Map<string, { a: number; b: number }> | null> => {
      if (weights.w2 <= 0) return null;
      const rows = await getAllStoresPairwise(level, scope);
      return aggregatePairwise(rows);
    };

    const storeMap = await getStoreCounts();
    const avgMap = await getAllStoresCounts();

    // Prior from default order: consecutive pairs (A,B) get a_before_b += w3
    const defaultPrior = new Map<string, { a: number; b: number }>();
    if (weights.w3 > 0 && defaultOrder.length >= 2) {
      for (let i = 0; i < defaultOrder.length - 1; i++) {
        const a = defaultOrder[i];
        const b = defaultOrder[i + 1];
        const [xa, xb] = a < b ? [a, b] : [b, a];
        const key = pairKey(level, scope, xa, xb);
        const cur = defaultPrior.get(key) ?? { a: 0, b: 0 };
        if (a < b) cur.a += weights.w3;
        else cur.b += weights.w3;
        defaultPrior.set(key, cur);
      }
    }

    const getCounts = (itemA: string, itemB: string): { aBeforeB: number; bBeforeA: number } | null => {
      const [a, b] = itemA < itemB ? [itemA, itemB] : [itemB, itemA];
      const key = pairKey(level, scope, a, b);
      let aBeforeB = 0;
      let bBeforeA = 0;
      if (storeMap?.get(key)) {
        const s = storeMap.get(key)!;
        aBeforeB += weights.w1 * s.a;
        bBeforeA += weights.w1 * s.b;
      }
      if (avgMap?.get(key)) {
        const v = avgMap.get(key)!;
        aBeforeB += weights.w2 * v.a;
        bBeforeA += weights.w2 * v.b;
      }
      if (defaultPrior.get(key)) {
        const p = defaultPrior.get(key)!;
        aBeforeB += p.a;
        bBeforeA += p.b;
      }
      const total = aBeforeB + bBeforeA;
      if (total === 0) return null;
      if (itemA === a) return { aBeforeB, bBeforeA };
      return { aBeforeB: bBeforeA, bBeforeA: aBeforeB };
    };

    const byScore = pairwiseToOrder(items, (a, b) => getCounts(a, b));
    const withDefaults = [...byScore];
    for (const x of defaultOrder) {
      if (!withDefaults.includes(x)) withDefaults.push(x);
    }
    return withDefaults;
  }
}
