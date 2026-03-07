# FEATURES-ELSEWHERE.md – Buy Elsewhere (F26)

> Assign shopping list items to other retailers (LIDL, REWE, EDEKA, etc.) when a product is not available at ALDI.
> Items appear in a separate "Anderswo kaufen" section, do not count towards the ALDI total, and carry over after trip archival.

---

## Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F26 |
| **Purpose** | Allow users to mark items for purchase at other retailers when unavailable at ALDI |
| **Section Label** | "Anderswo kaufen" (DE) / "Buy elsewhere" (EN) |

### Behavior Summary

- Buy-elsewhere items appear in a dedicated section below checked/deferred items
- They do **not** count towards the ALDI estimated total
- They do **not** block trip completion
- They **carry over** to the next list after trip archival (via existing deferred pipeline)
- Checking off an elsewhere item **deletes** it immediately (user bought it at the other store)

---

## Architecture

Buy-elsewhere items are modeled as **deferred items** with `deferred_reason="elsewhere"` and a new DB field `buy_elsewhere_retailer` on `list_items`. This reuses the entire existing deferred pipeline:

- Same `is_deferred`, `deferred_until`, `deferred_reason` semantics
- Same carry-over logic in `archive-trip.ts` (spread operator copies all fields)
- Same section rendering in `shopping-list-content.tsx` (extended to handle elsewhere as a sub-group)

---

## Input Methods

### 1. Staged Right-Swipe

| Swipe Distance | Action | Color |
|----------------|--------|-------|
| Short (60px) | "Nächster Einkauf" (defer to next trip) | Blue |
| Long (100px+) | "Anderswo" (assign to other retailer) | Orange |

- **Button confirmation required** for both actions
- **Only for:** unchecked, non-deferred items
- Long swipe opens retailer picker sheet; user selects retailer, then confirms

### 2. Search Field Prefix (Retailer Product Search)

| Input Pattern | Action |
|---------------|--------|
| `{Retailer}` alone (e.g. "Rossmann") | Show all competitor products at that retailer, ranked by purchase frequency |
| `{Retailer} {Product}` (e.g. "EDEKA Hafermilch") | Show competitor products at that retailer filtered by product query |

- **Case-insensitive** retailer matching
- Results come from `competitor_products` + `competitor_product_prices` tables via `search_retailer_products` RPC
- **Ranking**: Personal purchase count (DESC) → Global purchase count (DESC) → Name (ASC)
- **Sections**: "Meine Einkaufe" (user's own purchases) shown above "Weitere Produkte" (other users' products)
- Selecting a product adds it with `buy_elsewhere_retailer` + `competitor_product_id` set
- Generic add ("+ Produktname") available when a product sub-query is entered
- Empty state: "Noch keine {Retailer}-Produkte erfasst" with prompt to type a product name
- **Purchase tracking**: When an elsewhere item with `competitor_product_id` is checked off, a record is upserted into `competitor_product_stats` (fire-and-forget)

### 3. Retailer Badge Tap

- Tap on retailer badge on an elsewhere item → opens retailer picker to change retailer

---

## Data Model

### Database: `list_items`

| Field | Type | Description |
|-------|------|-------------|
| buy_elsewhere_retailer | TEXT DEFAULT NULL | Retailer code (e.g. "LIDL", "REWE"). NULL for non-elsewhere items. |

### Database: `competitor_product_stats`

| Field | Type | Description |
|-------|------|-------------|
| competitor_product_id | UUID NOT NULL FK | References `competitor_products.product_id` |
| retailer | TEXT NOT NULL | Retailer name (e.g. "Rossmann") |
| user_id | UUID NOT NULL FK | References `auth.users` |
| purchase_count | INTEGER NOT NULL DEFAULT 1 | Number of times this product was checked off for this retailer by this user |
| last_purchased_at | TIMESTAMPTZ NOT NULL | Timestamp of most recent check-off |

PK: `(competitor_product_id, retailer, user_id)`. Updated via fire-and-forget upsert when an elsewhere item with `competitor_product_id` is checked off.

### TypeScript

- **ListItem:** Add `buy_elsewhere_retailer?: string | null`
- **deferred_reason:** Extend union with `"elsewhere"`
- Elsewhere items: `is_deferred=true`, `deferred_reason="elsewhere"`, `buy_elsewhere_retailer` set

