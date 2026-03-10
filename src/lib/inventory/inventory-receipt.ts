/**
 * Receipt-based inventory operations: upsert from receipt and backfill.
 * Extracted from inventory-service.ts to stay under 300-line limit.
 */

import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryUpsertInput } from "./inventory-types";
import { upsertInventoryItem, isInventoryEnabledForUser } from "./inventory-service";

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
 * Uses bulk operations: pre-aggregates by product, then batch-inserts/updates.
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

  const aggregated = new Map<string, { display_name: string; product_id: string | null; competitor_product_id: string | null; quantity: number }>();
  for (const item of items) {
    const pid = item.product_id ?? item.competitor_product_id;
    if (!pid) continue;
    const key = `${item.product_id ? "p" : "c"}:${pid}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += item.quantity || 1;
    } else {
      aggregated.set(key, {
        display_name: item.receipt_name,
        product_id: item.product_id,
        competitor_product_id: item.competitor_product_id,
        quantity: item.quantity || 1,
      });
    }
  }

  const { data: existingInv } = await supabase
    .from("inventory_items")
    .select("id, product_id, competitor_product_id, quantity")
    .eq("user_id", userId)
    .neq("status", "consumed");

  const existingMap = new Map<string, { id: string; quantity: number }>();
  for (const inv of existingInv ?? []) {
    if (inv.product_id) existingMap.set(`p:${inv.product_id}`, { id: inv.id, quantity: inv.quantity });
    if (inv.competitor_product_id) existingMap.set(`c:${inv.competitor_product_id}`, { id: inv.id, quantity: inv.quantity });
  }

  const toInsert: Record<string, unknown>[] = [];
  const updates: { id: string; quantity: number }[] = [];

  for (const [, agg] of aggregated) {
    const key = `${agg.product_id ? "p" : "c"}:${agg.product_id ?? agg.competitor_product_id}`;
    const ex = existingMap.get(key);
    if (ex) {
      updates.push({ id: ex.id, quantity: ex.quantity + agg.quantity });
    } else {
      toInsert.push({
        user_id: userId,
        product_id: agg.product_id,
        competitor_product_id: agg.competitor_product_id,
        display_name: agg.display_name,
        quantity: agg.quantity,
        source: "receipt",
      });
    }
  }

  let count = 0;

  if (toInsert.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.from("inventory_items").insert(batch).select("id");
      if (!error && data) count += data.length;
      else if (error) log.warn("[inventory] backfill batch insert error:", error.message);
    }
  }

  for (const upd of updates) {
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: upd.quantity, updated_at: new Date().toISOString() })
      .eq("id", upd.id);
    if (!error) count++;
    else log.warn("[inventory] backfill update error:", error.message);
  }

  return count;
}
