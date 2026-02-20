/**
 * Shared TypeScript types derived from DATA-MODEL.md.
 * Used by both IndexedDB (Dexie) and Supabase/API layer.
 */

export type Locale = "de" | "en";

export type AssortmentType = "daily_range" | "special";
export type ProductSource = "admin" | "crowdsourcing";
export type CrowdsourceStatus = "pending" | "approved" | "rejected";
export type ListStatus = "active" | "completed";
export type SortingErrorStatus = "open" | "investigated" | "resolved";

export interface User {
  user_id: string;
  device_id: string;
  email: string | null;
  is_registered: boolean;
  preferred_language: Locale;
  default_store_id: string | null;
  created_at: string;
  last_active_at: string;
}

export interface Category {
  category_id: string;
  name: string;
  name_translations: Record<string, string>;
  icon: string;
  default_sort_position: number;
}

export interface Product {
  product_id: string;
  article_number?: string | null;
  ean_barcode?: string | null;
  name: string;
  name_normalized: string;
  brand: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
  category_id: string;
  price: number | null;
  price_updated_at: string | null;
  popularity_score?: number | null;
  assortment_type: AssortmentType;
  availability: "national" | "regional";
  region: string | null;
  country: string;
  special_start_date: string | null;
  special_end_date: string | null;
  status: "active" | "inactive";
  source: ProductSource;
  crowdsource_status: CrowdsourceStatus | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  store_id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  has_sorting_data: boolean;
  sorting_data_quality: number;
  created_at: string;
  updated_at: string;
}

export interface ShoppingList {
  list_id: string;
  user_id: string;
  store_id: string | null;
  status: ListStatus;
  created_at: string;
  completed_at: string | null;
}

export interface ListItem {
  item_id: string;
  list_id: string;
  product_id: string | null;
  custom_name: string | null;
  display_name: string;
  quantity: number;
  is_checked: boolean;
  checked_at: string | null;
  sort_position: number;
  category_id: string;
  added_at: string;
  updated_at?: string;
}

export interface ShoppingTrip {
  trip_id: string;
  user_id: string;
  store_id: string | null;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  total_items: number;
  estimated_total_price: number | null;
  sorting_errors_reported: number;
  created_at: string;
}

export interface TripItem {
  trip_item_id: string;
  trip_id: string;
  product_id: string | null;
  custom_name: string | null;
  display_name: string;
  quantity: number;
  price_at_purchase: number | null;
  category_id: string;
  check_position: number;
  checked_at: string;
  was_removed: boolean;
}

export interface UserProductPreference {
  user_id: string;
  product_id: string | null;
  generic_name: string | null;
  purchase_count: number;
  last_purchased_at: string;
}

export interface AisleOrder {
  store_id: string;
  category_id: string;
  learned_position: number;
  confidence: number;
  data_points: number;
  last_updated_at: string;
}

export interface CheckoffSequenceItem {
  item_id: string;
  category_id: string;
  checked_at: string;
}

export interface CheckoffSequence {
  sequence_id: string;
  trip_id: string;
  store_id: string;
  user_id: string;
  is_valid: boolean;
  items: CheckoffSequenceItem[];
  created_at: string;
}

export interface SortingError {
  error_id: string;
  user_id: string;
  store_id: string;
  trip_id: string | null;
  current_sort_order: unknown;
  reported_at: string;
  status: SortingErrorStatus;
}

export interface AggregatedAisleOrder {
  category_id: string;
  average_position: number;
  std_deviation: number;
  contributing_stores: number;
  last_calculated_at: string;
}

/** Category alias (DATA-MODEL 6b): maps terms/brands to category_id for automatic assignment. */
export type CategoryAliasSource = "manual" | "ai" | "crowdsourcing";

export interface CategoryAlias {
  alias_id: string;
  term_normalized: string;
  category_id: string;
  source: CategoryAliasSource;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export type OfflineQueueAction = "add" | "update" | "delete";

export interface OfflineQueueEntry {
  id?: number;
  action: OfflineQueueAction;
  entity: string;
  payload: unknown;
  timestamp: string;
}

/** Crowdsourcing: product suggestion waiting for admin approval. */
export interface ProductSuggestion {
  suggestion_id: string;
  name: string;
  name_normalized: string;
  category_id: string;
  price: number | null;
  status: CrowdsourceStatus;
  created_at: string;
}

/** Search module output (F02). */
export type SearchResultSource = "favorite" | "popular" | "other";

export interface SearchResult {
  product_id: string;
  name: string;
  category_id: string;
  category_name: string;
  price: number | null;
  score: number;
  source: SearchResultSource;
}