### Retailer Lists

| Country | Retailers |
|---------|-----------|
| **DE** | LIDL, REWE, EDEKA, Penny, Netto, Kaufland, dm, Rossmann |
| **AT** | Spar, BILLA, LIDL, Hofer, dm, Müller |

---

## UI

### Section Order

1. Unchecked (ALDI) items
2. Checked items
3. Deferred items (grouped by date: "Nächster Einkauf", specific dates)
4. **Elsewhere section** – separated by dashed line, labeled "Anderswo kaufen"

### Elsewhere Section

- Items **grouped by retailer** with neutral orange backgrounds (no per-retailer color coding)
- Retailer badge uses static `bg-orange-100 text-orange-800` styling
- **No price** shown for elsewhere items
- **Not counted** in estimated total
- Retailer badge on each item (tappable to change retailer)
- Pencil icon on generic items opens `ProductCaptureModal` (unified capture module, not ALDI product picker)

### Check-Off Behavior

- Checking off an elsewhere item → **deletes** it immediately
- `setItemChecked` detects elsewhere items and deletes instead of marking checked
- Rationale: User bought it at the other store; no need to archive in trip

---

## Trip Completion

- Elsewhere items **do not block** completion
- Trip can be archived when all ALDI items (unchecked + deferred non-elsewhere) are checked
- Elsewhere items **carry over** to new list via existing deferred carry-over mechanism
- Carry-over uses **spread operator** (`...rest`) so no field (including `buy_elsewhere_retailer`) can be forgotten

---

## Structural Bug Fixes

These fixes ensure the elsewhere feature integrates correctly with existing logic:

1. **setItemChecked:** Detect elsewhere items automatically and delete them instead of setting `is_checked=true`
2. **Carry-over:** Use spread operator (`...rest`) when copying deferred items to new list so `buy_elsewhere_retailer` and any future fields are never omitted
3. **Duplicate detection:** `addListItem` includes `buy_elsewhere_retailer` in duplicate matching (same product + same retailer = duplicate)

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User swipes elsewhere on already-deferred item | Disallowed (only unchecked, non-deferred items) |
| Search: unknown retailer name | Treat as generic product name, add without retailer |
| Search: retailer name typo | No match; suggest "Did you mean LIDL?" if close match exists |
| Empty elsewhere section | Section hidden (no dashed line, no header) |
| All items elsewhere, user checks last ALDI item | Trip completes; elsewhere items carry over |
| User changes locale DE→AT | Retailer list switches to AT set |
| Duplicate: same product, same retailer | Merge quantities, keep single item |

---

## Backlog Items

| ID | Status | Description |
|----|--------|-------------|
| **B1** | Open | **Retailer Memory** – App remembers retailer assignments per product (e.g. "Hafermilch" always LIDL) |
| **B2** | Open | **Back to ALDI** – Swipe gesture to move elsewhere items back to ALDI list |
| **B3** | **Done** | **Receipt Retailer Detection** – Automatic retailer detection when scanning receipts via OCR, building a competitor price database. Claude identifies the retailer during OCR; non-ALDI receipt items are auto-created as `competitor_products` with prices written to `competitor_product_prices`. Unsupported retailers and non-receipts are rejected. See FEATURES-CAPTURE.md. |
| **B4** | **Done** | **Competitor Product Database** – Competitor product database with manual form, barcode scan, checkoff capture, and photo auto-fill. See "B4: Competitor Product Database" section below. |

---

## Affected Files

### New (F26)

- `specs/FEATURES-ELSEWHERE.md` – This spec
- `supabase/migrations/20260301200000_buy_elsewhere.sql` – Add `buy_elsewhere_retailer` to `list_items`
- `src/lib/retailers/retailers.ts` – Retailer lists (DE/AT), validation
- `src/components/list/retailer-picker-sheet.tsx` – Retailer selection UI

### New (B4)

