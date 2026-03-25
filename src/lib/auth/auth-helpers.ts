/**
 * One-time migration: moves local IndexedDB data and old device-id-based
 * Supabase data (receipts, auto_reorder_settings) to the new auth.uid().
 */

import { db } from "@/lib/db";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getOldDeviceId } from "@/lib/list/device-id";
import { generateId } from "@/lib/utils/generate-id";
import { log } from "@/lib/utils/logger";

const MIGRATION_FLAG = "data-migration-complete";

export async function migrateLocalDataToSupabase(
  newUserId: string
): Promise<void> {
  if (typeof window === "undefined") return;

  const alreadyDone = localStorage.getItem(MIGRATION_FLAG);
  if (alreadyDone) return;

  const oldDeviceId = getOldDeviceId();
  if (!oldDeviceId) {
    localStorage.setItem(MIGRATION_FLAG, "true");
    return;
  }

  const supabase = createClientIfConfigured();
  if (!supabase) return;

  try {
    // 1. Migrate IndexedDB shopping lists → Supabase
    const localLists = await db.lists.where("user_id").equals(oldDeviceId).toArray();

    const activeLocals = localLists.filter((l) => l.status === "active");
    let canonicalActiveListId: string | null = null;
    const demotedActiveListIds = new Set<string>();
    if (activeLocals.length > 1) {
      const sorted = [...activeLocals].sort((a, b) =>
        a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
      );
      canonicalActiveListId = sorted[0].list_id;
      for (let i = 1; i < sorted.length; i++) {
        demotedActiveListIds.add(sorted[i].list_id);
      }
    }

    const completedAtFallback = new Date().toISOString();

    const targetListIdForItems = (listId: string) =>
      canonicalActiveListId && demotedActiveListIds.has(listId)
        ? canonicalActiveListId
        : listId;

    for (const list of localLists) {
      let status = list.status;
      let completed_at = list.completed_at;
      if (demotedActiveListIds.has(list.list_id)) {
        status = "completed";
        completed_at = list.completed_at ?? completedAtFallback;
      }
      const { error } = await supabase.from("shopping_lists").insert({
        list_id: list.list_id,
        user_id: newUserId,
        store_id: list.store_id,
        status,
        created_at: list.created_at,
        completed_at,
      });
      if (error && !error.message.includes("duplicate")) {
        log.warn("[Migration] list insert error:", error.message);
      }
    }

    // 2. Migrate IndexedDB list items → Supabase
    for (const list of localLists) {
      const items = await db.list_items
        .where("list_id")
        .equals(list.list_id)
        .toArray();
      if (items.length > 0) {
        const rows = items.map((i) => ({
          item_id: i.item_id,
          list_id: targetListIdForItems(i.list_id),
          product_id: i.product_id,
          custom_name: i.custom_name,
          display_name: i.display_name,
          quantity: i.quantity,
          is_checked: i.is_checked,
          checked_at: i.checked_at,
          sort_position: i.sort_position,
          category_id: i.demand_group_code ?? "AK",
          added_at: i.added_at,
        }));
        const { error } = await supabase.from("list_items").insert(rows);
        if (error && !error.message.includes("duplicate")) {
          log.warn("[Migration] items insert error:", error.message);
        }
      }
    }

    // 3. Migrate IndexedDB trips → Supabase
    const localTrips = await db.trips
      .where("user_id")
      .equals(oldDeviceId)
      .toArray();
    for (const trip of localTrips) {
      const { error } = await supabase.from("shopping_trips").insert({
        trip_id: trip.trip_id,
        user_id: newUserId,
        store_id: trip.store_id,
        started_at: trip.started_at,
        completed_at: trip.completed_at,
        duration_seconds: trip.duration_seconds,
        total_items: trip.total_items,
        estimated_total_price: trip.estimated_total_price,
        sorting_errors_reported: trip.sorting_errors_reported,
        created_at: trip.created_at,
      });
      if (error && !error.message.includes("duplicate")) {
        log.warn("[Migration] trip insert error:", error.message);
      }

      const tripItems = await db.trip_items
        .where("trip_id")
        .equals(trip.trip_id)
        .toArray();
      if (tripItems.length > 0) {
        const rows = tripItems.map((ti) => ({
          trip_item_id: ti.trip_item_id || generateId(),
          trip_id: ti.trip_id,
          product_id: ti.product_id,
          custom_name: ti.custom_name,
          display_name: ti.display_name,
          quantity: ti.quantity,
          price_at_purchase: ti.price_at_purchase,
          category_id: ti.demand_group_code ?? "AK",
          check_position: ti.check_position,
          checked_at: ti.checked_at,
          was_removed: ti.was_removed,
        }));
        const { error: tiErr } = await supabase
          .from("trip_items")
          .insert(rows);
        if (tiErr && !tiErr.message.includes("duplicate")) {
          log.warn("[Migration] trip_items insert error:", tiErr.message);
        }
      }
    }

    // 4. Re-assign existing Supabase data (receipts, auto_reorder_settings)
    await supabase
      .from("receipts")
      .update({ user_id: newUserId })
      .eq("user_id", oldDeviceId);

    await supabase
      .from("auto_reorder_settings")
      .update({ user_id: newUserId })
      .eq("user_id", oldDeviceId);

    // 5. Mark migration as done
    localStorage.setItem(MIGRATION_FLAG, "true");
    log.info("[Migration] Data migration complete.");
  } catch (err) {
    log.error("[Migration] Failed:", err);
  }
}
