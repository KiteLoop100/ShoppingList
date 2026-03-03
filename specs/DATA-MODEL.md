# DATA-MODEL.md – Data Model

> Describes all data structures of the app.
> Written as content descriptions – the AI agent translates them into technical database structures.
> For feature context see FEATURES-CORE.md, FEATURES-CAPTURE.md, FEATURES-FLYER.md.

---

## 1. Object Overview

```
User
  └── has one active ShoppingList
  │     └── contains ListItems
  │           └── optionally references a Product
  └── has ShoppingTrips (history)
  │     └── contains TripItems
  └── has Receipts (scanned receipts)
  │     └── contains ReceiptItems
  │           └── optionally references a Product
  └── has UserProductPreferences

Product (ALDI)
  └── belongs to a Demand Group (via demand_group_code FK)
  └── has optional price
  └── has assortment type (daily range / special)

CompetitorProduct (other retailers)
  └── belongs to a Category (optional)
  └── has CompetitorProductPrices (append-only price history per retailer)
  └── has CompetitorProductStats (purchase frequency per user per retailer)
  └── optionally linked from ListItem via competitor_product_id

Store
  └── has address and GPS coordinates
  └── has AisleOrder data

Learning Algorithm Data
  └── CheckoffSequences
  └── PairwiseComparisons
  └── SortingErrors
  └── AggregatedAisleOrder
```

---

## 2. User

Managed by **Supabase Auth** (`auth.users`). The custom `users` table exists in the DB but is **not used** by the app (FK constraints removed in migration `20260226000000_auth_account_migration.sql`). All tables use `user_id TEXT` which stores `auth.uid()` as a UUID string.

| Field | Description |
|-------|-------------|
| user_id | `auth.uid()` — UUID string from Supabase Auth. Used as TEXT in all tables. |
| device_id | *(deprecated)* Old device ID from localStorage. Only used during one-time migration. |
| email | Email address (null for anonymous users, set after registration) |
| is_registered | Whether user has a registered email/password (vs anonymous) |
| preferred_language | Language setting (de / en) — stored in localStorage |
| default_store_id | Default store (optional, set in settings) — stored in localStorage |

> **Note:** The `users` table in Supabase is not actively written to. Auth is handled by `auth.users`. The `user_id` column in `shopping_lists`, `shopping_trips`, `user_product_preferences`, `checkoff_sequences`, `sorting_errors`, `receipts`, and `auto_reorder_settings` is now `TEXT` (not UUID with FK). This was changed in migration `20260226000000_auth_account_migration.sql`.

---

## 3. Shopping List (ShoppingList)

Each user has exactly one active shopping list. No multi-list support in MVP.

| Field | Description |
|-------|-------------|
| list_id | Unique ID |
| user_id | Owner |
| store_id | Currently assigned store (null if none detected/selected) |
| status | active / completed |
| created_at | Creation timestamp |
| completed_at | Completion timestamp (when last product checked off) |

---

## 4. List Item (ListItem)

A single product on the shopping list.

| Field | Description |
|-------|-------------|
| item_id | Unique ID |
| list_id | Parent shopping list |
| product_id | Reference to product in DB (null for generic entries) |
| custom_name | Free-text product name (for generic entries, e.g. "Milk") |
| display_name | Displayed name: product name from DB or custom_name |
| quantity | Quantity (integer, default: 1) |
| is_checked | Checked off yes/no |
| checked_at | Check-off timestamp (important for learning algorithm) |
| sort_position | Current position in sorted list |
| demand_group_code | Demand group code (FK to demand_groups). From product or Claude API assignment. |
| category_id | *(DB-only)* Legacy column kept in Supabase. Not used by frontend. Will be dropped in Phase 4. |
| added_at | Timestamp when added |
| buy_elsewhere_retailer | Retailer name for "buy elsewhere" items (NULL for ALDI items) |
| competitor_product_id | FK to competitor_products (NULL for ALDI items) |

### Logic
- product_id set → specific ALDI entry (price, category etc. from product DB)
- product_id null → generic entry (custom_name displayed, category assigned algorithmically)
- buy_elsewhere_retailer set → item is for another retailer, modeled as deferred with `deferred_reason="elsewhere"`
- competitor_product_id set → item linked to a competitor product (never set simultaneously with product_id)

---

## 5. Product

An ALDI SÜD product.

