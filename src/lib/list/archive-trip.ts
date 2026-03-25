/**
 * Archive the current list as a completed trip when the last item is checked.
 * Used to support "letzter Einkauf wiederholen".
 * Data source: Supabase.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { POSTGRES_UNIQUE_VIOLATION } from "@/lib/supabase/postgres-errors";
import { saveCheckoffSequenceAndPairwise } from "./save-checkoff-and-pairwise";
import { generateId } from "@/lib/utils/generate-id";
import { log } from "@/lib/utils/logger";

export async function archiveListAsTrip(
  listId: string,
  deferredItemIds?: string[]
): Promise<string | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data: list } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("list_id", listId)
    .maybeSingle();

  if (!list || list.status !== "active") return null;

  const { data: allItems } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", listId);

  if (!allItems) return null;

  const completedAt = new Date().toISOString();
  const deferredSet = new Set(deferredItemIds ?? []);
  const tripItems = allItems.filter((i) => !deferredSet.has(i.item_id));
  const deferredItems = allItems.filter((i) => deferredSet.has(i.item_id));

  const checkTimestamps = tripItems
    .filter((i) => i.checked_at)
    .map((i) => new Date(i.checked_at!).getTime());
  const firstCheckTime = checkTimestamps.length > 0 ? Math.min(...checkTimestamps) : null;
  const lastCheckTime = checkTimestamps.length > 0 ? Math.max(...checkTimestamps) : null;
  const startedAt = firstCheckTime ? new Date(firstCheckTime).toISOString() : list.created_at;
  const durationSeconds =
    firstCheckTime && lastCheckTime
      ? Math.max(0, Math.floor((lastCheckTime - firstCheckTime) / 1000))
      : 0;

  const trip_id = generateId();
  const user_id = list.user_id;

  const { error: tripErr } = await supabase.from("shopping_trips").insert({
    trip_id,
    user_id,
    store_id: list.store_id,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: durationSeconds,
    total_items: tripItems.length,
    estimated_total_price: null,
    sorting_errors_reported: 0,
    created_at: completedAt,
  });

  if (tripErr) {
    log.error("[archiveListAsTrip] trip insert error:", tripErr);
    return null;
  }

  const tripItemRows = tripItems.map((item, idx) => ({
    trip_item_id: generateId(),
    trip_id,
    product_id: item.product_id,
    custom_name: item.custom_name,
    display_name: item.display_name,
    quantity: item.quantity,
    price_at_purchase: null,
    demand_group_code: item.demand_group_code,
    check_position: idx + 1,
    checked_at: item.checked_at ?? completedAt,
    was_removed: false,
    comment: item.comment ?? null,
  }));

  if (tripItemRows.length > 0) {
    await supabase.from("trip_items").insert(tripItemRows);
  }

  // Mark list as completed
  await supabase
    .from("shopping_lists")
    .update({ status: "completed", completed_at: completedAt })
    .eq("list_id", listId);

  // Carry deferred items over to a new active list (or existing one if unique constraint hits)
  if (deferredItems.length > 0) {
    const newListId = generateId();
    const now = new Date().toISOString();

    const { data: insertedList, error: insertListErr } = await supabase
      .from("shopping_lists")
      .insert({
        list_id: newListId,
        user_id,
        store_id: list.store_id,
        status: "active",
        created_at: now,
      })
      .select()
      .single();

    let targetListId: string;
    if (insertListErr?.code === POSTGRES_UNIQUE_VIOLATION) {
      log.warn(
        "[archiveListAsTrip] active list already exists, attaching deferred items to it:",
        insertListErr.message,
      );
      const { data: activeRows, error: activeErr } = await supabase
        .from("shopping_lists")
        .select("list_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      const existingActive = activeRows?.[0] ?? null;
      if (activeErr || !existingActive) {
        log.error(
          "[archiveListAsTrip] unique violation but could not load active list:",
          insertListErr,
          activeErr,
        );
        return null;
      }
      targetListId = existingActive.list_id;
    } else if (insertListErr || !insertedList) {
      log.error("[archiveListAsTrip] shopping_lists insert error:", insertListErr);
      return null;
    } else {
      targetListId = insertedList.list_id;
    }

    const newItems = deferredItems.map((item) => {
      const { item_id: _, list_id: _l, is_checked: _c, checked_at: _ca, added_at: _a, ...rest } = item;
      return {
        ...rest,
        item_id: generateId(),
        list_id: targetListId,
        is_checked: false,
        checked_at: null,
        added_at: now,
      };
    });

    if (newItems.length > 0) {
      await supabase.from("list_items").insert(newItems);
    }

    // Remove deferred items from old list
    const deferredIds = deferredItems.map((i) => i.item_id);
    await supabase.from("list_items").delete().in("item_id", deferredIds);
  }

  const gpsConfirmed = (list as unknown as Record<string, unknown>).gps_confirmed_in_store;
  if (list.store_id && gpsConfirmed) {
    try {
      const localItems = tripItems.map((i) => ({
        item_id: i.item_id,
        list_id: i.list_id,
        product_id: i.product_id ?? null,
        custom_name: i.custom_name ?? null,
        display_name: i.display_name,
        quantity: i.quantity,
        is_checked: i.is_checked,
        checked_at: i.checked_at ?? null,
        sort_position: i.sort_position,
        demand_group_code: i.demand_group_code ?? "AK",
        added_at: i.added_at,
      }));
      await saveCheckoffSequenceAndPairwise(
        trip_id,
        list.store_id,
        user_id,
        localItems
      );
    } catch {
      // Non-fatal: trip is already archived
    }
  }

  return trip_id;
}