- `supabase/migrations/20260301210000_competitor_products.sql` – `competitor_products` + `competitor_product_prices` tables, RLS, indexes
- `src/lib/competitor-products/competitor-product-service.ts` – CRUD for competitor products and prices
- `src/lib/competitor-products/competitor-products-context.tsx` – React Context Provider (country-filtered download + IndexedDB sync)
- `src/components/product-capture/product-capture-modal.tsx` – Unified product capture modal (replaces former `competitor-product-form-modal.tsx` and `edit-product-modal.tsx`)
- `src/components/list/elsewhere-checkoff-prompt.tsx` – Lightweight price/photo capture on item check-off
- `src/app/api/analyze-product-photos/route.ts` – Unified product photo analysis endpoint (replaces former `/api/extract-product-info` and `/api/analyze-competitor-photos`)

### New (Retailer Product Search)

- `supabase/migrations/20260302200000_competitor_product_stats.sql` – `competitor_product_stats` table, RLS, `search_retailer_products` RPC
- `src/components/search/retailer-products-panel.tsx` – Retailer product search results panel with personal/global sections

### Changed

- `src/types/index.ts` – `buy_elsewhere_retailer`, `competitor_product_id` on ListItem; `CompetitorProduct`, `CompetitorProductPrice` interfaces
- `src/lib/db/indexed-db.ts` – Schema v8: `buy_elsewhere_retailer` + `competitor_products` store
- `src/lib/db/index.ts` – Export `LocalCompetitorProduct`
- `src/lib/list/active-list.ts` – setItemChecked for elsewhere; `competitor_product_id` in CRUD; hardened error throwing
- `src/lib/list/list-helpers.ts` – `ListItemWithMeta` extended with `competitor_product_id`, `competitor_price`, `competitor_thumbnail_url`
- `src/components/list/use-list-data.ts` – Elsewhere section data, `competitor_product_id` mapping
- `src/lib/list/archive-trip.ts` – Carry-over with spread operator
- `src/components/list/list-item-row.tsx` – Swipe thresholds, retailer badge (`<span role="button">`), static orange styling
- `src/components/list/shopping-list-content.tsx` – Elsewhere section UI, pencil icon routing, checkoff prompt, competitor form integration
- `src/components/search/barcode-scanner-modal.tsx` – 3-tier waterfall: ALDI → competitor → Open Food Facts
- `src/lib/search/commands.ts` – Search prefix parsing for retailer + product
- `src/components/search/product-search.tsx` – Retailer-only search display
- `src/app/[locale]/layout.tsx` – `CompetitorProductsProvider` wrapper
- `src/app/[locale]/page.tsx` – `setBuyElsewhere` in `stableListData` (bug fix)
- `src/messages/de.json`, `src/messages/en.json` – 17+ new i18n keys for F26 and B4
- `specs/FEATURES-CORE.md` – Reference to F26 in feature table
- `specs/DATA-MODEL.md` – Competitor product tables documented
- `specs/ARCHITECTURE.md` – `/api/analyze-product-photos` endpoint documented

---

## B4: Competitor Product Database (Implemented)

Separate database for products from other retailers. Completely independent from the ALDI `products` table.

### Data Model

**`competitor_products`** -- One row per unique product (identified by name + EAN).
Fields: product_id, name, name_normalized, brand, ean_barcode, article_number, weight_or_quantity, country, thumbnail_url, category_id, status, created_at, created_by.

**`competitor_product_prices`** -- Append-only price history. One row per price observation.
Fields: price_id, product_id, retailer, price, observed_at, observed_by.
Current price = latest row per (product_id, retailer).

**`list_items.competitor_product_id`** -- Optional FK linking an elsewhere item to a competitor product.

### Architecture

- **Separate tables**: `products` (ALDI) and `competitor_products` never mix. No risk during ALDI imports.
- **Separate references**: `list_items.product_id` -> ALDI, `list_items.competitor_product_id` -> competitor.
- **Separate provider**: `CompetitorProductsProvider` downloads country-filtered competitor products independently.
- **Normalized model**: One product entry shared across retailers, prices tracked per retailer.
- **Country filtering**: `.eq("country", country)` on download, same pattern as ALDI products.
- **IndexedDB sync**: `competitor_products` table in Dexie Schema v8 for offline fallback.

### Capture Methods

