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

A grocery store location. Originally ALDI-only; since 2026-03-07 supports any retailer (REWE, EDEKA, Lidl, etc.). User-created stores are added via GPS detection when no known store is nearby.

| Field | Description |
|-------|-------------|
| store_id | Unique ID (prefix `store-`) |
| name | Display name (e.g. "ALDI SÜD Musterstraße 12", "REWE Leopoldstraße") |
| address | Full address |
| city | City |
| postal_code | Postal code |
| country | Country (DE / AT / NZ) |
| latitude | GPS latitude |
| longitude | GPS longitude |
| has_sorting_data | Whether aisle order data exists for this store |
| sorting_data_quality | Quality indicator: number of trips that contributed to aisle order |
| retailer | Retailer/chain name (e.g. "ALDI SÜD", "REWE", "EDEKA", "Lidl"). Used for cross-chain Layer 2 aggregation. Default: "ALDI SÜD". Added in migration `20260307000000_stores_retailer.sql`. |
| created_at | Creation date |
| updated_at | Last update |

### Store Creation

Stores can originate from two sources:
- **Pre-loaded:** ALDI SÜD stores imported via admin scripts (with `external_id` for ALDI store codes)
- **User-created:** When GPS detects the user at an unknown location, a dialog prompts them to create a new store by selecting a retailer from a dropdown and optionally entering a name. GPS coordinates are captured automatically; address is reverse-geocoded via OpenStreetMap Nominatim API. User-created stores are saved to both Supabase and IndexedDB.

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

---

> **See also:** [DATA-MODEL-EXTENDED.md](DATA-MODEL-EXTENDED.md) for extended tables (User Product Preferences, Competitor Products, Aisle Order, Checkoff Sequences, Pairwise Comparisons, Photo Uploads, Receipts, Flyers, Feedback, Data Flow).

---

*Last updated: 2026-03-08*
*Status: Draft v11 – Split into DATA-MODEL.md (core) + DATA-MODEL-EXTENDED.md (extended).*
