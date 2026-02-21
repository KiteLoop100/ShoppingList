/**
 * "Letzte Einkäufe": Produkte, die in den letzten 28 Tagen auf die Einkaufsliste gesetzt wurden.
 * Gruppiert nach product_id, sortiert nach Häufigkeit (frequency DESC).
 * Datenquelle: IndexedDB list_items (added_at).
 */

import { db } from "@/lib/db";
import { getDeviceUserId } from "./device-id";

export interface RecentListProduct {
  product_id: string;
  frequency: number;
}

const DAYS = 28;

export async function getRecentListProducts(): Promise<RecentListProduct[]> {
  const user_id = getDeviceUserId();
  const lists = await db.lists.where("user_id").equals(user_id).toArray();
  const listIds = lists.map((l) => l.list_id);
  if (listIds.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  const cutoffIso = cutoff.toISOString();

  const allItems: Array<{ product_id: string }> = [];
  for (const list_id of listIds) {
    const items = await db.list_items.where("list_id").equals(list_id).toArray();
    for (const i of items) {
      if (i.product_id != null && i.added_at >= cutoffIso) {
        allItems.push({ product_id: i.product_id });
      }
    }
  }

  const byProduct = new Map<string, number>();
  for (const { product_id } of allItems) {
    byProduct.set(product_id, (byProduct.get(product_id) ?? 0) + 1);
  }

  const result: RecentListProduct[] = Array.from(byProduct.entries())
    .map(([product_id, frequency]) => ({ product_id, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  return result;
}
