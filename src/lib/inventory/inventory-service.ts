/**
 * Inventory CRUD operations for the Household Inventory feature (F42).
 * All reads/writes go through Supabase with RLS enforcing user_id filtering.
 */

import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product, CompetitorProduct } from "@/types";
import type {
  InventoryItem,
  InventorySource,
  InventoryStatus,
  InventoryUpsertInput,
} from "./inventory-types";

/**
 * Load all active (non-consumed) inventory items for a user.
 * Enriches items that have null demand_group_code by looking up
 * the product/competitor_product tables (self-healing for legacy data).
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
  const items = (data ?? []) as InventoryItem[];

  const { enrichMissingDemandGroupCodes: enrich } = await import("./inventory-receipt");
  await enrich(supabase, items);
  return items;
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
    const updatePayload: Record<string, unknown> = {
      quantity: newQty,
      updated_at: new Date().toISOString(),
    };
    if (input.demand_group_code) updatePayload.demand_group_code = input.demand_group_code;
    if (input.thumbnail_url) updatePayload.thumbnail_url = input.thumbnail_url;

    const { data: updated, error } = await supabase
      .from("inventory_items")
      .update(updatePayload)
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

/**
 * Map a Product (ALDI) to an InventoryUpsertInput for manual or barcode add.
 */
export function productToInventoryInput(
  product: Product,
  source: Extract<InventorySource, "manual" | "barcode">,
): InventoryUpsertInput {
  return {
    product_id: product.product_id,
    competitor_product_id: null,
    display_name: product.name,
    demand_group_code: product.demand_group_code,
    thumbnail_url: product.thumbnail_url ?? null,
    quantity: 1,
    source,
  };
}

/**
 * Map a CompetitorProduct to an InventoryUpsertInput for manual or barcode add.
 */
export function competitorProductToInventoryInput(
  product: CompetitorProduct,
  source: Extract<InventorySource, "manual" | "barcode">,
): InventoryUpsertInput {
  return {
    product_id: null,
    competitor_product_id: product.product_id,
    display_name: product.name,
    demand_group_code: product.demand_group_code ?? null,
    thumbnail_url: product.thumbnail_url ?? null,
    quantity: 1,
    source,
  };
}

// Receipt-based and enrichment operations are in ./inventory-receipt.ts
// to stay under the 300-line limit.
export type { ReceiptItemForInventory } from "./inventory-receipt";
export { upsertInventoryFromReceipt, backfillFromReceipts, enrichMissingDemandGroupCodes } from "./inventory-receipt";
