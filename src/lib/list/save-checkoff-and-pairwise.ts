/**
 * After archiving a trip: validate checkoff sequence, save CheckoffSequence,
 * and upsert pairwise comparisons on all three levels (LEARNING-LOGIC 2.4).
 */

import { db } from "@/lib/db";
import { validateCheckoffSequence } from "./checkoff-validation";
import { extractAllPairwise, type SequenceItemForPairwise } from "./pairwise-extract";
import type { LocalListItem } from "@/lib/db";
import type { CheckoffSequenceItem } from "@/types";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

interface EnrichedSequenceItem extends SequenceItemForPairwise {
  item_id: string;
  category_id: string;
}

/**
 * Build sequence items in checkoff order (by checked_at), with demand_group, demand_sub_group, product_id.
 */
async function buildSequenceItems(
  items: LocalListItem[]
): Promise<EnrichedSequenceItem[]> {
  const sorted = [...items].sort((a, b) => {
    const ta = a.checked_at ? new Date(a.checked_at).getTime() : 0;
    const tb = b.checked_at ? new Date(b.checked_at).getTime() : 0;
    return ta - tb;
  });

  const categoryMap = new Map(
    (await db.categories.toArray()).map((c) => [c.category_id, c])
  );
  const productIds = [...new Set(sorted.map((i) => i.product_id).filter(Boolean))] as string[];
  const products = await db.products
    .where("product_id")
    .anyOf(productIds)
    .toArray();

  const productMap = new Map(products.map((p) => [p.product_id, p]));

  return sorted.map((item) => {
    const cat = categoryMap.get(item.category_id);
    const product = item.product_id ? productMap.get(item.product_id) : null;
    return {
      item_id: item.item_id,
      category_id: item.category_id,
      demand_group: product?.demand_group ?? cat?.name ?? null,
      demand_sub_group: product?.demand_sub_group ?? null,
      product_id: item.product_id ?? null,
      checked_at: item.checked_at ?? new Date().toISOString(),
    };
  });
}

function toCheckoffSequenceItems(seq: EnrichedSequenceItem[]): CheckoffSequenceItem[] {
  return seq.map((s) => ({
    item_id: s.item_id,
    category_id: s.category_id,
    checked_at: s.checked_at,
    demand_group: s.demand_group,
    demand_sub_group: s.demand_sub_group,
    product_id: s.product_id,
  }));
}

/**
 * Upsert one extracted pair into pairwise_comparisons (IndexedDB).
 * We don't have a unique constraint in Dexie; we need to find existing (store_id, level, scope, item_a, item_b) and update or add.
 */
async function upsertPairwise(
  storeId: string,
  level: "group" | "subgroup" | "product",
  scope: string | null,
  item_a: string,
  item_b: string,
  a_before_b_delta: number,
  b_before_a_delta: number
): Promise<void> {
  const existing = await db.pairwise_comparisons
    .where("store_id")
    .equals(storeId)
    .filter(
      (r) =>
        r.level === level &&
        (r.scope ?? null) === scope &&
        r.item_a === item_a &&
        r.item_b === item_b
    )
    .first();

  const now = new Date().toISOString();
  if (existing) {
    await db.pairwise_comparisons.update(existing.id!, {
      a_before_b_count: existing.a_before_b_count + a_before_b_delta,
      b_before_a_count: existing.b_before_a_count + b_before_a_delta,
      last_updated_at: now,
    });
  } else {
    await db.pairwise_comparisons.add({
      store_id: storeId,
      level,
      scope,
      item_a,
      item_b,
      a_before_b_count: a_before_b_delta,
      b_before_a_count: b_before_a_delta,
      last_updated_at: now,
    } as never);
  }
}

/**
 * Save checkoff sequence and pairwise comparisons for an archived trip.
 * Call after archiveListAsTrip when store_id is set.
 */
export async function saveCheckoffSequenceAndPairwise(
  tripId: string,
  storeId: string,
  userId: string,
  listItems: LocalListItem[]
): Promise<void> {
  if (listItems.length === 0) return;

  const sequenceItems = await buildSequenceItems(listItems);
  const is_valid = validateCheckoffSequence(sequenceItems);

  const sequence_id = generateId();
  const checkoffItems = toCheckoffSequenceItems(sequenceItems);
  await db.checkoff_sequences.add({
    sequence_id,
    trip_id: tripId,
    store_id: storeId,
    user_id: userId,
    is_valid,
    items: checkoffItems,
    created_at: new Date().toISOString(),
  } as never);

  if (!is_valid) return;

  const extracted = extractAllPairwise(sequenceItems);
  for (const e of extracted) {
    await upsertPairwise(
      storeId,
      e.level,
      e.scope,
      e.item_a,
      e.item_b,
      e.a_before_b,
      e.b_before_a
    );
  }
}
