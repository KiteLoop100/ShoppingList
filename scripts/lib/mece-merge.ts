/**
 * MECE merge utilities for demand group consolidation.
 * Used by review-ai-groups.ts to merge AI-generated groups into curated ones.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SubGroupMapping {
  [oldSubCode: string]: string;
}

export interface MergeResult {
  oldCode: string;
  newCode: string;
  tablesUpdated: string[];
  errors: string[];
}

/**
 * Merge an old demand group into a new one, updating all referencing tables.
 * The old group is marked as source='merged' (never deleted).
 */
export async function executeMerge(
  supabase: SupabaseClient,
  oldCode: string,
  newCode: string,
  subGroupMapping: SubGroupMapping,
): Promise<MergeResult> {
  const result: MergeResult = {
    oldCode,
    newCode,
    tablesUpdated: [],
    errors: [],
  };

  // 1. products
  await updateTable(supabase, result, "products", async () => {
    const { error } = await supabase
      .from("products")
      .update({ demand_group_code: newCode })
      .eq("demand_group_code", oldCode);
    if (error) throw error;

    for (const [oldSub, newSub] of Object.entries(subGroupMapping)) {
      const { error: subErr } = await supabase
        .from("products")
        .update({ demand_sub_group: newSub })
        .eq("demand_group_code", newCode)
        .eq("demand_sub_group", oldSub);
      if (subErr) throw subErr;
    }
  });

  // 2. competitor_products
  await updateTable(supabase, result, "competitor_products", async () => {
    const { error } = await supabase
      .from("competitor_products")
      .update({ demand_group_code: newCode })
      .eq("demand_group_code", oldCode);
    if (error) throw error;

    for (const [oldSub, newSub] of Object.entries(subGroupMapping)) {
      const { error: subErr } = await supabase
        .from("competitor_products")
        .update({ demand_sub_group: newSub })
        .eq("demand_group_code", newCode)
        .eq("demand_sub_group", oldSub);
      if (subErr) throw subErr;
    }
  });

  // 3. list_items
  await updateTable(supabase, result, "list_items", async () => {
    const { error } = await supabase
      .from("list_items")
      .update({ demand_group_code: newCode })
      .eq("demand_group_code", oldCode);
    if (error) throw error;
  });

  // 4. trip_items
  await updateTable(supabase, result, "trip_items", async () => {
    const { error } = await supabase
      .from("trip_items")
      .update({ demand_group_code: newCode })
      .eq("demand_group_code", oldCode);
    if (error) throw error;
  });

  // 5. pairwise_comparisons (all 3 levels)
  await updateTable(supabase, result, "pairwise_comparisons", async () => {
    await updatePairwiseGroup(supabase, oldCode, newCode);
    await updatePairwiseSubgroup(supabase, oldCode, newCode, subGroupMapping);
    await updatePairwiseProduct(supabase, oldCode, newCode, subGroupMapping);
  });

  // 6. checkoff_sequences (JSONB items array)
  await updateTable(supabase, result, "checkoff_sequences", async () => {
    await updateCheckoffSequences(supabase, oldCode, newCode, subGroupMapping);
  });

  // 7. demand_groups: mark as merged
  await updateTable(supabase, result, "demand_groups", async () => {
    const { error } = await supabase
      .from("demand_groups")
      .update({ source: "merged" })
      .eq("code", oldCode);
    if (error) throw error;
  });

  // 8. demand_sub_groups: mark as merged
  await updateTable(supabase, result, "demand_sub_groups", async () => {
    const { error } = await supabase
      .from("demand_sub_groups")
      .update({ source: "merged" })
      .eq("demand_group_code", oldCode);
    if (error) throw error;
  });

  return result;
}

async function updateTable(
  _supabase: SupabaseClient,
  result: MergeResult,
  tableName: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    result.tablesUpdated.push(tableName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`${tableName}: ${message}`);
  }
}

/**
 * Level "group": Rewrite item_a/item_b where they reference the old group code.
 * After rewriting, item_a must be < item_b (CHECK constraint). If violated, swap + invert counts.
 */
