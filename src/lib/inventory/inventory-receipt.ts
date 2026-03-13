/**
 * Receipt-based inventory operations: upsert from receipt and backfill.
 * Extracted from inventory-service.ts to stay under 300-line limit.
 */

import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryItem, InventoryUpsertInput } from "./inventory-types";
import { upsertInventoryItem, isInventoryEnabledForUser } from "./inventory-service";
import { calculateBestBefore } from "./shelf-life-calc";

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
 * Enriches items with demand_group_code/thumbnail_url from product tables
 * when receipt items don't carry these fields.
 */
export async function upsertInventoryFromReceipt(
  supabase: SupabaseClient,
  userId: string,
  receiptId: string,
  items: ReceiptItemForInventory[],
  purchaseDate?: string | null,
): Promise<void> {
  const enabled = await isInventoryEnabledForUser(supabase, userId);
  if (!enabled) return;

  const relevantItems = items.filter((i) => i.product_id || i.competitor_product_id);
  if (relevantItems.length === 0) return;

  const resolvedPurchaseDate = purchaseDate ?? await lookupReceiptPurchaseDate(supabase, receiptId);
  const productMeta = await batchLookupProductMeta(supabase, relevantItems);

  for (const item of relevantItems) {
    const key = item.product_id ?? item.competitor_product_id ?? "";
    const meta = productMeta.get(key);
    const bestBefore = calculateBestBefore(resolvedPurchaseDate, meta?.typical_shelf_life_days);

    await upsertInventoryItem(supabase, userId, {
      product_id: item.product_id,
      competitor_product_id: item.competitor_product_id,
      display_name: item.receipt_name,
      demand_group_code: item.demand_group_code ?? meta?.demand_group_code ?? null,
      thumbnail_url: item.thumbnail_url ?? meta?.thumbnail_url ?? null,
      quantity: item.quantity,
      source: "receipt",
      source_receipt_id: receiptId,
      purchase_date: resolvedPurchaseDate ?? undefined,
      best_before: bestBefore ?? undefined,
    });
  }
}

async function lookupReceiptPurchaseDate(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("receipts")
    .select("purchase_date")
    .eq("receipt_id", receiptId)
    .maybeSingle();

  if (error || !data?.purchase_date) return null;
  return data.purchase_date;
}

type ProductMeta = {
  demand_group_code: string | null;
  thumbnail_url: string | null;
  typical_shelf_life_days: number | null;
};

