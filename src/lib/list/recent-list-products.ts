/**
 * "Letzte Einkäufe": products purchased in the last 28 days.
 * Grouped by product_id, sorted by frequency (DESC).
 * Data source: Supabase receipt_items (products from scanned receipts).
 */

import { getCurrentUserId } from "@/lib/auth/auth-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { log } from "@/lib/utils/logger";

export interface RecentListProduct {
  product_id: string;
  frequency: number;
}

const DAYS = 28;

export async function getRecentListProducts(): Promise<RecentListProduct[]> {
  const userId = getCurrentUserId();
  const byProduct = new Map<string, number>();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);

  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  try {
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const { data: recentReceipts } = await supabase
      .from("receipts")
      .select("receipt_id")
      .eq("user_id", userId)
      .gte("purchase_date", cutoffDate);

    if (recentReceipts && recentReceipts.length > 0) {
      const receiptIds = recentReceipts.map((r) => r.receipt_id);

      const { data: receiptItems } = await supabase
        .from("receipt_items")
        .select("product_id, quantity")
        .in("receipt_id", receiptIds)
        .not("product_id", "is", null);

      if (receiptItems) {
        for (const ri of receiptItems) {
          if (ri.product_id) {
            byProduct.set(
              ri.product_id,
              (byProduct.get(ri.product_id) ?? 0) + (ri.quantity || 1)
            );
          }
        }
      }
    }
  } catch (err) {
    log.error("[recent-list-products] Failed to fetch receipt products:", err);
  }

  const result: RecentListProduct[] = Array.from(byProduct.entries())
    .map(([product_id, frequency]) => ({ product_id, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  return result;
}
