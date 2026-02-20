/**
 * Seed IndexedDB with categories, products, stores, category_aliases and aggregated aisle order when empty.
 * Call from client (e.g. layout or list page) once on app load.
 */

import { db } from "./indexed-db";
import {
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_STORES,
} from "./seed-data";
import { SEED_CATEGORY_ALIAS_ENTRIES } from "./seed-category-aliases";
import type { AggregatedAisleOrder, CategoryAlias } from "@/types";

const SEEDED_KEY = "digital-shopping-list-seeded-v1";
const SEEDED_STORES_KEY = "digital-shopping-list-seeded-stores-v1";
const SEEDED_ALIASES_KEY = "digital-shopping-list-seeded-aliases-v1";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "alias-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export async function seedIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;

  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(SEED_CATEGORIES as never[]);
    await db.products.bulkAdd(SEED_PRODUCTS as never[]);
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

  if (localStorage.getItem(SEEDED_ALIASES_KEY) !== "1") {
    const aliasCount = await db.category_aliases.count();
    if (aliasCount === 0) {
      const seen = new Set<string>();
      const now = new Date().toISOString();
      const aliases: CategoryAlias[] = [];
      for (const e of SEED_CATEGORY_ALIAS_ENTRIES) {
        if (seen.has(e.term_normalized)) continue;
        seen.add(e.term_normalized);
        aliases.push({
          alias_id: generateId(),
          term_normalized: e.term_normalized,
          category_id: e.category_id,
          source: "manual",
          confidence: 1,
          created_at: now,
          updated_at: now,
        });
      }
      await db.category_aliases.bulkAdd(aliases as never[]);
    }
    localStorage.setItem(SEEDED_ALIASES_KEY, "1");
  }
}
