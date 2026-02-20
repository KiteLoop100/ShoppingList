/**
 * Archive the current list as a completed trip when the last item is checked.
 * Used to support "letzter Einkauf wiederholen".
 * When store_id is set, saves CheckoffSequence and pairwise comparisons (LEARNING-LOGIC 2.4).
 */

import { db } from "@/lib/db";
import { saveCheckoffSequenceAndPairwise } from "./save-checkoff-and-pairwise";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export async function archiveListAsTrip(listId: string): Promise<string | null> {
  const list = await db.lists.where("list_id").equals(listId).first();
  if (!list || list.status !== "active") return null;

  const items = await db.list_items.where("list_id").equals(listId).toArray();
  const completedAt = new Date().toISOString();
  const startedAt = list.created_at;
  const durationSeconds = Math.max(
    0,
    Math.floor((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  );

  const trip_id = generateId();
  const user_id = list.user_id;

  const trip = {
    trip_id,
    user_id,
    store_id: list.store_id,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: durationSeconds,
    total_items: items.length,
    estimated_total_price: null as number | null,
    sorting_errors_reported: 0,
    created_at: completedAt,
  };
  await db.trips.add(trip as never);

  let checkPosition = 0;
  for (const item of items) {
    checkPosition += 1;
    const trip_item_id = generateId();
    await db.trip_items.add({
      trip_item_id,
      trip_id,
      product_id: item.product_id,
      custom_name: item.custom_name,
      display_name: item.display_name,
      quantity: item.quantity,
      price_at_purchase: null,
      category_id: item.category_id,
      check_position: checkPosition,
      checked_at: item.checked_at ?? completedAt,
      was_removed: false,
    } as never);
  }

  list.status = "completed";
  list.completed_at = completedAt;
  await db.lists.put(list as never);

  if (list.store_id) {
    try {
      await saveCheckoffSequenceAndPairwise(
        trip_id,
        list.store_id,
        user_id,
        items
      );
    } catch {
      // Non-fatal: trip is already archived
    }
  }

  return trip_id;
}