### Assortment Structure
- **Daily range:** ~2,500 year-round products. Including sorted boxes (e.g. different spices with same product number), actual count is ~**3,500 products**
- **Specials:** ~6,000 new specials per year, time-limited. Grouped together in one store area
- **Active products at any time:** ~**4,000** (3,500 daily + current specials)
- **Historical products:** Expired specials remain in DB (status = inactive), not shown in search

| Field | Description |
|-------|-------------|
| product_id | Unique ID |
| article_number | Internal ALDI article number. Auto-normalized by PG trigger (strips non-digits + leading zeros). ALDI uses 6-digit base numbers and 9-digit variant numbers (base + 3-digit suffix, e.g. "100124001"). Indexed (`idx_products_article_number`). |
| ean_barcode | EAN/barcode number (for barcode scanner) |
| name | Product name (e.g. "Low-Fat Milk 1.5% 1L") |
| name_normalized | Normalized name for search and duplicate detection (lowercase, no special chars) |
| brand | Brand/private label (e.g. "Milsani", "GutBio"). Empty for generic products |
| demand_group_code | FK to demand_groups(code). Primary category key used for sorting and grouping. |
| demand_group | Customer Demand Group text field (e.g. "Dairy", "Fruits & Vegetables"). Legacy, see demand_group_code. |
| demand_sub_group | Customer Demand Sub-Group (e.g. "White Line", "Stone Fruit") |
| category_id | *(DB-only)* Legacy column. Not used by frontend, will be dropped in Phase 4. |
| price | Current price in EUR (optional) |
| price_updated_at | Last price update timestamp |
| weight_or_quantity | Weight or quantity description (e.g. "500g", "1L", "6 pieces") |
| popularity_score | Sales volume or popularity score (optional, for search ranking) |
| assortment_type | daily_range / special / special_food / special_nonfood |
| is_private_label | BOOLEAN – true = ALDI/Hofer private label (Milsani, Lacura, …), false = external brand, NULL = unknown |
| is_seasonal | BOOLEAN DEFAULT false – true = seasonal product returning yearly (asparagus, strawberries, gingerbread, …) |
| is_bio | BOOLEAN DEFAULT false – certified organic / Bio product |
| is_vegan | BOOLEAN DEFAULT false – vegan product (no animal ingredients) |
| is_gluten_free | BOOLEAN DEFAULT false – gluten-free product |
| is_lactose_free | BOOLEAN DEFAULT false – lactose-free product |
| animal_welfare_level | INTEGER DEFAULT NULL – German "Haltungsform": 1=Stall, 2=StallPlus, 3=Außenklima, 4=Premium/Bio; NULL=unknown/N/A |
| availability | national / regional |
| region | Region identifier (only if availability = regional) |
| special_start_date | Special start date (specials only) |
| special_end_date | Special end date (specials only) |
| status | active / inactive |
| source | admin / crowdsourcing / import |
| thumbnail_url | URL of cropped product image in Supabase Storage (150x150px) |
| photo_source_id | Reference to photo_uploads.upload_id |
| nutrition_info | JSON with nutritional values |
| ingredients | Ingredients as text |
| allergens | Allergens as text |
| flyer_id | Reference to flyers table (which flyer) – optional |
| flyer_page | Page number in flyer (for product-to-page mapping) |
| created_at | Creation date |
| updated_at | Last update |

### Status Logic
- **active:** Currently available, shown in search
- **inactive:** No longer available. NOT shown in search, remains in DB for history
- Specials auto-set to inactive when special_end_date is passed

### Article Number Normalization
A PG trigger (`products_normalize_article_number`) automatically normalizes `article_number` on every INSERT/UPDATE: removes non-digit characters, strips leading zeros. This ensures consistent matching regardless of import source format. The corresponding TypeScript function is `normalizeArticleNumber()` in `src/lib/products/normalize.ts`.

### Duplicate Detection
Priority: article_number → ean_barcode → name_normalized similarity

### Receipt Matching
Receipts use a dedicated matching path (`findProductByArticleNumber`): exact article_number match first, then prefix match (receipt shows 6-digit base, DB may have 9-digit base+variant). Name-based matching is not used for receipts (receipt abbreviations like "MILS.FETT.MI" cannot match full product names).

---

## 6. Category (LEGACY – being replaced by Demand Groups)

> **Migration note:** The `categories` table (~20 app-level EN categories like "Dairy", "Bakery") is being replaced by `demand_groups` (~61 ALDI commodity group codes). The old table and all `category_id` FK columns remain in place during the transition and will be dropped after the frontend is fully migrated. See section 6c for the new system.

Product categories for sorting and grouping.

