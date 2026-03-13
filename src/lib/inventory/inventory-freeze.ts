/**
 * Freeze/thaw/seal operations for inventory items.
 * Extracted from inventory-service.ts to stay under 300-line limit.
 */

import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryItem, InventoryStatus } from "./inventory-types";
import { getThawShelfLifeDays } from "./thaw-shelf-life";

/**
 * Mark an inventory item as frozen. Idempotent: returns true if already frozen.
 */
export async function freezeInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
  currentItem?: Pick<InventoryItem, "is_frozen">,
): Promise<boolean> {
  if (currentItem?.is_frozen) return true;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      is_frozen: true,
      frozen_at: now,
      thawed_at: null,
      updated_at: now,
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] freezeInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Thaw a frozen inventory item. Sets best_before based on category-specific
 * shelf life after thawing. Idempotent: returns true if already thawed.
 */
export async function thawInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
  demandGroupCode: string | null,
  currentItem?: Pick<InventoryItem, "is_frozen">,
): Promise<boolean> {
  if (currentItem && !currentItem.is_frozen) return true;

  const now = new Date();
  const shelfLifeDays = getThawShelfLifeDays(demandGroupCode);
  const bestBefore = new Date(now);
  bestBefore.setDate(bestBefore.getDate() + shelfLifeDays);
  const bestBeforeStr = bestBefore.toISOString().split("T")[0];

  const { error } = await supabase
    .from("inventory_items")
    .update({
      is_frozen: false,
      thawed_at: now.toISOString(),
      best_before: bestBeforeStr,
      purchase_date: now.toISOString().split("T")[0],
      updated_at: now.toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] thawInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Revert an opened item back to sealed. Clears opened_at.
 */
export async function sealInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      status: "sealed" as InventoryStatus,
      opened_at: null,
      updated_at: now,
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] sealInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Update the best-before date of an inventory item.
 */
export async function updateBestBefore(
  supabase: SupabaseClient,
  itemId: string,
  bestBefore: string | null,
): Promise<boolean> {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      best_before: bestBefore,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] updateBestBefore error:", error.message);
    return false;
  }
  return true;
}

/**
 * Find an active inventory item by product_id or competitor_product_id.
 * Used by the barcode-based consume/open flows.
 */
export async function findInventoryItemByProductId(
  supabase: SupabaseClient,
  userId: string,
  productId: string | null,
  competitorProductId: string | null,
): Promise<InventoryItem | null> {
  const column = productId ? "product_id" : "competitor_product_id";
  const value = productId ?? competitorProductId;
  if (!value) return null;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .eq(column, value)
    .neq("status", "consumed")
    .order("best_before", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log.error("[inventory] findInventoryItemByProductId error:", error.message);
    return null;
  }
  return (data as InventoryItem) ?? null;
}
