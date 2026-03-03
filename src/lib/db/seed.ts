/**
 * Seed IndexedDB with demand groups, stores, and aggregated aisle order when empty.
 * Call from client (e.g. layout or list page) once on app load.
 */

import { db } from "./indexed-db";
import {
  SEED_DEMAND_GROUPS,
  SEED_STORES,
} from "./seed-data";
import type { AggregatedAisleOrder } from "@/types";

const SEEDED_KEY = "digital-shopping-list-seeded-v1";
const SEEDED_STORES_KEY = "digital-shopping-list-seeded-stores-v1";
const SEEDED_DG_KEY = "digital-shopping-list-seeded-dg-v1";

export async function seedIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  // Seed demand groups (new in BL-62)
  if (localStorage.getItem(SEEDED_DG_KEY) !== "1") {
    const dgCount = await db.demand_groups.count();
    if (dgCount === 0) {
      await db.demand_groups.bulkAdd(SEED_DEMAND_GROUPS as never[]);
    }
    localStorage.setItem(SEEDED_DG_KEY, "1");
  }

  if (localStorage.getItem(SEEDED_STORES_KEY) !== "1") {
    const storeCount = await db.stores.count();
    if (storeCount === 0) {
      await db.stores.bulkAdd(SEED_STORES as never[]);
      const now = new Date().toISOString();
      const aggregated: AggregatedAisleOrder[] = SEED_DEMAND_GROUPS.map(
        (dg) => ({
          demand_group_code: dg.code,
          average_position: dg.sort_position,
          std_deviation: 0,
          contributing_stores: 0,
          last_calculated_at: now,
        })
      );
      await db.aggregated.bulkAdd(aggregated as never[]);
    }
    localStorage.setItem(SEEDED_STORES_KEY, "1");
  }
}
