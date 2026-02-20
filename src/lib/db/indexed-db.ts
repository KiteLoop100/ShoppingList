/**
 * Dexie.js IndexedDB schema for offline-first storage.
 * Aligned with ARCHITECTURE.md and OFFLINE-STRATEGY.md.
 */

import Dexie, { type Table } from "dexie";
import type {
  Product,
  Category,
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
  ProductSuggestion,
  SortingError,
} from "@/types";

export interface LocalProduct extends Product {
  id?: number;
}

export interface LocalCategory extends Category {
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

export interface LocalProductSuggestion extends ProductSuggestion {
  id?: number;
}

export interface LocalSortingError extends SortingError {
  id?: number;
}

export class AppDatabase extends Dexie {
  products!: Table<LocalProduct, number>;
  categories!: Table<LocalCategory, number>;
  category_aliases!: Table<LocalCategoryAlias, number>;
  product_suggestions!: Table<LocalProductSuggestion, number>;
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
      product_suggestions: "++id, suggestion_id, status",
      sorting_errors: "++id, error_id, store_id, reported_at",
    });
  }
}

export const db = new AppDatabase();
