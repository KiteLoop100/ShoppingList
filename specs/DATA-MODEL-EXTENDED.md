# DATA-MODEL-EXTENDED.md – Extended Data Model

> Extended/specialized tables for the ALDI Einkaufsliste app.
> For core tables (User, ShoppingList, ListItem, Product, DemandGroups, Store, ShoppingTrip, TripItem) see [DATA-MODEL.md](DATA-MODEL.md).

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
| retailer | Primary retailer (e.g. "EDEKA"). Set by ProductCaptureModal or receipt scan. |
| thumbnail_url | Public URL to product photo |
| demand_group_code | FK to demand_groups(code). Auto-assigned via categorization pipeline (AI hint → keyword fallback → Haiku). |
| demand_sub_group | FK to demand_sub_groups(code). Currently not auto-assigned (manual only). |
| assortment_type | "daily_range" (default), "special_food", or "special_nonfood" |
| status | "active" or "inactive" |
| is_bio, is_vegan, is_gluten_free, is_lactose_free | Dietary boolean flags |
| animal_welfare_level | 1–4 (Haltungsform), null if unknown |
| ingredients | Full ingredient list (text) |
| nutrition_info | Nutritional values per 100g (JSONB) |
| allergens | Comma-separated allergen list |
| nutri_score | A–E letter grade |
| country_of_origin | Country of origin |
| created_at | Creation timestamp |
| created_by | User who created it |

### Categorization Pipeline

When a competitor product is created without a `demand_group_code`, a 3-stage fallback chain assigns one:

1. **AI hint** — If the caller already has a demand group (e.g. receipt OCR inferred it from context), use it directly.
2. **Keyword fallback** — `getDemandGroupFallback()` matches product name against ~40 keyword patterns. Free, instant, ~50% hit rate.
3. **AI classification** — `/api/assign-category` sends the product name to Claude Haiku with the full demand group list. ~90% accuracy, costs one API call.

If all stages fail, `demand_group_code` stays NULL. The product still works in search and lists; it just won't appear in a future catalog view.

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
Returns competitor products for a retailer, ranked by user purchase count DESC, global count DESC, name ASC. Joins `competitor_products` with `competitor_product_stats` and `competitor_product_prices`. Optional text filter on `name_normalized` and `brand`. Returns `demand_group_code`.

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

## 19. Data Flow Overview

```
User adds product
    │
    ▼
ListItem created
    │ (generic: demand_group_code assigned via keyword fallback or Gemini API)
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

*Last updated: 2026-03-08*
*Status: Draft v11 – Split from DATA-MODEL.md for modularity.*