| Field | Description |
|-------|-------------|
| category_id | Unique ID |
| name | Category name (e.g. "Fruits & Vegetables") |
| name_translations | Translations (de, en, ...) |
| icon | Icon or emoji |
| default_sort_position | Default sort position (for category-based pre-sorting without store data) |

---

## 6b. Category Alias (CategoryAlias) (LEGACY)

Maps terms, brand names and colloquial expressions to categories. Core of automatic category assignment.

| Field | Description |
|-------|-------------|
| alias_id | Unique ID |
| term_normalized | Normalized search term (lowercase, no special chars) |
| category_id | Assigned category |
| source | manual / ai / crowdsourcing |
| confidence | Assignment confidence (1.0 = manual/certain, 0.8 = AI) |
| created_at | Creation date |
| updated_at | Last update |

---

## 6c. Demand Group (NEW – replaces Category)

ALDI commodity group codes (~61 groups). Each product belongs to exactly one demand group, identified by a short numeric code (e.g. "83" for Milch/Sahne/Butter). The code "AK" is used for promotional items (Aktionsartikel).

| Field | Description |
|-------|-------------|
| code | TEXT PRIMARY KEY – short code (e.g. "01", "83", "AK") |
| name | German display name (e.g. "Milch/Sahne/Butter") |
| name_en | English translation (e.g. "Milk / Cream / Butter") |
| icon | Emoji icon for UI (e.g. "🥛") |
| color | Hex color for visual coding in UI (e.g. "#2196F3") |
| sort_position | Default display order (1–61) |
| parent_group | Optional FK to demand_groups(code) for future hierarchy |
| created_at | Creation timestamp |

### Demand Group families (color-coded):
- **Bakery** (amber): 56 Bake-Off, 57 Brot/Kuchen, 89 Backartikel
- **Fruits & Vegetables** (green): 38 Gemüse, 58 Obst, 88 Salate
- **Fresh Meat** (red): 62 Frischfleisch, 64 Fisch, 67 Geflügel, 68 Schweinefleisch
- **Chilled Meat/Sausage** (burgundy): 49 Dauerwurst, 69 Wurstwaren, 70 Fertigfleisch, 82 Konserven
- **Chilled Convenience** (teal): 71–74
- **Dairy** (blue): 50 H-Milch, 51 Joghurt, 60 Margarine, 83 Milch/Sahne/Butter, 84 Käse
- **Pantry** (brown): 47 Konserven, 48 Fertiggerichte, 52–54, 90 Cerealien
- **Coffee/Tea** (dark brown): 45, 46
- **Beverages non-alc** (blue): 05, 79–81
- **Beverages alc** (green/wine): 01–04
- **Snacking** (orange): 40–44, 86, 87
- **Frozen** (steel blue): 75–78
- **Health/Beauty/Baby** (pink): 07–09, 13
- **Household** (slate): 06, 10, 11, 25, 85
- **Promotional** (ALDI blue): AK

---

## 6d. Demand Sub Group

Sub-groups within a demand group. Used for fine-grained sorting within a demand group section of the store.

| Field | Description |
|-------|-------------|
| code | TEXT PRIMARY KEY – composite code (e.g. "83-02" for Milch within Milch/Sahne/Butter) |
| name | German display name (e.g. "Milch") |
| name_en | English translation (optional) |
| demand_group_code | FK to demand_groups(code) |
| sort_position | Sort order within the parent demand group |

---

## 6e. Migration Strategy: categories → demand_groups