async function batchLookupProductMeta(
  supabase: SupabaseClient,
  items: ReceiptItemForInventory[],
): Promise<Map<string, ProductMeta>> {
  const result = new Map<string, ProductMeta>();

  const productIds = items.filter((i) => i.product_id).map((i) => i.product_id!);
  const competitorIds = items.filter((i) => !i.product_id && i.competitor_product_id).map((i) => i.competitor_product_id!);

  if (productIds.length > 0) {
    const { data } = await supabase
      .from("products")
      .select("product_id, demand_group_code, thumbnail_url, typical_shelf_life_days")
      .in("product_id", [...new Set(productIds)]);
    for (const p of data ?? []) {
      result.set(p.product_id, {
        demand_group_code: p.demand_group_code,
        thumbnail_url: p.thumbnail_url,
        typical_shelf_life_days: p.typical_shelf_life_days,
      });
    }
  }

  if (competitorIds.length > 0) {
    const { data } = await supabase
      .from("competitor_products")
      .select("product_id, demand_group_code, thumbnail_url, typical_shelf_life_days")
      .in("product_id", [...new Set(competitorIds)]);
    for (const p of data ?? []) {
      result.set(p.product_id, {
        demand_group_code: p.demand_group_code,
        thumbnail_url: p.thumbnail_url,
        typical_shelf_life_days: p.typical_shelf_life_days,
      });
    }
  }

  return result;
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
    .select("receipt_id, purchase_date")
    .eq("user_id", userId)
    .gte("purchase_date", cutoffDate.toISOString().split("T")[0])
    .order("purchase_date", { ascending: false });

  if (rError || !receipts?.length) return 0;

  const receiptDateMap = new Map<string, string | null>();
  for (const r of receipts) {
    receiptDateMap.set(r.receipt_id, r.purchase_date ?? null);
  }
  const receiptIds = receipts.map((r: { receipt_id: string }) => r.receipt_id);

  const { data: items, error: iError } = await supabase
    .from("receipt_items")
    .select("product_id, competitor_product_id, receipt_name, quantity, receipt_id")
    .in("receipt_id", receiptIds);

  if (iError || !items?.length) return 0;

  type AggItem = {
    display_name: string;
    product_id: string | null;
    competitor_product_id: string | null;
    quantity: number;
    purchase_date: string | null;
  };
  const aggregated = new Map<string, AggItem>();
  for (const item of items) {
    const pid = item.product_id ?? item.competitor_product_id;
    if (!pid) continue;
    const key = `${item.product_id ? "p" : "c"}:${pid}`;
    const itemPurchaseDate = receiptDateMap.get(item.receipt_id) ?? null;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += item.quantity || 1;
      if (itemPurchaseDate && (!existing.purchase_date || itemPurchaseDate > existing.purchase_date)) {
        existing.purchase_date = itemPurchaseDate;
      }
    } else {
      aggregated.set(key, {
        display_name: item.receipt_name,
        product_id: item.product_id,
        competitor_product_id: item.competitor_product_id,
        quantity: item.quantity || 1,
        purchase_date: itemPurchaseDate,
      });
    }
  }

  const metaItems: ReceiptItemForInventory[] = [...aggregated.values()].map((a) => ({
    product_id: a.product_id,
    competitor_product_id: a.competitor_product_id,
    receipt_name: a.display_name,
    quantity: a.quantity,
  }));
  const productMeta = await batchLookupProductMeta(supabase, metaItems);

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
    const pid = agg.product_id ?? agg.competitor_product_id ?? "";
    const meta = productMeta.get(pid);
    const key = `${agg.product_id ? "p" : "c"}:${pid}`;
    const ex = existingMap.get(key);
    if (ex) {
      updates.push({ id: ex.id, quantity: ex.quantity + agg.quantity });
    } else {
      const bestBefore = calculateBestBefore(agg.purchase_date, meta?.typical_shelf_life_days);
      const row: Record<string, unknown> = {
        user_id: userId,
        product_id: agg.product_id,
        competitor_product_id: agg.competitor_product_id,
        display_name: agg.display_name,
        demand_group_code: meta?.demand_group_code ?? null,
        thumbnail_url: meta?.thumbnail_url ?? null,
        quantity: agg.quantity,
        source: "receipt",
      };
      if (agg.purchase_date) row.purchase_date = agg.purchase_date;
      if (bestBefore) row.best_before = bestBefore;
      toInsert.push(row);
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

/**
 * Enrich inventory items that have null demand_group_code by looking up
 * the product/competitor_product tables. Mutates items in-place.
 */
export async function enrichMissingDemandGroupCodes(
  supabase: SupabaseClient,
  items: InventoryItem[],
): Promise<void> {
  const needsEnrich = items.filter((i) => !i.demand_group_code);
  if (needsEnrich.length === 0) return;

  const enrichItems: ReceiptItemForInventory[] = needsEnrich.map((i) => ({
    product_id: i.product_id,
    competitor_product_id: i.competitor_product_id,
    receipt_name: i.display_name,
    quantity: i.quantity,
  }));
  const meta = await batchLookupProductMeta(supabase, enrichItems);

  for (const item of needsEnrich) {
    const pid = item.product_id ?? item.competitor_product_id;
    if (pid) {
      const m = meta.get(pid);
      if (m?.demand_group_code) item.demand_group_code = m.demand_group_code;
      if (m?.thumbnail_url && !item.thumbnail_url) item.thumbnail_url = m.thumbnail_url;
    }
  }
}
