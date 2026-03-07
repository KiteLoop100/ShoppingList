/**
 * Shared TypeScript types derived from DATA-MODEL.md.
 * Used by both IndexedDB (Dexie) and Supabase/API layer.
 */

export type Locale = "de" | "en";
export type SortMode = "my-order" | "shopping-order" | "shopping-order-tiles";

export type AssortmentType = "daily_range" | "special" | "special_food" | "special_nonfood";
export type ProductSource = "admin" | "crowdsourcing";
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
  demand_group_code: string;
  price: number | null;
  price_updated_at: string | null;
  popularity_score?: number | null;
  assortment_type: AssortmentType;
  availability: "national" | "regional" | "seasonal";
  region: string | null;
  country: string;
  special_start_date: string | null;
  special_end_date: string | null;
  status: "active" | "inactive";
  source: ProductSource;
  created_at: string;
  updated_at: string;
  /** F13: URL of the cut-out product image (front side) */
  thumbnail_url?: string | null;
  /** F13: URL of back-side thumbnail (e.g. nutrition info), only shown in detail view */
  thumbnail_back_url?: string | null;
  /** F13: Reference to photo_uploads.upload_id */
  photo_source_id?: string | null;
  /** F13: Nutrition data (JSON from back-side photo or Open Food Facts) */
  nutrition_info?: Record<string, unknown> | null;
  /** F13: Ingredients */
  ingredients?: string | null;
  /** F13: Allergens */
  allergens?: string | null;
  /** Weight/quantity (e.g. "500 g", "1 kg") */
  weight_or_quantity?: string | null;
  /** true = ALDI/Hofer private label (Milsani, Lacura, …); false = external brand; null = unknown */
  is_private_label?: boolean | null;
  /** true = seasonal product (asparagus, strawberries, gingerbread, …) that returns yearly */
  is_seasonal?: boolean | null;
  /** true = certified organic / Bio product */
  is_bio?: boolean | null;
  /** true = vegan product (no animal ingredients) */
  is_vegan?: boolean | null;
  /** true = gluten-free product */
  is_gluten_free?: boolean | null;
  /** true = lactose-free product */
  is_lactose_free?: boolean | null;
  /** German "Haltungsform" level: 1=Stall, 2=StallPlus, 3=Außenklima, 4=Premium/Bio; null=unknown or N/A */
  animal_welfare_level?: number | null;
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
  /** True when periodic GPS polling has confirmed the user is near a store. */
  gps_confirmed_in_store?: boolean;
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
  demand_group_code: string;
  added_at: string;
  updated_at?: string;
  deferred_until?: string | null;
  buy_elsewhere_retailer?: string | null;
  competitor_product_id?: string | null;
  comment?: string | null;
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
  demand_group_code: string;
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
  demand_group_code: string;
  learned_position: number;
  confidence: number;
  data_points: number;
  last_updated_at: string;
}

export type PairwiseLevel = "group" | "subgroup" | "product";

export interface PairwiseComparison {
  id?: number;
  store_id: string;
  level: PairwiseLevel;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b_count: number;
  b_before_a_count: number;
  last_updated_at: string;
}

export interface CheckoffSequenceItem {
  item_id: string;
  demand_group_code: string;
  checked_at: string;
  demand_group?: string | null;
  /** Demand sub-group (from product) for pairwise extraction. */
  demand_sub_group?: string | null;
  /** product_id for product-level pairwise. */
  product_id?: string | null;
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
  demand_group_code: string;
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

export interface DemandGroup {
  code: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  color: string | null;
  sort_position: number;
  parent_group?: string | null;
}

export type OfflineQueueAction = "add" | "update" | "delete";

export interface OfflineQueueEntry {
  id?: number;
  action: OfflineQueueAction;
  entity: string;
  payload: unknown;
  timestamp: string;
}

/** B4: Product from a competitor retailer (LIDL, REWE, EDEKA, etc.). Separate from ALDI products. */
export interface CompetitorProduct {
  product_id: string;
  name: string;
  name_normalized: string;
  brand: string | null;
  ean_barcode: string | null;
  article_number: string | null;
  weight_or_quantity: string | null;
  country: string;
  /** Primary retailer (e.g. "EDEKA"). Makes the product discoverable in retailer search even without a price observation. */
  retailer: string | null;
  thumbnail_url: string | null;
  other_photo_url: string | null;
  category_id: string | null;
  demand_group_code: string | null;
  demand_sub_group: string | null;
  assortment_type: string | null;
  status: "active" | "inactive";
  is_bio: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_lactose_free: boolean;
  animal_welfare_level: number | null;
  ingredients: string | null;
  nutrition_info: Record<string, unknown> | null;
  allergens: string | null;
  nutri_score: "A" | "B" | "C" | "D" | "E" | null;
  country_of_origin: string | null;
  created_at: string;
  updated_at: string;
  /** Latest known price per retailer (populated when fetched with prices joined). */
  latest_prices?: { retailer: string; price: number }[];
}

/** B4: Price observation for a competitor product at a specific retailer. Append-only for price history. */
export interface CompetitorProductPrice {
  price_id: string;
  product_id: string;
  retailer: string;
  price: number;
  observed_at: string;
}

/** Search module output (F02). */
export type SearchResultSource = "favorite" | "popular" | "other";

export interface SearchResult {
  product_id: string;
  name: string;
  demand_group_code: string;
  demand_group_name: string;
  price: number | null;
  score: number;
  source: SearchResultSource;
  /** Product thumbnail for search suggestion display */
  thumbnail_url?: string | null;
  /** Full product data, available for local search results */
  product?: Product;
}