1. **Phase 1 (DB – DONE):** Create `demand_groups` and `demand_sub_groups` tables with seed data. Add `demand_group_code` column to `products`, populated from the existing `demand_group` text field. Migration: `20260303120000_demand_groups_schema.sql`.
2. **Phase 2 (Backend – DONE):** Updated sorting logic, category assignment API, and all backend queries to use `demand_group_code` instead of `category_id`. Added `demand_group_code` to `list_items` and `trip_items` (migration `20260303130000_bl62_demand_group_code_on_items.sql`). Updated IndexedDB schema (version 10) with `demand_groups` table. All type interfaces (`Product`, `ListItem`, `TripItem`, `AisleOrder`, `AggregatedAisleOrder`, `CheckoffSequenceItem`) now use `demand_group_code` as primary key. `sortAndGroupItems()` and `sortAndGroupItemsHierarchical()` merged into a unified sort function. `SEED_CATEGORIES` replaced by `SEED_DEMAND_GROUPS` (61 entries). Branch: `feature/bl62-backend`.
3. **Phase 3 (Frontend – DONE):** All UI components, API routes, and services migrated to use `demand_group_code` exclusively. Removed deprecated code: `SEED_CATEGORIES`, `assignCategory()` wrapper, `getCategoryOrderForList()` alias, `sortAndGroupItemsHierarchical()` alias, `fetchCategoriesFromSupabase()`, `getCachedCategories()`, `loadCategories()`, `buildCategoryListPrompt()`, `translateCategoryName()`, `getDefaultCategoryId()`, `getAktionsartikelCategoryId()`. Removed `category_id` from all TypeScript interfaces (`Product`, `ListItem`, `TripItem`, `AisleOrder`, `CheckoffSequenceItem`, `AggregatedAisleOrder`, `SearchResult`). IndexedDB `categories` table dropped (Dexie v11). `CompetitorProduct.category_id` kept as-is (separate retailer system). `category_aliases` table and `CategoryAlias.category_id` kept (now stores demand group codes). Branch: `feature/bl62-frontend`.
4. **Phase 4 (Cleanup):** Drop `categories` Supabase table, `category_aliases` table (or migrate `category_id` column to `demand_group_code`), and all `category_id` DB columns. Remove `products.demand_group` text column (replaced by the normalized `demand_group_code` FK).

---

## 7. Store

An ALDI SÜD store location.

| Field | Description |
|-------|-------------|
| store_id | Unique ID |
| name | Display name (e.g. "ALDI SÜD Musterstraße 12") |
| address | Full address |
| city | City |
| postal_code | Postal code |
| country | Country (DE / AT in MVP) |
| latitude | GPS latitude |
| longitude | GPS longitude |
| has_sorting_data | Whether aisle order data exists for this store |
| sorting_data_quality | Quality indicator: number of trips that contributed to aisle order |
| created_at | Creation date |
| updated_at | Last update |

---

## 8. Shopping Trip

A completed shopping trip. Created when last product is checked off.

| Field | Description |
|-------|-------------|
| trip_id | Unique ID |
| user_id | Owner |
| store_id | Store where shopping took place (can be null) |
| started_at | First check-off timestamp |
| completed_at | Last check-off timestamp |
| duration_seconds | Shopping duration in seconds |
| total_items | Number of products |
| estimated_total_price | Estimated total price at time of shopping |
| sorting_errors_reported | Number of sorting errors reported during this trip |
| created_at | Creation date |

---

## 9. Trip Item

A single product within a completed shopping trip (archived copy of ListItem).

| Field | Description |
|-------|-------------|
| trip_item_id | Unique ID |
| trip_id | Parent trip |
| product_id | Product reference (null if generic) |
| custom_name | Free-text name (if generic) |
| display_name | Displayed name |
| quantity | Quantity |
| price_at_purchase | Price at time of purchase (if known) |
| demand_group_code | Demand group code (FK to demand_groups) |
| category_id | *(DB-only)* Legacy column. Not used by frontend, will be dropped in Phase 4. |
| check_position | Check-off order (1, 2, 3, ...) |
| checked_at | Check-off timestamp |
| was_removed | Was product swiped away instead of checked off |

---

## 10. User Product Preference

Tracks how often a user buys a specific product. Basis for personalized search ranking.

| Field | Description |
|-------|-------------|
| user_id | User |
| product_id | Product (null for generic entries) |
| generic_name | Normalized generic name (e.g. "milk") |
| purchase_count | How often this product was on the list |
| last_purchased_at | Last purchase date |

---

## 10a. Competitor Product (F26/B4)

A product from a competing retailer (LIDL, REWE, EDEKA, etc.). Completely separate from ALDI `products` table.

| Field | Description |
|-------|-------------|
| product_id | UUID primary key |
| name | Product name |
| name_normalized | Lowercase normalized name for dedup/search |
| brand | Brand (optional) |
| ean_barcode | EAN barcode (optional) |
| article_number | Retailer-specific article number (optional) |
| weight_or_quantity | Weight or quantity (optional) |
| country | Country code (DE, AT) for download filtering |
| thumbnail_url | Public URL to product photo |
| category_id | Optional FK to categories |
| status | "active" or "inactive" |
| created_at | Creation timestamp |
| created_by | User who created it |

## 10b. Competitor Product Price (F26/B4)

Append-only price history for competitor products. One row per price observation.

| Field | Description |
|-------|-------------|
| price_id | UUID primary key |
| product_id | FK to competitor_products |
| retailer | Retailer name (e.g. "LIDL", "REWE") |
| price | Observed price |
| observed_at | Timestamp of observation |
| observed_by | User who observed it |

