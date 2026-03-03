/**
 * F05: Demand-group order for list sorting.
 * Layer 1 = store AisleOrder (learned_position per demand_group_code),
 * Layer 2 = AggregatedAisleOrder (average across stores),
 * Layer 3 = demand_groups.sort_position (static default).
 */

import { db } from "@/lib/db";

/** Returns map of demand_group_code -> sort position (lower = earlier in list). */
export async function getDemandGroupOrderForList(
  storeId: string | null
): Promise<Map<string, number>> {
  const demandGroups = await db.demand_groups.toArray();
  const defaultOrder = new Map<string, number>(
    demandGroups.map((dg) => [dg.code, dg.sort_position ?? 999])
  );

  if (storeId) {
    const storeOrders = await db.aisle_orders
      .where("store_id")
      .equals(storeId)
      .toArray();
    if (storeOrders.length > 0) {
      const map = new Map<string, number>();
      for (const o of storeOrders) {
        map.set(o.demand_group_code, o.learned_position);
      }
      for (const dg of demandGroups) {
        if (!map.has(dg.code))
          map.set(dg.code, defaultOrder.get(dg.code) ?? 999);
      }
      return map;
    }
  }

  const aggregated = await db.aggregated.toArray();
  if (aggregated.length > 0) {
    const map = new Map<string, number>();
    for (const a of aggregated) {
      map.set(a.demand_group_code, a.average_position);
    }
    for (const dg of demandGroups) {
      if (!map.has(dg.code))
        map.set(dg.code, defaultOrder.get(dg.code) ?? 999);
    }
    return map;
  }

  return defaultOrder;
}

/**
 * @deprecated Use getDemandGroupOrderForList. Alias for backward compatibility.
 */
export const getCategoryOrderForList = getDemandGroupOrderForList;
