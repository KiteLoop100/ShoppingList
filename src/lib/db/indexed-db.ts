/**
 * Dexie.js IndexedDB schema for offline-first storage.
 * Aligned with ARCHITECTURE.md and OFFLINE-STRATEGY.md.
 *
 * BL-62: Added demand_groups table, migrated aisle_orders + aggregated
 * to use demand_group_code instead of category_id.
 */

import Dexie, { type Table } from "dexie";
import type {
  Product,
  CompetitorProduct,
  DemandGroup,
  Store,
  ListItem,
  AisleOrder,
  AggregatedAisleOrder,
  UserProductPreference,
  OfflineQueueEntry,
  ShoppingList,
  ShoppingTrip,
  TripItem,
  CategoryAlias,
  SortingError,
  PairwiseComparison,
  CheckoffSequence,
} from "@/types";

export interface LocalProduct extends Product {}

export interface LocalDemandGroup extends DemandGroup {
  id?: number;
}

export interface LocalStore extends Store {
  id?: number;
}

export interface LocalListItem extends Omit<ListItem, "item_id"> {
  id?: number;
  item_id: string;
}

export interface LocalAisleOrder extends AisleOrder {
  id?: number;
}

export interface LocalAggregatedAisleOrder extends AggregatedAisleOrder {
  id?: number;
}

export interface LocalUserProductPreference extends UserProductPreference {
  id?: number;
}

export interface LocalShoppingList extends ShoppingList {
  id?: number;
}

export interface LocalShoppingTrip extends ShoppingTrip {
  id?: number;
}

export interface LocalTripItem extends TripItem {
  id?: number;
}

export interface LocalCategoryAlias extends CategoryAlias {
  id?: number;
}

export interface LocalSortingError extends SortingError {
  id?: number;
}

export interface LocalPairwiseComparison extends PairwiseComparison {
  id?: number;
}

export interface LocalCheckoffSequence extends CheckoffSequence {
  id?: number;
}

export interface LocalCompetitorProduct extends CompetitorProduct {
  id?: number;
}

export class AppDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  competitor_products!: Table<LocalCompetitorProduct, number>;
  demand_groups!: Table<LocalDemandGroup, number>;
  category_aliases!: Table<LocalCategoryAlias, number>;
  sorting_errors!: Table<LocalSortingError, number>;
  stores!: Table<LocalStore, number>;
  list_items!: Table<LocalListItem, number>;
  lists!: Table<LocalShoppingList, number>;
  trips!: Table<LocalShoppingTrip, number>;
  trip_items!: Table<LocalTripItem, number>;
  aisle_orders!: Table<LocalAisleOrder, number>;
  aggregated!: Table<LocalAggregatedAisleOrder, number>;
  preferences!: Table<LocalUserProductPreference, number>;
  offline_queue!: Table<OfflineQueueEntry, number>;
  pairwise_comparisons!: Table<LocalPairwiseComparison, number>;
  checkoff_sequences!: Table<LocalCheckoffSequence, number>;

  constructor() {
    super("DigitalShoppingList");
    this.version(1).stores({
      products:
        "++id, product_id, name_normalized, category_id, status, name",
      categories: "++id, category_id, default_sort_position",
      stores:
        "++id, store_id, country, [latitude+longitude], has_sorting_data",
      list_items:
        "++id, item_id, list_id, product_id, category_id, is_checked, sort_position",
      lists: "++id, list_id, user_id, status, store_id",
      aisle_orders: "++id, store_id, category_id, learned_position",
      aggregated: "++id, category_id, average_position",
      preferences: "++id, user_id, product_id, generic_name",
      offline_queue: "++id, action, timestamp",
    });
    this.version(2).stores({
      trips: "++id, trip_id, user_id, completed_at",
      trip_items: "++id, trip_item_id, trip_id",
    });
    this.version(3).stores({
      category_aliases: "++id, alias_id, term_normalized, category_id",
    });
    this.version(4).stores({
      sorting_errors: "++id, error_id, store_id, reported_at",
    });
    this.version(5).stores({
      pairwise_comparisons:
        "++id, store_id, [store_id+level], [store_id+level+scope]",
      checkoff_sequences: "++id, sequence_id, trip_id, store_id",
    });
    this.version(6).stores({
      pairwise_comparisons:
        "++id, store_id, level, [store_id+level], [store_id+level+scope]",
    });
    this.version(7).stores({});
    this.version(8).stores({
      competitor_products: "++id, product_id, name_normalized, ean_barcode, country, status",
    });
    this.version(9).stores({
      products: "product_id, name_normalized, category_id, status, name, country",
    });
    // BL-62: Add demand_groups table; update aisle_orders + aggregated indexes
    this.version(10).stores({
      demand_groups: "++id, code, sort_position",
      products: "product_id, name_normalized, demand_group_code, status, name, country",
      list_items:
        "++id, item_id, list_id, product_id, demand_group_code, is_checked, sort_position",
      aisle_orders: "++id, store_id, demand_group_code, learned_position",
      aggregated: "++id, demand_group_code, average_position",
    });
    // BL-62 Phase 3: Remove legacy categories table
    this.version(11).stores({
      categories: null,
    });
  }
}

export const db = new AppDatabase();
