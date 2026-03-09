/**
 * Data layer for the per-retailer "Letzte Einkäufe" dropdown menu.
 *
 * getRetailerReceiptSummary() — retailers with receipt counts (for building the menu).
 * getReceiptProductsByTrip()  — products from specific receipt(s) for a retailer.
 */

import { getCurrentUserId } from "@/lib/auth/auth-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { isHomeRetailer } from "@/lib/retailers/retailers";
import { getCategoryGroup } from "@/lib/list/recent-purchase-categories";
import { log } from "@/lib/utils/logger";

export interface RetailerReceiptSummary {
  retailer: string;
  displayName: string;
  receiptCount: number;
  totalSpent: number;
  isHomeRetailer: boolean;
}

export interface ReceiptProduct {
  product_id: string;
  receipt_name: string;
  frequency: number;
}

export type ReceiptTripMode = "single" | "combined" | "not-recently";

const RECENT_WEEKS = 8;
const YEAR_DAYS = 365;

const DISPLAY_NAMES: Record<string, string> = {
  ALDI: "ALDI SÜD",
};

function retailerDisplayName(retailer: string): string {
  return DISPLAY_NAMES[retailer] ?? retailer;
}

export async function getRetailerReceiptSummary(): Promise<RetailerReceiptSummary[]> {
  const userId = getCurrentUserId();
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - RECENT_WEEKS * 7);
  const recentDate = recentCutoff.toISOString().slice(0, 10);

  const yearCutoff = new Date();
  yearCutoff.setDate(yearCutoff.getDate() - YEAR_DAYS);
  const yearDate = yearCutoff.toISOString().slice(0, 10);

  try {
    const { data: recentReceipts } = await supabase
      .from("receipts")
      .select("retailer")
      .eq("user_id", userId)
      .gte("purchase_date", recentDate)
      .not("retailer", "is", null);

    if (!recentReceipts || recentReceipts.length === 0) return [];

    const recentRetailers = new Set(
      recentReceipts.map((r) => r.retailer as string),
    );

    const { data: yearReceipts } = await supabase
      .from("receipts")
      .select("retailer, total_amount")
      .eq("user_id", userId)
      .gte("purchase_date", yearDate)
      .not("retailer", "is", null);

    if (!yearReceipts) return [];

    const byRetailer = new Map<string, { count: number; spent: number }>();
    for (const r of yearReceipts) {
      const name = r.retailer as string;
      if (!recentRetailers.has(name)) continue;
      const entry = byRetailer.get(name) ?? { count: 0, spent: 0 };
      entry.count += 1;
      entry.spent += Number(r.total_amount) || 0;
      byRetailer.set(name, entry);
    }

    const summaries: RetailerReceiptSummary[] = Array.from(
      byRetailer.entries(),
    ).map(([retailer, { count, spent }]) => ({
      retailer,
      displayName: retailerDisplayName(retailer),
      receiptCount: count,
      totalSpent: spent,
      isHomeRetailer: isHomeRetailer(retailer),
    }));

    summaries.sort((a, b) => {
      if (a.isHomeRetailer !== b.isHomeRetailer) return a.isHomeRetailer ? -1 : 1;
      return b.totalSpent - a.totalSpent;
    });

    return summaries;
  } catch (err) {
    log.error("[receipt-purchase-menu] Failed to fetch retailer summary:", err);
    return [];
  }
}

