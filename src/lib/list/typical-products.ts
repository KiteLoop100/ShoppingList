/**
 * F01 + LEARNING-LOGIC.md §6: "Fill list with typical products".
 * Products that appeared on >=50% of the last 10 trips, with last-used quantity.
 * Data source: Supabase (shopping_trips + trip_items).
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { addListItem } from "./active-list";

const LAST_N_TRIPS = 10;
const TYPICAL_THRESHOLD_RATIO = 0.5;
const MIN_TRIPS_FOR_FEATURE = 3;

export interface TypicalProductItem {
  product_id: string | null;
  display_name: string;
  demand_group_code: string;
  /** @deprecated Use demand_group_code. */
  category_id?: string;
  quantity: number;
}

export async function getCompletedTripCount(): Promise<number> {
  const supabase = createClientIfConfigured();
  if (!supabase) return 0;

  const userId = getCurrentUserId();
  const { count } = await supabase
    .from("shopping_trips")
    .select("trip_id", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

export async function canFillWithTypicalProducts(): Promise<boolean> {
  return (await getCompletedTripCount()) >= MIN_TRIPS_FOR_FEATURE;
}

export async function getTypicalProducts(): Promise<TypicalProductItem[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const userId = getCurrentUserId();

  const { data: trips } = await supabase
    .from("shopping_trips")
    .select("trip_id, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(LAST_N_TRIPS);

  if (!trips || trips.length < MIN_TRIPS_FOR_FEATURE) return [];

  const tripIds = trips.map((t) => t.trip_id);
  const { data: allTripItems } = await supabase
    .from("trip_items")
    .select("trip_id, product_id, display_name, demand_group_code, category_id, quantity")
    .in("trip_id", tripIds);

  if (!allTripItems) return [];

  const tripCompletedAt = new Map(trips.map((t) => [t.trip_id, t.completed_at]));

  const key = (p: { product_id: string | null; display_name: string }) =>
    p.product_id ?? `custom:${p.display_name}`;

  const byKey = new Map<
    string,
    {
      tripIds: Set<string>;
      lastCompletedAt: string;
      product_id: string | null;
      display_name: string;
      demand_group_code: string;
      category_id?: string;
      quantity: number;
    }
  >();

  for (const item of allTripItems) {
    const completedAt = tripCompletedAt.get(item.trip_id) ?? "";
    const k = key(item);
    const dgCode = item.demand_group_code ?? item.category_id ?? "AK";
    const existing = byKey.get(k);
    if (!existing) {
      byKey.set(k, {
        tripIds: new Set([item.trip_id]),
        lastCompletedAt: completedAt,
        product_id: item.product_id,
        display_name: item.display_name,
        demand_group_code: dgCode,
        category_id: item.category_id,
        quantity: item.quantity,
      });
    } else {
      existing.tripIds.add(item.trip_id);
      if (completedAt > existing.lastCompletedAt) {
        existing.lastCompletedAt = completedAt;
        existing.quantity = item.quantity;
        existing.demand_group_code = dgCode;
        existing.category_id = item.category_id;
      }
    }
  }

  const numTrips = trips.length;
  const threshold = Math.ceil(numTrips * TYPICAL_THRESHOLD_RATIO);
  const result: TypicalProductItem[] = [];
  for (const [, v] of byKey) {
    if (v.tripIds.size >= threshold) {
      result.push({
        product_id: v.product_id,
        display_name: v.display_name,
        demand_group_code: v.demand_group_code,
        category_id: v.category_id,
        quantity: v.quantity,
      });
    }
  }
  return result;
}

export async function fillListWithTypicalProducts(listId: string): Promise<number> {
  const items = await getTypicalProducts();
  for (const it of items) {
    await addListItem({
      list_id: listId,
      product_id: it.product_id,
      custom_name: it.product_id ? null : it.display_name,
      display_name: it.display_name,
      demand_group_code: it.demand_group_code,
      category_id: it.category_id,
      quantity: it.quantity,
    });
  }
  return items.length;
}