Current price = latest row per (product_id, retailer).

## 10c. Competitor Product Stats (Retailer Search Ranking)

Purchase frequency tracking for competitor products. Used to rank retailer product search results by personal and global purchase frequency.

| Field | Description |
|-------|-------------|
| competitor_product_id | FK to competitor_products (part of composite PK) |
| retailer | Retailer name, e.g. "Rossmann" (part of composite PK) |
| user_id | FK to auth.users (part of composite PK) |
| purchase_count | Number of times this product was checked off at this retailer by this user |
| last_purchased_at | Timestamp of most recent check-off |

PK: (competitor_product_id, retailer, user_id). Upserted when an elsewhere item with `competitor_product_id` is checked off (fire-and-forget).

**RPC: `search_retailer_products(p_retailer, p_country, p_user_id, p_query, p_limit)`**
Returns competitor products for a retailer, ranked by user purchase count DESC, global count DESC, name ASC. Joins `competitor_products` with `competitor_product_stats` and `competitor_product_prices`. Optional text filter on `name_normalized` and `brand`.

---

## 11. Aisle Order

Learned demand-group order for a specific store.

| Field | Description |
|-------|-------------|
| store_id | Store |
| demand_group_code | Demand group code (FK to demand_groups) |
| learned_position | Learned position in store (1 = first, ascending) |
| confidence | Confidence value (0.0 to 1.0) |
| data_points | Number of trips contributing to this calculation |
| last_updated_at | Last update |

---

## 12. Checkoff Sequence

Raw data: order in which a user checked off products. Core input for the learning algorithm.

| Field | Description |
|-------|-------------|
| sequence_id | Unique ID |
| trip_id | Parent trip |
| store_id | Store |
| user_id | User |
| is_valid | Whether this sequence is usable for learning (see validation) |
| items | Ordered list of checked-off products with timestamp and category |
| created_at | Creation date |

### Validation
- **Valid:** User checks off products during shopping (varying time gaps)
- **Invalid:** User checks off everything after shopping (all within 30 seconds)
- Criteria: minimum trip duration (>3 min for >5 products), varying intervals

---

## 13. Pairwise Comparisons

Three-level pairwise comparison data for the hierarchical sorting algorithm.

| Field | Description |
|-------|-------------|
| store_id | Store |
| level | PairwiseLevel: demand_group / demand_sub_group / product |
| scope | Scope within level (e.g. parent demand_group for sub-group comparisons) |
| item_a | First item identifier |
| item_b | Second item identifier |
| a_before_b_count | Times A was checked off before B |
| b_before_a_count | Times B was checked off before A |

---

## 14. Sorting Error

User-reported sorting errors.

| Field | Description |
|-------|-------------|
| error_id | Unique ID |
| user_id | Reporting user |
| store_id | Store |
| trip_id | Related trip |
| current_sort_order | Sort order snapshot at time of report |
| reported_at | Report timestamp |
| status | open / investigated / resolved |

---

## 15. Aggregated Aisle Order

Average aisle order across all stores. Fallback for stores without own data.

| Field | Description |
|-------|-------------|
| demand_group_code | Demand group code (FK to demand_groups) |
| average_position | Average position across all stores |
| std_deviation | Standard deviation |
| contributing_stores | Number of stores in calculation |
| last_calculated_at | Last recalculation |

---

## 16. Photo Uploads – F13

| Field | Description |
|-------|-------------|
| upload_id | Unique ID |
| user_id | Uploader |
| photo_url | URL in Supabase Storage (bucket: product-photos) |
| photo_type | Auto-detected: product_front / product_back / receipt / flyer_pdf / shelf / data_extraction |
| status | uploading / processing / pending_review / completed / confirmed / discarded / error |
| extracted_data | JSON with extracted raw data from AI analysis |
| products_created | Number of newly created products |
| products_updated | Number of updated products |
| error_message | Error message (if status = error) |
| created_at | Upload timestamp |
| processed_at | Processing timestamp |

---

## 17. Receipts (Scanned)

### Receipts Table

