/**
 * F05: Category order for list sorting. Layer 1 = store AisleOrder, Layer 2 = AggregatedAisleOrder, Layer 3 = Category.default_sort_position.
 * For unknown stores use average of all stores (Layer 2) as fallback; if no aggregated data use Layer 3.
 */

import { db } from "@/lib/db";
import type { LocalCategory } from "@/lib/db";

/** Returns map of category_id -> sort position (lower = earlier in list). */
export async function getCategoryOrderForList(
  storeId: string | null
): Promise<Map<string, number>> {
  const categories = await db.categories.toArray();
  const defaultOrder = new Map<string, number>(
    categories.map((c) => [c.category_id, c.default_sort_position ?? 999])
  );

  if (storeId) {
    const storeOrders = await db.aisle_orders
      .where("store_id")
      .equals(storeId)
      .toArray();
    if (storeOrders.length > 0) {
      const map = new Map<string, number>();
      for (const o of storeOrders) {
        map.set(o.category_id, o.learned_position);
      }
      // Merge with defaults for any category not in store orders
      for (const c of categories) {
        if (!map.has(c.category_id))
          map.set(c.category_id, defaultOrder.get(c.category_id) ?? 999);
      }
      return map;
    }
  }

  // Layer 2: aggregated (average of all stores) as fallback for unknown store or no store data
  const aggregated = await db.aggregated.toArray();
  if (aggregated.length > 0) {
    const map = new Map<string, number>();
    for (const a of aggregated) {
      map.set(a.category_id, a.average_position);
    }
    for (const c of categories) {
      if (!map.has(c.category_id))
        map.set(c.category_id, defaultOrder.get(c.category_id) ?? 999);
    }
    return map;
  }

  return defaultOrder;
}
