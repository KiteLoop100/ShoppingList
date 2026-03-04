/**
 * Get the last completed trip for the current user (for "letzter Einkauf wiederholen").
 * Data source: Supabase (shopping_trips + trip_items).
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";

export interface LastTripInfo {
  trip_id: string;
  completed_at: string;
  item_count: number;
  items: Array<{
    product_id: string | null;
    custom_name: string | null;
    display_name: string;
    quantity: number;
    demand_group_code: string;
  }>;
}

export async function getLastTrip(): Promise<LastTripInfo | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const userId = getCurrentUserId();

  const { data: trip } = await supabase
    .from("shopping_trips")
    .select("trip_id, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!trip) return null;

  const { data: tripItems } = await supabase
    .from("trip_items")
    .select("product_id, custom_name, display_name, quantity, demand_group_code")
    .eq("trip_id", trip.trip_id)
    .order("check_position", { ascending: true });

  return {
    trip_id: trip.trip_id,
    completed_at: trip.completed_at,
    item_count: tripItems?.length ?? 0,
    items: (tripItems ?? []).map((t) => ({
      product_id: t.product_id,
      custom_name: t.custom_name,
      display_name: t.display_name,
      quantity: t.quantity,
      demand_group_code: t.demand_group_code ?? "AK",
    })),
  };
}
