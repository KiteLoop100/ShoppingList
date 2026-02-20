/**
 * Report current list sort order as a sorting error (for admin review).
 */

import { db } from "@/lib/db";
import { getActiveListWithItems } from "@/lib/list";
import { getDeviceUserId } from "@/lib/list/device-id";
import type { SortingError } from "@/types";

function generateErrorId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "err-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

/** Returns true if a report was saved (list has a store). */
export async function reportSortingError(): Promise<boolean> {
  const { list, items } = await getActiveListWithItems();
  const store_id = list.store_id ?? "";
  if (!store_id) return false;
  const user_id = getDeviceUserId();
  const error_id = generateErrorId();
  const reported_at = new Date().toISOString();
  const sorted = [...items].sort((a, b) => a.sort_position - b.sort_position);
  const current_sort_order = sorted.map((i) => ({
    item_id: i.item_id,
    display_name: i.display_name,
    category_id: i.category_id,
    sort_position: i.sort_position,
  }));
  const entry: SortingError = {
    error_id,
    user_id,
    store_id,
    trip_id: null,
    current_sort_order,
    reported_at,
    status: "open",
  };
  await db.sorting_errors.add(entry as never);
  return true;
}