export async function getReceiptProductsByTrip(
  retailer: string,
  mode: ReceiptTripMode,
  n: number,
): Promise<ReceiptProduct[]> {
  const userId = getCurrentUserId();
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const yearCutoff = new Date();
  yearCutoff.setDate(yearCutoff.getDate() - YEAR_DAYS);
  const yearDate = yearCutoff.toISOString().slice(0, 10);

  try {
    const { data: receipts } = await supabase
      .from("receipts")
      .select("receipt_id, purchase_date")
      .eq("user_id", userId)
      .eq("retailer", retailer)
      .gte("purchase_date", yearDate)
      .order("purchase_date", { ascending: false });

    if (!receipts || receipts.length === 0) return [];

    let targetReceiptIds: string[];

    if (mode === "single") {
      if (n >= receipts.length) return [];
      targetReceiptIds = [receipts[n].receipt_id];
    } else if (mode === "combined") {
      const count = Math.min(n, receipts.length);
      targetReceiptIds = receipts.slice(0, count).map((r) => r.receipt_id);
    } else {
      return fetchNotRecentlyBought(supabase, receipts);
    }

    return fetchItemsForReceipts(supabase, targetReceiptIds);
  } catch (err) {
    log.error("[receipt-purchase-menu] Failed to fetch trip products:", err);
    return [];
  }
}

async function fetchItemsForReceipts(
  supabase: ReturnType<typeof createClientIfConfigured> & object,
  receiptIds: string[],
): Promise<ReceiptProduct[]> {
  const { data: items } = await supabase
    .from("receipt_items")
    .select("product_id, receipt_name, quantity")
    .in("receipt_id", receiptIds);

  if (!items) return [];

  const byKey = new Map<string, { productId: string; name: string; freq: number }>();
  for (const item of items) {
    const pid = item.product_id as string | null;
    const name = (item.receipt_name as string) || "";
    const key = pid ?? `name:${name.toLowerCase()}`;
    if (!key || key === "name:") continue;

    const entry = byKey.get(key) ?? { productId: pid ?? "", name, freq: 0 };
    entry.freq += Number(item.quantity) || 1;
    if (pid && !entry.productId) entry.productId = pid;
    if (name && !entry.name) entry.name = name;
    byKey.set(key, entry);
  }

  return Array.from(byKey.values())
    .map((e) => ({
      product_id: e.productId,
      receipt_name: e.name,
      frequency: e.freq,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Products bought in the last year but NOT in the last 4 receipts,
 * filtered to frozen + dry goods only (long-shelf-life items).
 */
async function fetchNotRecentlyBought(
  supabase: ReturnType<typeof createClientIfConfigured> & object,
  sortedReceipts: { receipt_id: string }[],
): Promise<ReceiptProduct[]> {
  const recentCount = Math.min(4, sortedReceipts.length);
  const recentIds = sortedReceipts.slice(0, recentCount).map((r) => r.receipt_id);
  const olderIds = sortedReceipts.slice(recentCount).map((r) => r.receipt_id);
  if (olderIds.length === 0) return [];

  const [recentResult, olderResult] = await Promise.all([
    supabase
      .from("receipt_items")
      .select("product_id")
      .in("receipt_id", recentIds)
      .not("product_id", "is", null),
    supabase
      .from("receipt_items")
      .select("product_id, receipt_name, quantity")
      .in("receipt_id", olderIds)
      .not("product_id", "is", null),
  ]);

  const recentProductIds = new Set(
    (recentResult.data ?? []).map((r) => r.product_id as string),
  );

  const olderItems = olderResult.data ?? [];
  const byProduct = new Map<string, { name: string; freq: number }>();

  for (const item of olderItems) {
    const pid = item.product_id as string;
    if (recentProductIds.has(pid)) continue;

    const entry = byProduct.get(pid) ?? { name: item.receipt_name as string || "", freq: 0 };
    entry.freq += Number(item.quantity) || 1;
    byProduct.set(pid, entry);
  }

  return Array.from(byProduct.entries())
    .map(([product_id, { name, freq }]) => ({
      product_id,
      receipt_name: name,
      frequency: freq,
    }))
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Filter receipt products to frozen + dry categories only.
 * Used client-side for "Produkte, die ich länger nicht gekauft habe".
 */
export function filterToShelfStable(
  items: ReceiptProduct[],
  productMap: Map<string, { demand_group_code: string }>,
): ReceiptProduct[] {
  return items.filter((item) => {
    if (!item.product_id) return true;
    const product = productMap.get(item.product_id);
    const group = getCategoryGroup(product?.demand_group_code);
    return group === "frozen" || group === "dry";
  });
}