1. **Unified capture form** (`ProductCaptureModal`): Name, brand, retailer, category, subcategory, price, EAN, product number, weight/quantity, assortment type, dietary flags, photo upload with AI analysis. Opened via pencil icon on elsewhere items, "+ Produkt erfassen" button, "Produkt anlegen" in GenericProductPicker, or "Produkt bearbeiten" from product detail views. The retailer field determines the target table: ALDI -> `products`, other -> `competitor_products`.
2. **Barcode scan** (extended `BarcodeScannerModal`): EAN -> ALDI lookup -> competitor lookup -> Open Food Facts auto-fill.
3. **Checkoff prompt** (`ElsewhereCheckoffPrompt`): When checking off an elsewhere item, lightweight price + photo capture.
4. **Photo auto-fill** (via `/api/analyze-product-photos`): "Produktfotos hochladen" button in the form sends photos to the Product Photo Studio pipeline (Claude Vision + ZBar WASM barcode scan), auto-fills all fields from extracted data.

### Photos

Stored in Supabase Storage bucket `competitor-product-photos`. Public URLs saved as `thumbnail_url` on `competitor_products`.

### Photo Studio Pipeline (Product Photo Studio)

The `ProductCaptureModal` offers a single "Produktfotos hochladen" button that accepts multiple photos (up to 8). All photos are analyzed together in a 4-stage pipeline:

| Stage | Model | Purpose |
|-------|-------|---------|
| **1. Classify** | Claude Sonnet 4.5 | Content moderation + photo type classification (front/back/price tag/barcode) |
| **2. Extract** | Claude Sonnet 4.5 | Comprehensive product info extraction from all photos combined (name, brand, EAN, price, ingredients, nutrition, allergens, Nutri-Score, dietary flags, country of origin) |
| **3. Thumbnail** | Sharp + remove.bg | Select best front photo, pre-crop with 20% margin, remove background (self-hosted → remove.bg → crop fallback), suppress reflections, enhance to 1200×1200 professional thumbnail |
| **4. Verify** | Claude Haiku 4.5 | Quality check: completeness + background removal are K.O. criteria (approve/review/reject) |

**Parallelism:** Stage 1 + ZBar barcode scan run in parallel. After moderation gate passes, Stage 2 + Stage 3 run in parallel. Stage 4 runs after Stage 3 completes.

**Pipeline budget:** 28 seconds total. Stage 4 is skipped (result flagged as `review_required`) if budget is exhausted.

**API Endpoint:** `POST /api/analyze-product-photos`
- Input: `{ images: [{ image_base64, media_type }] }` (1-8 photos)
- Output: `{ ok, status, extracted_data, thumbnail_base64, thumbnail_small_base64, quality_score, processing_time_ms, background_removal_failed }`
- Total processing time: ~9–18 seconds

**Auto-fill rules:** Only empty fields are overwritten. If the user has already typed a name or brand, the auto-fill does not replace it.

**New fields extracted:** ingredients, nutrition_info (JSONB), allergens, nutri_score, country_of_origin, is_vegan, is_gluten_free, is_lactose_free, animal_welfare_level.

**Module:** `src/lib/product-photo-studio/` — pipeline.ts, pipeline-runner.ts, validate-classify.ts, extract-product-info.ts, create-thumbnail.ts, background-removal.ts, image-enhance.ts, verify-quality.ts, types.ts, prompts.ts.

### UX Details

- Form subtitle: "Du verbesserst das App-Erlebnis fuer alle" (positive community messaging)
- Pencil icon on generic elsewhere items opens `ProductCaptureModal` (unified capture module)
- Retailer badge uses `<span role="button">` (not `<button>`) to avoid invalid HTML nesting

---

## Bug Fixes Applied

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| "Error" when selecting retailer via swipe | `setBuyElsewhere` missing from `stableListData` in `page.tsx` | Added to memoized object and dependency array |
| `<button>` inside `<button>` hydration warning | Retailer badge was a `<button>` nested inside product name `<button>` | Changed to `<span role="button">` |
| Pencil opens ALDI picker for elsewhere items | `handleOpenDetail` only checked `!product_id`, not `deferred_reason` | Added `deferred_reason === "elsewhere"` check, routes to `ProductCaptureModal` |
| `updateListItem` silent failures | Supabase errors not thrown | Added `throw new Error()` on Supabase update failure |

---

*Last updated: 2026-03-06*
