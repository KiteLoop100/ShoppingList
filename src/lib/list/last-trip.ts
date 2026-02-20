/**
 * Get the last completed trip for the current user (for "letzter Einkauf wiederholen").
 */

import { db } from "@/lib/db";
import { getDeviceUserId } from "./device-id";

export interface LastTripInfo {
  trip_id: string;
  completed_at: string;
  item_count: number;
  items: Array<{
    product_id: string | null;
    custom_name: string | null;
    display_name: string;
    quantity: number;
    category_id: string;
  }>;
}

export async function getLastTrip(): Promise<LastTripInfo | null> {
  const user_id = getDeviceUserId();
  const all = await db.trips.where("user_id").equals(user_id).toArray();
  const sorted = all.sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  );
  const last = sorted[0];
  if (!last) return null;

  const tripItems = await db.trip_items
    .where("trip_id")
    .equals(last.trip_id)
    .sortBy("check_position");

  return {
    trip_id: last.trip_id,
    completed_at: last.completed_at,
    item_count: tripItems.length,
    items: tripItems.map((t) => ({
      product_id: t.product_id,
      custom_name: t.custom_name,
      display_name: t.display_name,
      quantity: t.quantity,
      category_id: t.category_id,
    })),
  };
}
