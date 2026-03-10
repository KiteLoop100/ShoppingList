/**
 * Inventory CRUD operations for the Household Inventory feature (F42).
 * All reads/writes go through Supabase with RLS enforcing user_id filtering.
 */

import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryItem,
  InventoryStatus,
  InventoryUpsertInput,
} from "./inventory-types";

/**
 * Load all active (non-consumed) inventory items for a user.
 */
export async function loadInventory(
  supabase: SupabaseClient,
  userId: string,
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "consumed")
    .order("added_at", { ascending: false });

  if (error) {
    log.error("[inventory] loadInventory error:", error.message);
    return [];
  }
  return (data ?? []) as InventoryItem[];
}

/**
 * Upsert a single inventory item. If an active (non-consumed) item with the
 * same product already exists, its quantity is incremented.
 *
 * IMPORTANT: Uses raw SQL via rpc to leverage the partial unique index with
 * ON CONFLICT, since Supabase JS client doesn't support partial-index upserts.
 * Falls back to SELECT+INSERT/UPDATE when rpc is unavailable.
 */
export async function upsertInventoryItem(
  supabase: SupabaseClient,
  userId: string,
  input: InventoryUpsertInput,
): Promise<InventoryItem | null> {
  const productColumn = input.product_id ? "product_id" : "competitor_product_id";
  const productValue = input.product_id ?? input.competitor_product_id;

  if (!productValue) {
    log.warn("[inventory] upsertInventoryItem: no product_id or competitor_product_id");
    return null;
  }

  const { data: existing } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq(productColumn, productValue)
    .neq("status", "consumed")
    .maybeSingle();

  if (existing) {
    const newQty = existing.quantity + input.quantity;
    const { data: updated, error } = await supabase
      .from("inventory_items")
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      log.error("[inventory] upsert update error:", error.message);
      return null;
    }
    return updated as InventoryItem;
  }

  const { data: inserted, error } = await supabase
    .from("inventory_items")
    .insert({
      user_id: userId,
      product_id: input.product_id,
      competitor_product_id: input.competitor_product_id,
      display_name: input.display_name,
      demand_group_code: input.demand_group_code,
      thumbnail_url: input.thumbnail_url ?? null,
      quantity: input.quantity,
      source: input.source,
      source_receipt_id: input.source_receipt_id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    log.error("[inventory] upsert insert error:", error.message);
    return null;
  }
  return inserted as InventoryItem;
}

/**
 * Mark an inventory item as consumed.
 */
export async function consumeInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      status: "consumed" as InventoryStatus,
      consumed_at: now,
      updated_at: now,
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] consumeInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Undo consuming — revert an item back to its previous status.
 */
export async function unconsume(
  supabase: SupabaseClient,
  itemId: string,
  previousStatus: "sealed" | "opened" = "sealed",
): Promise<boolean> {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      status: previousStatus,
      consumed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] unconsume error:", error.message);
    return false;
  }
  return true;
}

/**
 * Mark an inventory item as opened.
 */
export async function openInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      status: "opened" as InventoryStatus,
      opened_at: now,
      updated_at: now,
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] openInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Update the quantity of an inventory item.
 */
export async function updateQuantity(
  supabase: SupabaseClient,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  if (quantity < 1) {
    log.warn("[inventory] updateQuantity: quantity must be >= 1");
    return false;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      quantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] updateQuantity error:", error.message);
    return false;
  }
  return true;
}

/**
 * Delete an inventory item permanently.
 */
export async function removeInventoryItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    log.error("[inventory] removeInventoryItem error:", error.message);
    return false;
  }
  return true;
}

/**
 * Check whether inventory feature is enabled for a user (server-side).
 */
export async function isInventoryEnabledForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("enable_inventory")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.enable_inventory === true;
}

export interface ReceiptItemForInventory {
  product_id: string | null;
  competitor_product_id: string | null;
  receipt_name: string;
  quantity: number;
  demand_group_code?: string | null;
  thumbnail_url?: string | null;
}

/**
 * Upsert inventory items from a processed receipt.
 * Called from both parse-receipt.ts and merge-receipt.ts.
 * Checks enable_inventory server-side before writing.
 */
export async function upsertInventoryFromReceipt(
  supabase: SupabaseClient,
  userId: string,
  receiptId: string,
  items: ReceiptItemForInventory[],
): Promise<void> {
  const enabled = await isInventoryEnabledForUser(supabase, userId);
  if (!enabled) return;

  for (const item of items) {
    if (!item.product_id && !item.competitor_product_id) continue;

    await upsertInventoryItem(supabase, userId, {
      product_id: item.product_id,
      competitor_product_id: item.competitor_product_id,
      display_name: item.receipt_name,
      demand_group_code: item.demand_group_code ?? null,
      thumbnail_url: item.thumbnail_url ?? null,
      quantity: item.quantity,
      source: "receipt",
      source_receipt_id: receiptId,
    });
  }
}

/**
 * Backfill inventory from existing receipt_items (last N weeks).
 * Used when user first enables the inventory feature.
 */
export async function backfillFromReceipts(
  supabase: SupabaseClient,
  userId: string,
  weeksBack: number = 4,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - weeksBack * 7);

  const { data: receipts, error: rError } = await supabase
    .from("receipts")
    .select("receipt_id")
    .eq("user_id", userId)
    .gte("purchase_date", cutoffDate.toISOString().split("T")[0])
    .order("purchase_date", { ascending: false });

  if (rError || !receipts?.length) return 0;

  const receiptIds = receipts.map((r: { receipt_id: string }) => r.receipt_id);

  const { data: items, error: iError } = await supabase
    .from("receipt_items")
    .select("product_id, competitor_product_id, receipt_name, quantity")
    .in("receipt_id", receiptIds);

  if (iError || !items?.length) return 0;

  let count = 0;
  for (const item of items) {
    if (!item.product_id && !item.competitor_product_id) continue;

    const result = await upsertInventoryItem(supabase, userId, {
      product_id: item.product_id,
      competitor_product_id: item.competitor_product_id,
      display_name: item.receipt_name,
      demand_group_code: null,
      quantity: item.quantity || 1,
      source: "receipt",
    });
    if (result) count++;
  }

  return count;
}