async function updatePairwiseGroup(
  supabase: SupabaseClient,
  oldCode: string,
  newCode: string,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("pairwise_comparisons")
    .select("id, item_a, item_b, a_before_b_count, b_before_a_count")
    .eq("level", "group")
    .or(`item_a.eq.${oldCode},item_b.eq.${oldCode}`);
  if (error) throw error;

  for (const row of rows ?? []) {
    let newA = row.item_a === oldCode ? newCode : row.item_a;
    let newB = row.item_b === oldCode ? newCode : row.item_b;
    let aCount = row.a_before_b_count;
    let bCount = row.b_before_a_count;

    if (newA === newB) {
      await supabase.from("pairwise_comparisons").delete().eq("id", row.id);
      continue;
    }

    if (newA > newB) {
      [newA, newB] = [newB, newA];
      [aCount, bCount] = [bCount, aCount];
    }

    const { error: upErr } = await supabase
      .from("pairwise_comparisons")
      .update({ item_a: newA, item_b: newB, a_before_b_count: aCount, b_before_a_count: bCount })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
}

/**
 * Level "subgroup": scope is the demand_group_code, items are sub-group codes.
 */
async function updatePairwiseSubgroup(
  supabase: SupabaseClient,
  oldCode: string,
  newCode: string,
  subGroupMapping: SubGroupMapping,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("pairwise_comparisons")
    .select("id, scope, item_a, item_b, a_before_b_count, b_before_a_count")
    .eq("level", "subgroup")
    .eq("scope", oldCode);
  if (error) throw error;

  for (const row of rows ?? []) {
    let newA = subGroupMapping[row.item_a] ?? row.item_a;
    let newB = subGroupMapping[row.item_b] ?? row.item_b;
    let aCount = row.a_before_b_count;
    let bCount = row.b_before_a_count;

    if (newA === newB) {
      await supabase.from("pairwise_comparisons").delete().eq("id", row.id);
      continue;
    }

    if (newA > newB) {
      [newA, newB] = [newB, newA];
      [aCount, bCount] = [bCount, aCount];
    }

    const { error: upErr } = await supabase
      .from("pairwise_comparisons")
      .update({
        scope: newCode,
        item_a: newA,
        item_b: newB,
        a_before_b_count: aCount,
        b_before_a_count: bCount,
      })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
}

/**
 * Level "product": scope has format "group|subgroup".
 * Replace the group part and the subgroup part per mapping.
 */
async function updatePairwiseProduct(
  supabase: SupabaseClient,
  oldCode: string,
  newCode: string,
  subGroupMapping: SubGroupMapping,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("pairwise_comparisons")
    .select("id, scope")
    .eq("level", "product")
    .like("scope", `${oldCode}|%`);
  if (error) throw error;

  for (const row of rows ?? []) {
    const parts = (row.scope as string).split("|");
    if (parts.length !== 2) continue;
    const oldSub = parts[1];
    const newSub = subGroupMapping[oldSub] ?? oldSub;
    const newScope = `${newCode}|${newSub}`;

    const { error: upErr } = await supabase
      .from("pairwise_comparisons")
      .update({ scope: newScope })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
}

/**
 * Update checkoff_sequences JSONB items array.
 * Each item has demand_group_code and optionally demand_sub_group.
 */
async function updateCheckoffSequences(
  supabase: SupabaseClient,
  oldCode: string,
  newCode: string,
  subGroupMapping: SubGroupMapping,
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("checkoff_sequences")
    .select("sequence_id, items")
    .contains("items", [{ demand_group_code: oldCode }]);
  if (error) throw error;

  for (const row of rows ?? []) {
    const items = row.items as Array<Record<string, unknown>>;
    const updated = items.map((item) => {
      if (item.demand_group_code !== oldCode) return item;
      const newItem = { ...item, demand_group_code: newCode };
      const oldSub = item.demand_sub_group as string | undefined;
      if (oldSub && subGroupMapping[oldSub]) {
        newItem.demand_sub_group = subGroupMapping[oldSub];
      }
      return newItem;
    });

    const { error: upErr } = await supabase
      .from("checkoff_sequences")
      .update({ items: updated })
      .eq("sequence_id", row.sequence_id);
    if (upErr) throw upErr;
  }
}

/**
 * Find and merge duplicate pairwise_comparisons records that were
 * created by merging demand groups. Keeps the most recently updated
 * record, sums counts, and deletes the rest.
 */
export async function deduplicatePairwise(supabase: SupabaseClient): Promise<number> {
  const { data: dupes, error } = await supabase.rpc("find_duplicate_pairwise");

  if (error) {
    if (error.message.includes("find_duplicate_pairwise")) {
      return await deduplicatePairwiseFallback(supabase);
    }
    throw error;
  }

  return await processDuplicates(supabase, dupes ?? []);
}

/**
 * Fallback deduplication using a raw query approach when the RPC
 * function doesn't exist yet.
 */
async function deduplicatePairwiseFallback(supabase: SupabaseClient): Promise<number> {
  const { data: allRows, error } = await supabase
    .from("pairwise_comparisons")
    .select("id, store_id, level, scope, item_a, item_b, a_before_b_count, b_before_a_count, last_updated_at")
    .order("last_updated_at", { ascending: false });
  if (error) throw error;

  const groups = new Map<string, Array<{
    id: string;
    a_before_b_count: number;
    b_before_a_count: number;
    last_updated_at: string;
  }>>();

  for (const row of allRows ?? []) {
    const key = `${row.store_id}|${row.level}|${row.scope ?? ""}|${row.item_a}|${row.item_b}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({
      id: row.id,
      a_before_b_count: row.a_before_b_count,
      b_before_a_count: row.b_before_a_count,
      last_updated_at: row.last_updated_at,
    });
  }

  const dupeGroups: Array<{
    ids: string[];
    total_a: number;
    total_b: number;
  }> = [];

  for (const [, entries] of groups) {
    if (entries.length <= 1) continue;
    dupeGroups.push({
      ids: entries.map((e) => e.id),
      total_a: entries.reduce((sum, e) => sum + e.a_before_b_count, 0),
      total_b: entries.reduce((sum, e) => sum + e.b_before_a_count, 0),
    });
  }

  return await processDuplicates(supabase, dupeGroups);
}

async function processDuplicates(
  supabase: SupabaseClient,
  dupeGroups: Array<{ ids: string[]; total_a: number; total_b: number }>,
): Promise<number> {
  let merged = 0;

  for (const group of dupeGroups) {
    if (group.ids.length <= 1) continue;

    const keepId = group.ids[0];
    const deleteIds = group.ids.slice(1);

    const { error: upErr } = await supabase
      .from("pairwise_comparisons")
      .update({
        a_before_b_count: group.total_a,
        b_before_a_count: group.total_b,
      })
      .eq("id", keepId);
    if (upErr) throw upErr;

    const { error: delErr } = await supabase
      .from("pairwise_comparisons")
      .delete()
      .in("id", deleteIds);
    if (delErr) throw delErr;

    merged += deleteIds.length;
  }

  return merged;
}