| Field | Description |
|-------|-------------|
| receipt_id | Unique ID |
| user_id | Device user ID (TEXT) |
| store_name | Store name from receipt (e.g. "ALDI SÜD", "REWE City") |
| store_address | Store address (if visible on receipt) |
| retailer | Normalized retailer identifier (e.g. "ALDI", "LIDL", "REWE"). Maps to RETAILERS in retailers.ts. NULL = unknown. |
| purchase_date | Date of purchase (YYYY-MM-DD) |
| purchase_time | Time of purchase (HH:MM) |
| total_amount | Total amount paid |
| payment_method | Payment method (BAR, EC-Karte, etc.) |
| currency | Currency code (default EUR) |
| photo_urls | Array of photo URLs in Supabase Storage |
| raw_ocr_data | Complete OCR extraction result (JSON) |
| extra_info | Additional receipt info (tax details, TSE, etc.) |
| items_count | Number of product lines |
| created_at | Scan timestamp |

### Receipt Items Table

| Field | Description |
|-------|-------------|
| receipt_item_id | Unique ID |
| receipt_id | Reference to receipts.receipt_id |
| position | Order on receipt (1, 2, 3, ...) |
| article_number | Article number from receipt (if present) |
| receipt_name | Abbreviated product name as printed on receipt |
| product_id | Linked ALDI product (if matched by article_number). NULL for competitor receipts. |
| competitor_product_id | Linked competitor product (for non-ALDI receipts). NULL for ALDI receipts. Mutually exclusive with product_id. |
| quantity | Quantity purchased |
| unit_price | Price per unit |
| total_price | Total price for this line |
| is_weight_item | Whether item is sold by weight |
| weight_kg | Weight in kg (if weight item) |
| tax_category | Tax category letter (A, B) |

### Receipt Matching Logic

**ALDI receipts** (`retailer = "ALDI"`): Items matched against `products` table by `article_number` (exact match, then prefix match for 9-digit variant numbers). Prices updated if receipt date is newer. `receipt_items.product_id` set.

**Competitor receipts** (LIDL, REWE, etc.): Items matched against `competitor_products` by `name_normalized`. If no match exists, a new `competitor_product` is auto-created from the receipt data. Prices written to `competitor_product_prices`. `receipt_items.competitor_product_id` set. Purchase stats upserted in `competitor_product_stats`.

**Unsupported retailers / non-receipts**: Rejected at OCR stage (HTTP 422). Photos cleaned up from storage.

---

## 18. Flyers – F14

### Flyers Table

| Field | Description |
|-------|-------------|
| flyer_id | Unique ID |
| title | Title (e.g. "Week 09 – Specials from Feb 24") |
| valid_from | Valid from date |
| valid_until | Valid until date |
| country | 'DE' or 'AT' |
| pdf_url | URL of original PDF in Supabase Storage |
| total_pages | Number of pages |
| status | active / expired (automatic based on valid_until) |
| created_at | Upload timestamp |

### Flyer Pages Table

| Field | Description |
|-------|-------------|
| page_id | Unique ID |
| flyer_id | Reference to flyers.flyer_id |
| page_number | Page number (1, 2, 3, ...) |
| image_url | URL of page image/PDF in Supabase Storage |

---

## 20. Feedback

| Field | Description |
|-------|-------------|
| feedback_id | Unique ID |
| user_id | Submitting user (auth.uid()) |
| feedback_type | product / general / post_shopping |
| product_id | Product reference (product feedback only) |
| trip_id | Trip reference (post-shopping only) |
| store_id | Store context (optional) |
| category | Category tag (quality, price, app, etc.) |
| rating | 1–5 stars or emoji rating (optional) |
| message | Free-text feedback (max 2,000 chars) |
| status | new / read / archived |
| created_at | Submission timestamp |

---

## 19. Data Flow Overview

```
User adds product
    │
    ▼
ListItem created
    │ (generic: demand_group assigned via Claude API)
    │ (specific: demand_group_code from Product DB)
    │
    ▼
List sorted
    │ (using AisleOrder of detected store
    │  or AggregatedAisleOrder as fallback
    │  or DemandGroup.sort_position as base fallback)
    │
    ▼
User checks off products (in store)
    │
    ▼
CheckoffSequence saved (with timestamps per product)
    │
    ▼
Validation: Was the shopping trip "real"?
    │
    ├── Yes → Update AisleOrder for this store
    │         Recalculate AggregatedAisleOrder
    │
    └── No → Sequence ignored (is_valid = false)
    
    │
    ▼
ShoppingTrip archived → UserProductPreference updated
```

---

*Last updated: 2026-03-03*
*Status: Draft v10 – BL-62 Phase 3: Frontend fully migrated to demand_group_code. All UI components, API routes, services use demand_group_code exclusively. Deprecated category code removed. IndexedDB categories table dropped (Dexie v11). category_id DB columns remain for Phase 4 cleanup.*
