/**
 * F01 + LEARNING-LOGIC.md §6: "Liste mit typischen Produkten befüllen".
 * Products that appeared on ≥50% of the last 10 trips, with last-used quantity.
 */

import { db } from "@/lib/db";
import { getDeviceUserId } from "./device-id";
import { addListItem } from "./active-list";

const LAST_N_TRIPS = 10;
const TYPICAL_THRESHOLD_RATIO = 0.5;
const MIN_TRIPS_FOR_FEATURE = 3;

export interface TypicalProductItem {
  product_id: string | null;
  display_name: string;
  category_id: string;
  quantity: number;
}

/** Number of completed trips for the current user. */
export async function getCompletedTripCount(): Promise<number> {
  const user_id = getDeviceUserId();
  const trips = await db.trips.where("user_id").equals(user_id).toArray();
  return trips.length;
}

/** Whether "fill with typical products" is available (≥3 trips). */
export async function canFillWithTypicalProducts(): Promise<boolean> {
  return (await getCompletedTripCount()) >= MIN_TRIPS_FOR_FEATURE;
}

/**
 * Get typical products: those that appeared on ≥50% of the last 10 trips.
 * Quantity = last used quantity (from most recent trip containing that product).
 */
export async function getTypicalProducts(): Promise<TypicalProductItem[]> {
  const user_id = getDeviceUserId();
  const trips = await db.trips
    .where("user_id")
    .equals(user_id)
    .sortBy("completed_at");
  const sortedTrips = trips
    .slice()
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  const lastN = sortedTrips.slice(0, LAST_N_TRIPS);
  if (lastN.length < MIN_TRIPS_FOR_FEATURE) return [];

  const tripIds = lastN.map((t) => t.trip_id);
  const allItems: Array<{
    trip_id: string;
    completed_at: string;
    product_id: string | null;
    display_name: string;
    category_id: string;
    quantity: number;
  }> = [];
  for (const trip of lastN) {
    const items = await db.trip_items.where("trip_id").equals(trip.trip_id).toArray();
    for (const it of items) {
      allItems.push({
        trip_id: trip.trip_id,
        completed_at: trip.completed_at,
        product_id: it.product_id,
        display_name: it.display_name,
        category_id: it.category_id,
        quantity: it.quantity,
      });
    }
  }

  // Key: product_id if set, else display_name (custom items)
  const key = (p: { product_id: string | null; display_name: string }) =>
    p.product_id ?? `custom:${p.display_name}`;

  // Per product key: which trips it appeared in, and latest (quantity, category) from most recent trip
  const byKey = new Map<
    string,
    {
      tripIds: Set<string>;
      lastCompletedAt: string;
      product_id: string | null;
      display_name: string;
      category_id: string;
      quantity: number;
    }
  >();
  for (const item of allItems) {
    const k = key(item);
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, {
        tripIds: new Set([item.trip_id]),
        lastCompletedAt: item.completed_at,
        product_id: item.product_id,
        display_name: item.display_name,
        category_id: item.category_id,
        quantity: item.quantity,
      });
    } else {
      existing.tripIds.add(item.trip_id);
      if (item.completed_at > existing.lastCompletedAt) {
        existing.lastCompletedAt = item.completed_at;
        existing.quantity = item.quantity;
        existing.category_id = item.category_id;
      }
    }
  }

  const numTrips = lastN.length;
  const threshold = Math.ceil(numTrips * TYPICAL_THRESHOLD_RATIO);
  const result: TypicalProductItem[] = [];
  for (const [, v] of byKey) {
    if (v.tripIds.size >= threshold) {
      result.push({
        product_id: v.product_id,
        display_name: v.display_name,
        category_id: v.category_id,
        quantity: v.quantity,
      });
    }
  }
  return result;
}

/**
 * Fill the given list with typical products (adds items via addListItem).
 * Returns the number of items added.
 */
export async function fillListWithTypicalProducts(listId: string): Promise<number> {
  const items = await getTypicalProducts();
  for (const it of items) {
    await addListItem({
      list_id: listId,
      product_id: it.product_id,
      custom_name: it.product_id ? null : it.display_name,
      display_name: it.display_name,
      category_id: it.category_id,
      quantity: it.quantity,
    });
  }
  return items.length;
}
