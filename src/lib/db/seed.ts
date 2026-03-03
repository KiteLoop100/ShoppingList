/**
 * Seed IndexedDB with categories, stores, and aggregated aisle order when empty.
 * Call from client (e.g. layout or list page) once on app load.
 */

import { db } from "./indexed-db";
import {
  SEED_CATEGORIES,
  SEED_STORES,
} from "./seed-data";
import type { AggregatedAisleOrder } from "@/types";

const SEEDED_KEY = "digital-shopping-list-seeded-v1";
const SEEDED_STORES_KEY = "digital-shopping-list-seeded-stores-v1";

export async function seedIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(SEED_CATEGORIES as never[]);
    localStorage.setItem(SEEDED_KEY, "1");
  }

  if (localStorage.getItem(SEEDED_STORES_KEY) !== "1") {
    const storeCount = await db.stores.count();
    if (storeCount === 0) {
      await db.stores.bulkAdd(SEED_STORES as never[]);
      const now = new Date().toISOString();
      const aggregated: AggregatedAisleOrder[] = SEED_CATEGORIES.map(
        (c) => ({
          category_id: c.category_id,
          average_position: c.default_sort_position,
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
