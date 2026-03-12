# CHANGELOG.md – Change Log

> Documents all changes to spec files.
> Format: Date, what changed, in which file, why.

---

## 2026-03-11 – Backlog Bereinigung, F28 Audit, BL-74 i18n, BL-69 PWA Shortcuts

Session covering migration sync, responsive audit, i18n consolidation, and PWA shortcuts.

### Migration Sync Fix
- **Renamed: `supabase/migrations/20260312200000_product_aliases.sql`** to `20260311104429_product_aliases.sql` — local file timestamp now matches the version applied in Supabase, preventing sync drift.

### F28 Responsive Audit
- **12 of 19 F28 items** confirmed as already implemented in code. RESP-001 through RESP-007, RESP-010 through RESP-013, RESP-015 marked completed in BACKLOG.md.
- **Modified: `src/components/product-capture/data-conflict-dialog.tsx`** — Added `sm:items-center` + `sm:rounded-2xl` for desktop modal centering (was bottom-only).
- **Modified: `src/components/onboarding/screens/multi-device-screen.tsx`** — Added `md:max-w-sm` (was only screen without responsive max-width).
- **Modified: `src/app/[locale]/settings/settings-client.tsx`** — Added `lg:max-w-4xl` (consistent with all other pages).

### BL-74: i18n Namespace Consolidation
- **Modified: `src/messages/de.json`** — `competitorDetail` namespace removed (29 keys). 19 competitor-only keys moved into `productDetail`. New key `eanCrossRefAldi`. 10 duplicate keys eliminated.
- **Modified: `src/messages/en.json`** — Same changes as de.json.
- **Modified: `src/components/product-detail/product-detail-view.tsx`** — Removed `tComp = useTranslations("competitorDetail")`. 11 ternary expressions simplified from `isAldi ? t("x") : tComp("y")` to `t("x")` for identical keys.
- **Modified: `src/components/list/competitor-product-detail-modal.tsx`** — Changed namespace from `competitorDetail` to `productDetail`.

### BL-69: PWA App Shortcuts
- **Modified: `public/manifest.json`** — Added `shortcuts` array with 4 entries: Produkt suchen (`/de`), Kassenzettel scannen (`/de/capture`), Handzettel (`/de/flyer`), Einstellungen (`/de/settings`). Uses `icon-96.png`. Visible on Android Chrome/Edge via long-press on app icon.

### Specs Updated
- `BACKLOG.md` — BL-69, BL-70, BL-74 marked completed. F28 Phase 1+2 audit: 12 items completed, 11 open. Updated timestamp.

---

## 2026-03-10 – BL-62 Phase 4 + BL-63 Data Cleanup

Completed the demand group migration by dropping all legacy columns and tables, and cleaning up data inconsistencies.

### DB Migrations
- **`20260310100000_bl63_data_cleanup.sql`** — Migrated 4,702 products from legacy `demand_sub_group` strings to FK codes. Set 5,266 unmapped values to NULL. Migrated pairwise_comparisons scopes from names to codes (4,218 rows). Fixed demand_groups.name truncation for code '70'.
- **`20260310200000_bl62_phase4_cleanup.sql`** — Dropped `products.category_id`, `products.demand_group`, `competitor_products.category_id` columns. Dropped `category_aliases` table.

### Modified Files
- **`src/lib/products/demand-group-fallback.ts`** — KEYWORD_MAP converted from `"XX-Name"` strings to pure `"XX"` codes.
- **`src/lib/list/pairwise-extract.ts`** — All three pairwise levels use `demand_group_code` for scope construction.
- **`src/lib/list/save-checkoff-and-pairwise.ts`** — Group identifier changed to `demand_group_code`.
- **`src/lib/list/list-helpers.ts`** — `ProductMetaForSort` uses `demand_group_code`. Sort logic uses code-based scopes.
- **`src/components/list/hooks/use-list-sort.ts`** — Pairwise scope and default group order use `.code`.
- **`src/components/list/hooks/list-data-helpers.ts`** — Product maps use `demand_group_code`.
- **`src/components/list/list-section.tsx`** — Category label uses `item.category_name` (demand group name) instead of `item.demand_group` (which now contains only a code).
- **`src/types/index.ts`** — Removed `Category`, `CategoryAlias` interfaces. Removed `demand_group` from `Product`, `category_id` from `CompetitorProduct`.
- **`src/lib/db/indexed-db.ts`** — Dexie v15: dropped `category_aliases` table.
- **`src/app/[locale]/admin/admin-client.tsx`** — Removed CategoryAliasPanel.
- **`next.config.js`** — Removed `categories` URL pattern from PWA precache.
- ~15 additional files: removed `demand_group` and `category_id` references from API routes, services, and scripts.

### Deleted Files
- **`src/app/[locale]/admin/category-alias-panel.tsx`** — Legacy category alias management UI.

### Specs Updated
- `BACKLOG.md` — BL-62, BL-63 marked completed with resolution notes.
- `FEATURES-CORE.md` — Category label and assignment descriptions updated.
- `DATA-MODEL.md` — Legacy sections 6/6b removed. Phase 4 marked complete. `demand_group` and `category_id` columns removed from schema.
- `DATA-MODEL-EXTENDED.md` — Removed deprecated `category_id` from competitor_products schema.
- `ARCHITECTURE.md` — Category assignment module updated (keyword fallback description).
- `README.md` — Added FEATURES-INVENTORY.md, PHOTO-PIPELINE.md, BACKLOG.md. Updated line counts.

---

## 2026-03-07 – Competitor Product Categorization

Adds automatic `demand_group_code` assignment to competitor products via a 3-stage fallback chain (AI hint → keyword fallback → Claude Haiku). Enables future catalog view for competitor products.

### New Files
- **`src/lib/competitor-products/categorize-competitor-product.ts`** — Central categorization service with `categorizeCompetitorProduct()` (client-side) and `categorizeCompetitorProductServer()` (server-side) functions. Includes `extractDemandGroupCode()` utility for parsing "##-Name" format.
- **`supabase/migrations/20260307100000_fix_search_retailer_products_rpc.sql`** — Replaces orphaned `category_id` with `demand_group_code` in `search_retailer_products` RPC.
- **`src/lib/competitor-products/__tests__/categorize-competitor-product.test.ts`** — Tests for `extractDemandGroupCode()`.
- **`src/lib/products/__tests__/demand-group-fallback.test.ts`** — Tests for keyword-based demand group fallback.

### Modified Files
- **`src/lib/receipts/receipt-prompt.ts`** — `RECEIPT_PROMPT` now includes `DEMAND_GROUPS_INSTRUCTION` and requests `demand_group` per product line.
- **`src/lib/receipts/parse-receipt.ts`** — `ReceiptProduct` interface extended with `demand_group`. `findOrCreateCompetitorProductServer()` now accepts and sets `retailer`. `processValidReceipt()` calls `categorizeCompetitorProductServer()` for new competitor products.
- **`src/lib/product-photo-studio/prompts.ts`** — `extractCompetitorProductPrompt()` now includes `DEMAND_GROUPS_INSTRUCTION` and requests `demand_group`.
- **`src/lib/product-photo-studio/types.ts`** — `ExtractedProductInfo` extended with `demand_group`.
- **`src/components/product-capture/hooks/use-product-capture-form.ts`** — AI-extracted `demand_group` pre-fills the demand group dropdown.
- **`src/components/product-capture/product-capture-save.ts`** — Fires `categorizeCompetitorProduct()` in background for new products without a demand group.
- **`src/lib/competitor-products/competitor-product-service.ts`** — `RetailerProductResult.category_id` replaced with `demand_group_code`.
- **`src/components/search/hooks/use-add-to-list.ts`** — Uses `demand_group_code` instead of orphaned `category_id`.

### Specs Updated
- `DATA-MODEL.md` — Competitor product schema updated with all current fields and categorization pipeline docs.
- `FEATURES-ELSEWHERE.md` — Data model, capture methods updated with categorization details.
- `FEATURES-CAPTURE.md` — Competitor product categorization section added.
- `ARCHITECTURE.md` — Category assignment module updated from `category_id` to `demand_group_code`.

---

## 2026-03-07 – Multi-Retailer Store Learning

Extends the app from ALDI-only to any grocery retailer. Users can create stores for REWE, EDEKA, Lidl, Penny, dm, etc. The existing pairwise learning algorithm now scopes Layer 2 aggregation to same-chain stores.

### Database & Data Model
- **New: `supabase/migrations/20260307000000_stores_retailer.sql`** – Adds `retailer TEXT DEFAULT 'ALDI SÜD'` to `stores` table. Back-fills NZ stores based on name.
- **Modified: `src/types/index.ts`** – Added `retailer: string` to `Store` interface.
- **Modified: `src/lib/db/indexed-db.ts`** – Schema v14: `retailer` index on `stores` table.
- **Modified: `src/lib/db/seed-data.ts`** – `retailer` field added to all seed stores (ALDI SÜD, PAK'nSAVE, New World, Woolworths).

### Store Creation
- **New: `src/lib/store/known-retailers.ts`** – Shared constant `KNOWN_RETAILERS`: 22 major grocery retailers (DACH + NZ).
- **New: `src/components/store/create-store-dialog.tsx`** – Dialog with retailer dropdown, optional store name, auto-detected address via reverse geocoding (OpenStreetMap Nominatim API).
- **Modified: `src/lib/store/store-service.ts`** – New `createStore()`, `reverseGeocode()`, `getStoreRetailer()`, `detectStoreOrPosition()` functions. `rowToStore()` maps `retailer` field (default: "ALDI SÜD").

### Store Detection & UI
- **Modified: `src/hooks/use-store-detection.ts`** – New `unknownLocation` state (GeoPosition) when GPS finds position but no known store. `handleStoreCreated` and `handleSkipCreateStore` callbacks.
- **Modified: `src/app/[locale]/page.tsx`** – Renders `CreateStoreDialog` when `unknownLocation` is active.
- **Modified: `src/app/[locale]/settings/settings-client.tsx`** – Store selector shows retailer badge, search result limit increased to 8.

### Cross-Chain Aggregation
- **Modified: `src/lib/store/hierarchical-order.ts`** – `getRetailerStoreIds()` resolves same-chain stores. `getAggregatedPairwise()` scopes Layer 2 to same-retailer stores with fallback to all stores.
- **Modified: `src/lib/store/store-filter.ts`** – Retailer name matching added (relevance score 4 = highest priority).

### i18n
- **Modified: `src/messages/de.json` + `en.json`** – New `createStore` section with 12 translations each.

### Tests
- **New: `src/lib/store/__tests__/store-filter.test.ts`** – 7 tests for retailer-aware store filtering.
- **New: `src/lib/store/__tests__/hierarchical-order.test.ts`** – 3 tests for cross-chain aggregation.
- **New: `src/lib/store/__tests__/known-retailers.test.ts`** – 4 tests for retailer list integrity.
- All 365 tests pass across 41 test files.

### Specs updated
- `DATA-MODEL.md` (Section 7: `retailer` field, store creation sources)
- `LEARNING-ALGORITHMS.md` (Layer 2 scoped to same-chain, new cold-start section 8.1a)
- `FEATURES-CORE.md` (F04 store detection with create-store dialog, F05 multi-retailer note)
- `ARCHITECTURE.md` (folder structure: `components/store/`)
- `BACKLOG.md` (BL-66: reverse geocoding rate-limiting)

---

## 2026-03-07 – Photo Studio Pipeline: Robustness & Quality Improvements

- **Modified: `src/lib/product-photo-studio/create-thumbnail.ts`** – `PRECROP_MARGIN` erhöht von 15% auf 20%, `MIN_PAD_PX = 50` als Mindest-Padding. Neue `isProductClipped`-Funktion erkennt Alpha-Clipping an Bildkanten; bei Clipping wird ein Retry ohne Pre-Crop durchgeführt. Neue shared `processImageToThumbnail`-Funktion ersetzt duplizierte Logik. `backgroundRemovalFailed`-Flag gesetzt wenn Crop-Fallback greift.
- **Modified: `src/lib/product-photo-studio/background-removal.ts`** – Provider-Kette erweitert: self-hosted (BiRefNet/RMBG-2.0) → remove.bg `type=product` → remove.bg `type=auto` → Crop-Fallback. `AbortSignal.timeout(15_000)` für alle externen Fetches.
- **Modified: `src/lib/product-photo-studio/image-enhance.ts`** – Neue `removeReflections`-Funktion: erkennt Highlight-Clipping (nahe 255/255/255), erstellt dilatierte Maske, blended mit Gauss-geglätteter Umgebung.
- **Modified: `src/lib/product-photo-studio/pipeline.ts`** – `PIPELINE_TIMEOUT_MS = 28_000`: Verification wird bei Zeitbudget-Überschreitung übersprungen. Per-Stage-Timing-Logs. `backgroundRemovalFailed` im Ergebnis.
- **Modified: `src/lib/product-photo-studio/verify-quality.ts`** – Neuer Parameter `backgroundRemovalFailed`: setzt Empfehlung unabhängig vom AI-Ergebnis auf `"review"` und ergänzt Issue `"Hintergrund nicht entfernt"`.
- **Modified: `src/lib/product-photo-studio/prompts.ts`** – `VERIFY_THUMBNAIL_PROMPT` mit expliziten K.O.-Kriterien für Vollständigkeit und Freistellung.
- **Modified: `src/lib/product-photo-studio/types.ts`** – `backgroundRemovalFailed?: boolean` zu `ThumbnailResult` und `ProductPhotoStudioResult`.
- **Modified: `src/lib/api/photo-processing/image-utils.ts`** – Bounding-Box-Erkennung auf Claude Haiku umgestellt (schneller/günstiger). Sanity-Checks: Box muss 5%–98% der Bildfläche abdecken.
- **Modified: `src/lib/api/photo-processing/process-product-photo.ts`** – Refactored auf `processImageToThumbnail` (kein duplizierter Code mehr).
- **Modified: `src/lib/product-photo-studio/extract-product-info.ts`** – `log.warn` in leerem `catch`-Block ergänzt.
- **Modified: `src/components/product-capture/product-capture-save.ts`** – ALDI-Produkte speichern jetzt `thumbnail_url` über den API-Aufruf.
- **Modified: `src/app/api/analyze-product-photos/route.ts`** – `background_removal_failed` in API-Antwort.
- **Modified: `src/lib/product-photo-studio/README.md`** + **`docs/product-image-pipeline.md`** – Dokumentation auf implementierten Stand aktualisiert.
- **Tests:** 64 Tests in 7 Testdateien (vorher: 31 in 6). Neue Tests für Clipping-Erkennung, `removeReflections`, `backgroundRemovalFailed`-Propagation, Bbox-Sanity-Checks, Pipeline-Timeout.

---

## 2026-03-07 – Search Suggestion Thumbnails

- **Modified: `src/types/index.ts`** – Added `thumbnail_url?: string | null` to `SearchResult` interface.
- **Modified: `src/lib/search/local-search.ts`** – Populates `thumbnail_url` from product data in search result mapping.
- **Modified: `src/app/api/products/search/route.ts`** – Added `thumbnail_url` to Supabase select query and API response.
- **Modified: `src/components/search/hooks/use-search-execution.ts`** – Passes `thumbnail_url` from API fallback through to `SearchResult`.
- **Modified: `src/components/search/search-results-panel.tsx`** – Displays 40×40 product thumbnail to the left of each product name. Fixed 40px thumbnail slot is always reserved so product names align consistently. Vertical padding reduced (`py-1.5`) to maximize thumbnail visibility without increasing row height. Uses `next/image` optimization (150×150 source → 40px display).
- **New: `src/lib/search/__tests__/local-search-thumbnail.test.ts`** – 3 tests for thumbnail propagation in local search results.
- **Modified: `src/app/api/products/search/__tests__/route.test.ts`** – 2 tests for thumbnail in API search response.
- **Specs updated:** `FEATURES-CORE.md` (new "Search Result Row" section under F02), `UI.md` (search mode wireframe updated with thumbnail slots).

---

## 2026-03-07 – Sticky Subcategory Nav (Mobile)

- **Modified: `src/components/catalog/subcategory-nav.tsx`** – Chips-Variante erhält `sticky top-0 z-10`, sodass das Unterkategorie-Menü auf Mobilgeräten beim Scrollen oben fixiert bleibt. Desktop-Sidebar unverändert.

---

## 2026-03-07 – Catalog Bug Fixes: Stale Sync State & Wrong Country

### Bug Fix: Empty catalog after IndexedDB wipe (stale `lastSync` timestamp)
- **Modified: `src/lib/products-context.tsx`** – Added guard in `syncProducts()`: if IndexedDB cache is empty but `products-last-sync-{country}` exists in localStorage (stale state after schema upgrade or browser cache clear), the timestamp is deleted before calling `deltaSync()`. This forces a full product load instead of a no-op incremental query (`updated_at > <recent_timestamp>`).

### Bug Fix: Catalog empty for stores outside supported countries
- **Modified: `src/components/catalog/catalog-client.tsx`** – Added "catalog not available" empty state: if `indexedProducts.length === 0` after loading completes, a user-friendly screen is shown with the current country code, an explanation, and a "Change store" button linking to `/settings`.
- **Modified: `src/messages/de.json` + `en.json`** – Four new i18n keys: `notAvailableTitle`, `notAvailableMessage`, `notAvailableHint`, `goToSettings` in the `catalog` namespace.

### Catalog meta-categories migration (data only, applied manually)
- **New: `supabase/migrations/20260306100000_catalog_meta_categories.sql`** – Inserts 14 M-prefixed parent demand groups (M01–M14) and sets `parent_group` on all 61 existing demand groups to link them to their meta-category. This enables the two-level catalog navigation (meta-category tabs + subcategory filter).

---

## 2026-03-06 – Unified Product Capture Module (BL-64)

- **New: `src/components/product-capture/product-capture-modal.tsx`** – Single modal for creating and editing all product types (ALDI + competitor). Retailer field determines target table.
- **New: `src/components/product-capture/product-capture-fields.tsx`** – All form fields (name, brand, retailer, category, subcategory, EAN, product number, price, weight/quantity, assortment type).
- **New: `src/components/product-capture/product-capture-criteria.tsx`** – Dietary flag checkboxes (Bio, Vegan, Glutenfrei, Laktosefrei, Tierhaltung).
- **New: `src/components/product-capture/hooks/use-product-capture-form.ts`** – Form state management, photo analysis integration, field initialization from ALDI/competitor products.
- **New: `src/components/product-capture/product-capture-save.ts`** – Save routing logic: ALDI via `/api/products/create-manual`, competitor via `competitor-product-service`.
- **New: `src/components/product-capture/photo-upload-section.tsx`** – Reusable photo upload UI with preview strip and analysis status.
- **New: `src/components/product-capture/extracted-info-cards.tsx`** – Read-only cards for extracted nutrition/ingredients/allergens.
- **New: `src/app/api/analyze-product-photos/route.ts`** – Unified photo analysis endpoint replacing both `/api/analyze-competitor-photos` and `/api/extract-product-info`.
- **New: `supabase/migrations/20260306000000_unify_product_fields.sql`** – Adds `demand_group_code`, `demand_sub_group`, `assortment_type` to `competitor_products`.
- **Modified: `src/types/index.ts`** – Added `demand_group_code`, `demand_sub_group`, `assortment_type` to `CompetitorProduct`.
- **Modified: `src/lib/db/indexed-db.ts`** – Schema v13: `demand_group_code` index on `competitor_products`.
- **Modified: `src/lib/api/schemas.ts`** – Added dietary flags to `createManualSchema`.
- **Modified: `src/app/api/products/create-manual/route.ts`** – Passes through dietary flags on create/update.
- **Modified: `src/lib/competitor-products/competitor-product-service.ts`** – Added new fields to create/update/map functions.
- **Modified: `src/components/list/generic-product-picker.tsx`** – Added "Produkt anlegen" button below search field.
- **Modified: `src/components/list/shopping-list-content.tsx`** – Replaced `EditProductModal` + `CompetitorProductFormModal` with `ProductCaptureModal`.
- **Modified: `src/components/list/hooks/use-list-modals.ts`** – Added `OPEN_CAPTURE`/`CLOSE_CAPTURE` actions; existing actions now route to capture modal.
- **Modified: `src/components/list/hooks/use-competitor-actions.ts`** – Uses `openCapture` for elsewhere items.
- **Deleted: `src/components/list/edit-product-modal.tsx`** – Replaced by `ProductCaptureModal`.
- **Deleted: `src/components/list/competitor-product-form-modal.tsx`** – Replaced by `ProductCaptureModal`.
- **Deleted: `src/components/list/competitor-form-fields.tsx`** – Replaced by `product-capture-fields.tsx`.
- **Deleted: `src/components/list/competitor-form-save.ts`** – Replaced by `product-capture-save.ts`.
- **Deleted: `src/components/list/hooks/use-competitor-form.ts`** – Replaced by `use-product-capture-form.ts`.
- **Deleted: `src/components/list/competitor-form-photo-section.tsx`** – Replaced by `photo-upload-section.tsx`.
- **Deleted: `src/components/list/competitor-form-extracted-info.tsx`** – Replaced by `extracted-info-cards.tsx`.
- **Deleted: `src/app/api/extract-product-info/route.ts`** – Replaced by unified `/api/analyze-product-photos`.
- **Specs updated:** `FEATURES-CORE.md` (unified product capture section), `FEATURES-ELSEWHERE.md` (updated capture methods, file references), `ARCHITECTURE.md` (API endpoint), `BACKLOG.md` (BL-64 completed), `product-photo-studio/README.md` (unified API note), `IMPROVEMENT-PLAN-V2.md` (competitor-product-form-modal resolved).
- **i18n:** New `productCapture` namespace in `de.json` + `en.json` with 30 keys.
- **Tests:** 5 new tests for save routing, 1 new test for modal actions, 3 updated tests. All 206 tests pass.

---

## 2026-03-05 – Product Photo Studio: Integrated Competitor Product Capture

- **New: `src/lib/product-photo-studio/`** – 4-stage pipeline for processing crowdsourced competitor product photos: classify (Claude Sonnet), extract comprehensive product info (Claude Sonnet), create professional thumbnail (Sharp + remove.bg/Claude crop), verify quality (Claude Haiku). Parallel execution with content moderation gate.
- **New: `src/lib/product-photo-studio/types.ts`** – Interfaces and Zod schemas for the pipeline (PhotoInput, ClassificationResponse, ExtractedCompetitorProductInfo, ThumbnailResult, ThumbnailVerification, etc.).
- **New: `src/lib/product-photo-studio/prompts.ts`** – AI prompts for classification, extraction, and thumbnail verification.
- **New: `src/lib/product-photo-studio/pipeline.ts`** – Orchestrator with two parallel groups gated by content moderation.
- **New: `src/lib/product-photo-studio/validate-classify.ts`** – Stage 1: Content moderation via Claude Sonnet Vision.
- **New: `src/lib/product-photo-studio/extract-product-info.ts`** – Stage 2: Multi-photo product info extraction + ZBar barcode scan.
- **New: `src/lib/product-photo-studio/create-thumbnail.ts`** – Stage 3: Best photo selection, background removal, enhancement (800x800 + 150x150).
- **New: `src/lib/product-photo-studio/background-removal.ts`** – Provider pattern: remove.bg API (primary) + Claude bounding box crop (fallback).
- **New: `src/lib/product-photo-studio/verify-quality.ts`** – Stage 4: Thumbnail QA via Claude Haiku.
- **New: `src/app/api/analyze-competitor-photos/route.ts`** – POST endpoint accepting 1-8 photos, returns extracted data + processed thumbnail.
- **New: `supabase/migrations/20260305000000_competitor_product_details.sql`** – Adds ingredients, nutrition_info (JSONB), allergens, nutri_score, country_of_origin to competitor_products.
- **New: `src/components/list/competitor-form-photo-section.tsx`** – Photo upload UI component with multi-file support and preview strip.
- **New: `src/components/list/competitor-form-extracted-info.tsx`** – Read-only cards displaying extracted product details (Nutri-Score badge, nutrition table, ingredients, allergens).
- **New: `src/components/list/competitor-form-fields.tsx`** – Form fields component extracted for file size compliance.
- **New: `src/components/list/competitor-form-save.ts`** – Save logic for create/update with extracted data application.
- **Modified: `src/components/list/competitor-product-form-modal.tsx`** – Replaced two separate photo buttons with single "Produktfotos hochladen" multi-upload button. Added hint text, auto-fill for all extracted fields including new ones. Decomposed into 4 sub-modules to stay under 300 lines.
- **Modified: `src/components/list/competitor-product-detail-modal.tsx`** – Added display sections for Nutri-Score badge, nutrition table, ingredients, allergens, country of origin.
- **Modified: `src/lib/competitor-products/competitor-product-service.ts`** – Extended rowToCompetitorProduct and updateCompetitorProduct to handle new fields (ingredients, nutrition_info, allergens, nutri_score, country_of_origin).
- **Modified: `src/types/index.ts`** – Added new fields to CompetitorProduct interface.
- **Modified: `src/types/supabase.ts`** – Updated Supabase generated types for competitor_products table.
- **Modified: `src/messages/de.json` + `en.json`** – New translation keys for photo studio UI and detail modal nutrition/allergen display.
- **Specs updated:** `FEATURES-ELSEWHERE.md` (Photo Auto-Fill section replaced with Photo Studio Pipeline documentation).
- **Tests:** 31 tests across 6 test files covering all pipeline stages, background removal, and orchestration.

---

## 2026-03-03 – Category Color Bar Bugfix

- **Modified: `src/components/list/shopping-list-content.tsx`** – `getCategoryColor()` was receiving demand group *names* (e.g. "Milch/Sahne/Butter") instead of demand group *codes* (e.g. "83"), causing all category bars to render in fallback gray. Fixed by adding `demandGroupCode` field to the `CategoryGroup` interface and populating it from `item.demand_group_code` in `groupConsecutiveByCategory()`. The `style` attribute now passes `group.demandGroupCode` to `getCategoryColor()`.

---

## 2026-03-03 – F25: Customer Feedback (Product, General, Post-Shopping)

- **New: `supabase/migrations/20260303200000_feedback.sql`** – `feedback` table with `feedback_type` CHECK, `rating` range CHECK, `message` length CHECK, RLS policies (users INSERT own, admin SELECT/UPDATE/DELETE), indexes on `user_id`, `feedback_type`, `status`, `created_at`.
- **New: `src/app/api/feedback/route.ts`** – POST endpoint with Zod validation, Upstash rate limiting (10 per day), duplicate detection (same user + product + message within 24h). Returns 201 on success.
- **New: `src/components/feedback/feedback-shared.tsx`** – Shared components: `StarRating`, `CategoryChips`, `FeedbackTextArea` with character counter.
- **New: `src/components/feedback/product-feedback-form.tsx`** – Collapsible form in Product Detail Modal with star rating, category chips, and text area.
- **New: `src/components/feedback/general-feedback-form.tsx`** – Full-page general feedback form.
- **New: `src/components/feedback/post-shopping-prompt.tsx`** – Post-shopping prompt with emoji face rating (maps to 1–5). Appears at most once per trip with 3+ items.
- **New: `src/app/[locale]/feedback/page.tsx`** – General feedback page.
- **New: `src/app/[locale]/admin/feedback-panel.tsx`** – Admin feedback viewer with type/category filter, status management, pagination.
- **New: `src/lib/feedback/feedback-types.ts`** – TypeScript interfaces for feedback data.
- **Modified: `src/components/list/product-detail-modal.tsx`** – Added collapsible product feedback section.
- **Modified: `src/app/[locale]/settings/settings-client.tsx`** – Added "Feedback" link to Settings.
- **Modified: `src/components/list/shopping-list-content.tsx`** – Post-shopping feedback trigger after last item checked off.
- **Modified: `src/lib/api/rate-limit.ts`** – New `feedbackRateLimit` (10 req/day).
- **Modified: `src/messages/de.json` + `en.json`** – Feedback i18n keys.
- **Specs updated:** `FEATURES-FEEDBACK.md` (status: Implemented), `DATA-MODEL.md` (Section 20: Feedback table).

---

## 2026-03-03 – BL-62: Demand-Group Consolidation (Phases 1–3)

### Phase 1: DB Schema
- **New: `supabase/migrations/20260303120000_demand_groups_schema.sql`** – Creates `demand_groups` (code PK, name, name_en, icon, color, sort_position) and `demand_sub_groups` tables, populates ~61 demand groups and ~250 sub-groups, adds `demand_group_code` FK to `products`, RLS policies.
- **Specs updated:** `DATA-MODEL.md` (Section 6c–6e: demand group model, migration strategy).

### Phase 2: Backend Logic
- **Modified: `src/types/index.ts`** – `Product`, `ListItem`, `AisleOrder`, `AggregatedAisleOrder`, `CheckoffSequenceItem` updated to use `demand_group_code` (required). `category_id` marked deprecated. New `DemandGroup` type.
- **Modified: `src/lib/category/assign-category.ts`** – `assignDemandGroup()` uses `demand_groups` table, returns `demand_group_code`. `assignCategory()` deprecated wrapper.
- **Modified: `src/lib/store/aisle-order.ts`** – `getDemandGroupOrderForList()` uses `db.demand_groups` and `demand_group_code`. `getCategoryOrderForList()` deprecated alias.
- **Modified: `src/lib/list/list-helpers.ts`** – `sortAndGroupItems()` primarily uses `demand_group_code`. `sortAndGroupItemsHierarchical()` deprecated (merged).
- **Modified: `src/lib/categories/category-colors.ts`** – `DEMAND_GROUP_COLORS` keyed by demand group codes. `CATEGORY_COLORS` removed.
- **Modified: `src/lib/i18n/category-translations.ts`** – EN/DE maps removed. `translateDemandGroupName()` uses `demand_groups` table. `translateCategoryName()` deprecated.
- **Modified: `src/lib/db/seed-data.ts`** – `SEED_DEMAND_GROUPS` primary, `SEED_CATEGORIES` deprecated alias.
- **New: `supabase/migrations/20260303130000_bl62_demand_group_code_on_items.sql`** – Adds `demand_group_code` to `list_items` and `trip_items`.

### Phase 3: Frontend Migration & Cleanup
- **Modified (many files):** All UI components, API routes, and services migrated from `category_id` to `demand_group_code`.
- **Removed deprecated code:** `SEED_CATEGORIES`, `assignCategory()`, `getCategoryOrderForList()`, `sortAndGroupItemsHierarchical()`, `fetchCategoriesFromSupabase()`, `getCachedCategories()`, `loadCategories()`, `buildCategoryListPrompt()`, `translateCategoryName()`, `getDefaultCategoryId()`, `getAktionsartikelCategoryId()`, `CATEGORY_COLORS`.
- **Modified: `src/types/index.ts`** – `category_id` completely removed from all interfaces.
- **Modified: `src/lib/db/indexed-db.ts`** – `categories` Dexie store dropped (v11). Added IndexedDB auto-recovery for schema upgrade failures.
- **New: `supabase/migrations/20260303140000_bl62_category_id_nullable.sql`** – Makes `category_id` nullable on `list_items`/`trip_items`.
- **New: `supabase/migrations/20260304000000_drop_unused_tables.sql`** – Drops FK constraints, `category_id` columns, and unused legacy tables (`categories`, `aisle_orders`, `aggregated_aisle_orders`).
- **Specs updated:** `DATA-MODEL.md` (Phase status updated, data flow updated), `BACKLOG.md` (BL-62 P1–P3 marked complete, Phase 4 remaining).

---

## 2026-03-03 – Flyer Scroll Fix

- **Modified: `src/app/[locale]/flyer/flyer-page-image.tsx`** – Conditionally prevents default for `wheel` events only when zoomed in. When not zoomed, the page scroll works normally instead of being trapped inside the flyer component.

---

## 2026-03-03 – Product Delta-Sync with IndexedDB Cache

- **Modified: `src/lib/db/indexed-db.ts`** – Dexie version 9: changed `products` table PK from `++id` to `product_id`, added `country` index.
- **Modified: `src/lib/products-context.tsx`** – Implemented `loadFromCache()` for instant startup from IndexedDB, `deltaSync()` for background synchronization using `updated_at` timestamps. On first load: serve cached products immediately, then sync deltas in background. Reduces initial load from full catalog download to near-instant startup after first visit.

---

## 2026-03-03 – Sentry Error Tracking

- **New: `sentry.client.config.ts`** – Client-side Sentry config (2% trace sample rate, replay on error).
- **New: `sentry.server.config.ts`** – Server-side Sentry config.
- **New: `sentry.edge.config.ts`** – Edge runtime Sentry config.
- **New: `src/app/global-error.tsx`** – Global React Error Boundary: captures exceptions via `Sentry.captureException`, shows user-friendly error page with retry button.
- **Modified: `next.config.js`** – Wrapped with `withSentryConfig`. Sentry is optional (graceful skip if not configured).
- **Modified: `src/app/api/process-receipt/route.ts`, `process-photo/route.ts`, `upload-receipt-photo/route.ts`, `process-flyer-page/route.ts`** – Added `Sentry.captureException()` in error handlers.
- **Modified: `.env.example`** – Added `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.
- **Modified: `.gitignore`** – Added `.sentryclirc`.
- **Specs updated:** `ARCHITECTURE.md` (Sentry in Pre-Launch Extensions).

---

## 2026-03-03 – Privacy Page (DSGVO)

- **New: `src/app/[locale]/privacy/page.tsx`** – Server Component, passes locale to client.
- **New: `src/app/[locale]/privacy/privacy-client.tsx`** – Full DSGVO-compliant privacy policy page covering data collection, Supabase/Anthropic/Sentry/Vercel data processing, user rights, deletion, contact.
- **Modified: `src/app/[locale]/settings/settings-client.tsx`** – Added "Datenschutzerklärung" link in Settings.
- **Modified: `src/app/[locale]/login/page.tsx`** – Added privacy policy link on login page.
- **Modified: `src/messages/de.json` + `en.json`** – Privacy page i18n keys.

---

## 2026-03-03 – Additional Security Hardening

- **Modified: `next.config.js`** – Added `headers()` function returning security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`, `Permissions-Policy` (restrictive).
- **Modified: `scripts/reprocess-all-flyers.mjs`** – Removed `NODE_TLS_REJECT_UNAUTHORIZED = "0"` (TLS certificate bypass).
- **Modified: `src/app/api/admin/reclassify-products/route.ts`, `assign-demand-groups/route.ts`, `batch-jobs/route.ts`** – Added Zod schema validation for all admin API routes.
- **Modified: `src/app/api/flyer-processing-status/route.ts`** – Added authentication check and rate limiting (was previously unprotected).
- **Modified: `.env.example`** – Added `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `GOOGLE_GEMINI_API_KEY`.
- **Modified: `src/lib/search/local-search.ts`** – Removed debug `console.table` block.

---

## 2026-03-03 – Documentation & Cleanup

- **Modified: `src/app/api/extract-product-info/route.ts`** – Corrected comment from "ZXing" to "ZBar WASM".
- **Modified: `src/lib/db/seed-category-aliases.ts`, `seed-data.ts`, `seed.ts`** – Cleaned up deprecated seed data markers.
- **Modified: `src/lib/sync/README.md`, `src/lib/search/README.md`, `src/lib/sorting/README.md`** – Updated to reflect current implementations.
- **Modified: `specs/LAUNCH-READINESS.md`** – Blocks 7 (Onboarding) and 8 (PWA) marked DONE.
- **Modified: `specs/BACKLOG.md`** – BL-60, BL-61 marked as DONE.
- **Modified: `specs/FEATURES-ELSEWHERE.md`** – ZBar WASM documented, B3 marked DONE.

---

## 2026-03-02 – Multi-Retailer Receipt Scanning (B3)

- **New: `supabase/migrations/20260302400000_multi_retailer_receipts.sql`** – Adds `retailer TEXT` to `receipts` (backfills existing as 'ALDI'), adds `competitor_product_id UUID` FK to `receipt_items`, new indexes.
- **Modified: `src/lib/retailers/retailers.ts`** – Added ALDI as `HOME_RETAILER` with color config. New helpers: `isHomeRetailer()`, `normalizeRetailerName()`, `SUPPORTED_RETAILER_NAMES`. Hofer variants map to ALDI.
- **Rewritten: `src/app/api/process-receipt/route.ts`** – Multi-retailer receipt prompt (replaces ALDI-only prompt). Three-status validation (valid / unsupported_retailer / not_a_receipt). Branched product matching: ALDI → `products` table, competitors → `competitor_products` (auto-create + price write). Photo cleanup on rejection. Stats upsert for competitor products.
- **Modified: `src/app/[locale]/capture/use-receipt-processing.ts`** – `ReceiptResult` now includes `retailer` field. Error handling for `not_a_receipt` and `unsupported_retailer` with user-facing messages.
- **Modified: `src/app/[locale]/capture/receipt-result-phase.tsx`** – Success screen shows colored retailer badge. Store name shown only when different from retailer name.
- **Rewritten: `src/app/[locale]/receipts/receipts-client.tsx`** – Horizontal retailer filter chips (only for retailers with ≥1 receipt). Colored retailer badges on receipt cards. Empty state for filtered retailer.
- **Modified: `src/app/[locale]/receipts/[receiptId]/page.tsx`** – Retailer badge in receipt header card. Items linked via `competitor_product_id` shown as linked (green ✓).
- **Modified: `src/lib/receipts/receipt-service.ts`** – `ReceiptData` includes `retailer`. `ReceiptItem` includes `competitor_product_id`. Loads competitor product names alongside ALDI product names.
- **Modified: `src/messages/de.json`** – New i18n keys: `receipt.notAReceipt`, `receipt.unsupportedRetailer`, `receipt.unsupportedRetailerNamed`, `receipt.retailerDetected`, `receipts.allRetailers`, `receipts.noReceiptsForRetailer`.
- **Modified: `src/messages/en.json`** – Same new keys in English.
- **Specs updated:** `FEATURES-CAPTURE.md` (multi-retailer scanner section), `DATA-MODEL.md` (receipts.retailer, receipt_items.competitor_product_id), `FEATURES-ELSEWHERE.md` (B3 marked Done), `CHANGELOG.md` (this entry).

---

## 2026-03-02 – "Letzte Einkäufe" restricted to receipt data only

- **Modified: `src/lib/list/recent-list-products.ts`** – Removed `list_items` data source. "Letzte Einkäufe" now exclusively uses `receipt_items` from scanned receipts. This makes the feature more reliable because receipt data reflects actual purchases, while list items may include speculatively added products.
- **Modified: `src/components/search/recent-purchases-panel.tsx`** – Empty state redesigned: receipt/clipboard icon, user-friendly prompt ("Scanne Deinen ersten Kassenzettel…"), and a primary CTA button linking to `/receipts` for scanning.
- **Modified: `src/messages/de.json`** – Updated `recentPurchasesNone` text; added `recentPurchasesScanLink`.
- **Modified: `src/messages/en.json`** – Updated `recentPurchasesNone` text; added `recentPurchasesScanLink`.
- **Specs updated:** `FEATURES-CORE.md` (Quick-Action Chips data source description).

---

## 2026-03-01 – Unified Demand-Group Labels & Per-Group Color Coding

- **Modified: `src/lib/i18n/category-translations.ts`** – `translateCategoryName()` now detects demand-group codes (numeric prefix or "AK-") and converts them to user-friendly labels via new `formatDemandGroupLabel()`. Manual alias overrides for truncated/ugly codes. Both sort modes now consistently show demand-group names instead of app-category names.
- **Modified: `src/lib/categories/category-colors.ts`** – Expanded from 19 app-category colours to ~61 demand-group-specific colours (`DEMAND_GROUP_COLORS` map). Colours organized in families (dairy = blues, meat = reds, bakery = golds, etc.). Old `CATEGORY_COLORS` map retained as fallback for generic items without demand_group.
- **Modified: `src/lib/list/list-helpers.ts`** – `sortAndGroupItems()` now accepts optional `productMetaMap` parameter and populates `demand_group` on each item (matching what `sortAndGroupItemsHierarchical` already does).
- **Modified: `src/components/list/use-list-data.ts`** – Passes `productMetaMap` through to `sortAndGroupItems()` in the `runCategorySort` lambda.
- **Modified: `src/components/list/shopping-list-content.tsx`** – `categoryColor` prop now uses `item.demand_group || item.category_name` (was: `item.category_name` only).
- **New: `specs/BACKLOG.md` BL-62** – Backlog entry for future full consolidation of category system to ALDI demand groups (10-point migration plan).
- **Specs updated:** `FEATURES-CORE.md` (F03 Display + Sort Modes sections updated).

---

## 2026-03-01 – Navigation Restructuring: Capture Page Dissolved

- **Modified: `src/app/[locale]/page.tsx`** – Removed "+" (Capture) link from main page header. Navigation now: Receipts, Flyer, Settings.
- **Modified: `src/app/[locale]/receipts/receipts-client.tsx`** – "+" button and "Ersten Kassenzettel scannen" now open the ReceiptScanner directly (instead of linking to /capture). Scanner imported inline; receipt list refreshes on close.
- **Modified: `src/app/[locale]/admin/admin-client.tsx`** – "Create Product" button added to Products section (moved from capture page). Opens CreateProductModal directly.
- **Note:** `/capture` page still exists as legacy route but is no longer linked from any navigation.
- **Specs updated:** `UI.md` (navigation model, screen flow diagram), `FEATURES-CAPTURE.md` (access section, receipt scanner trigger, create product location).

---

## 2026-03-01 – Search Field & Sort Button Redesign

- **Modified: `src/components/search/product-search.tsx`** – Removed "Aktionsartikel" chip from search field (specials remain accessible via magic keyword "aktionsartikel"). Removed sort chip row below search field. New layout: search field (flex-1) + square sort icon button (46×46px) side by side. Sort button toggles between "My Order" and "Shopping Order" with a 2-second toast confirmation ("Sortierung: …"). Button is visually highlighted (blue border/bg) when "Shopping Order" is active.
- **Modified: `tailwind.config.ts`** – Added `fade-in-down` keyframe and `animate-fade-in` animation for the sort toast.
- **Modified: `src/messages/de.json` + `en.json`** – New `sortToast` translation key.
- **Specs updated:** `FEATURES-CORE.md` (Quick-Action Chips + new Sort Toggle Button section), `UI.md` (wireframe + empty state text).

---

## 2026-03-01 – Category Colour Bar in Shopping Order View

- **New: `src/lib/categories/category-colors.ts`** – One bold colour per app category (19 categories), inspired by ALDI product/packaging appearance. All colours meet WCAG 4.5:1 contrast on white.
- **Modified: `src/components/list/shopping-list-content.tsx`** – In Shopping Order mode, consecutive items of the same category are grouped into container divs with a continuous 4px left colour bar (`border-l-4`). Groups separated by 12px gap (`space-y-3`), items within a group by 4px (`space-y-1`). Helper function `groupConsecutiveByCategory()` added. Removed per-item `categoryColor` prop.
- **Modified: `src/components/list/list-item-row.tsx`** – Removed `categoryColor` prop and all related inline styles (border colour, label colour). Category label reverts to plain grey (`text-aldi-muted`).
- **Specs updated:** `FEATURES-CORE.md` (F03 Display + Sort Modes), `UI.md` (screen wireframe + design language).

---

## 2026-03-01 – F26: Buy Elsewhere + B4: Competitor Product Database

### F26: Buy Elsewhere ("Anderswo kaufen")
- **New: `supabase/migrations/20260301200000_buy_elsewhere.sql`** – Adds `buy_elsewhere_retailer TEXT` to `list_items`.
- **New: `src/lib/retailers/retailers.ts`** – Retailer lists for DE (8) and AT (6), validation helpers.
- **New: `src/components/list/retailer-picker-sheet.tsx`** – Bottom sheet for retailer selection.
- **Modified: `src/types/index.ts`** – `buy_elsewhere_retailer` on `ListItem`, `deferred_reason` extended with `"elsewhere"`.
- **Modified: `src/components/list/list-item-row.tsx`** – Staged right-swipe (60px blue / 100px+ orange), retailer badge with static orange styling, `<span role="button">` for valid HTML nesting.
- **Modified: `src/components/list/shopping-list-content.tsx`** – Elsewhere section UI, pencil icon routing to competitor form.
- **Modified: `src/lib/search/commands.ts`** – Search prefix parsing for full retailer name + product.
- **Modified: `src/app/[locale]/page.tsx`** – `setBuyElsewhere` included in `stableListData` (bug fix).

### B4: Competitor Product Database
- **New: `supabase/migrations/20260301210000_competitor_products.sql`** – `competitor_products` + `competitor_product_prices` tables with RLS.
- **New: `src/lib/competitor-products/competitor-product-service.ts`** – CRUD for competitor products and prices.
- **New: `src/lib/competitor-products/competitor-products-context.tsx`** – React Context Provider with country-filtered download and IndexedDB sync.
- **New: `src/components/list/competitor-product-form-modal.tsx`** – Manual capture form with photo auto-fill via Claude Vision.
- **New: `src/components/list/elsewhere-checkoff-prompt.tsx`** – Lightweight price/photo capture on elsewhere item check-off.
- **New: `src/app/api/extract-product-info/route.ts`** – Lightweight API endpoint: ZXing barcode + Claude Vision (Haiku) to extract name, brand, EAN, price from product photo.
- **Modified: `src/lib/db/indexed-db.ts`** – Schema v8: `competitor_products` store.
- **Modified: `src/components/search/barcode-scanner-modal.tsx`** – 3-tier waterfall: ALDI → competitor → Open Food Facts.
- **Modified: `src/app/[locale]/layout.tsx`** – `CompetitorProductsProvider` wrapper.
- **Modified: `src/messages/de.json` + `en.json`** – 17+ new i18n keys.
- **Specs updated:** `FEATURES-ELSEWHERE.md` (full B4 section + bug fixes), `DATA-MODEL.md` (competitor tables), `ARCHITECTURE.md` (`/api/extract-product-info`).

---

## 2026-02-26 – Block 3: Rate-Limiting & API-Validierung

- **New: `src/lib/api/rate-limit.ts`** – Rate-limit helper with Upstash Redis. Two tiers: `claudeRateLimit` (5 req/hour, for Claude-calling endpoints) and `generalRateLimit` (20 req/min, for storage/continuation endpoints). Graceful degradation when Upstash is not configured (local dev). Helper functions `getIdentifier()` (user_id or IP) and `checkRateLimit()` (returns 429 NextResponse or null).
- **Modified: `src/app/api/process-receipt/route.ts`** – Added Zod schema (`photo_urls` max 5 URLs, `user_id` required) + Claude rate limit check before processing.
- **Modified: `src/app/api/process-photo/route.ts`** – Added Zod schema (`upload_id`, `photo_url` as URL, optional `is_pdf`/`data_extraction` booleans) + Claude rate limit check.
- **Modified: `src/app/api/process-flyer-page/route.ts`** – Added Zod schema (`upload_id`, `flyer_id`, `page_number` int >= 1) + general rate limit check.
- **Modified: `src/app/api/assign-category/route.ts`** – Added Zod schema (`productName` max 500 chars) + Claude rate limit check.
- **Modified: `src/app/api/upload-receipt-photo/route.ts`** – Added Zod schema (`base64` max 5 MB, `user_id`, `index` 0–10, `timestamp`) + general rate limit check.
- **Modified: `src/app/[locale]/capture/receipt-scanner.tsx`** – HTTP 429 responses show localized rate-limit error message instead of generic error.
- **Modified: `src/messages/de.json` + `en.json`** – New translation keys `receipt.rateLimitExceeded` and `capture.rateLimitExceeded`.
- **Packages:** Added `@upstash/ratelimit`, `@upstash/redis`, `zod`.
- **SECURITY-BACKLOG.md** → S5 (Validation) and S6 (API-Schutz) marked as Erledigt.
- **ARCHITECTURE.md** → New section 6.2 "Rate-Limiting & Input Validation".

---

## 2026-02-26 – Block 2: Storage Security (Receipt Photos)

- **New: `supabase/migrations/20260226200000_receipt_photos_bucket.sql`** – Creates private bucket `receipt-photos` (`public: false`) with storage policies: SELECT and INSERT restricted to `auth.uid()::text`-based path (`{userId}/...`).
- **Modified: `src/app/api/upload-receipt-photo/route.ts`** – Uploads to `receipt-photos` bucket (was `product-photos`). Returns signed URL (10 min, for Claude) + storage path (for DB). No more `getPublicUrl()`.
- **Modified: `src/app/[locale]/capture/receipt-scanner.tsx`** – Collects both signed URLs and storage paths from upload response. Sends `photo_paths` alongside `photo_urls` to process-receipt.
- **Modified: `src/app/api/process-receipt/route.ts`** – Saves storage paths (from `photo_paths`) in `receipts.photo_urls` instead of public URLs. Claude still receives signed URLs via `photo_urls`.
- **Modified: `src/app/[locale]/receipts/[receiptId]/page.tsx`** – Generates signed URLs on-demand (5 min) from stored paths for photo display. Backward-compatible with existing public URLs.
- **SECURITY-BACKLOG.md** → S1 (Storage) marked as Erledigt.
- **ARCHITECTURE.md** → Storage diagram updated with `receipt-photos` (private) bucket.

---

## 2026-02-26 – Block 1: Row-Level Security (RLS)

- **New: `supabase/migrations/20260226100000_rls_user_filtering.sql`** – Replaces all open `USING (true)` RLS policies with `auth.uid()::text`-based policies for: `receipts` (SELECT/INSERT/UPDATE/DELETE on `user_id`), `receipt_items` (all ops via JOIN on `receipts.user_id`), `auto_reorder_settings` (SELECT/INSERT/UPDATE/DELETE on `user_id`), `photo_uploads` (SELECT on `user_id`; INSERT/UPDATE removed since handled by Admin Client).
- **Verified: `shopping_lists`, `list_items`, `shopping_trips`, `trip_items`, `user_product_preferences`, `checkoff_sequences`, `sorting_errors`** – Already correctly secured by Block 0 migration with `auth.uid()::TEXT` policies. No changes needed.
- **Verified: Supabase Realtime** – `use-list-data.ts` subscription uses anon-key client which passes through RLS. Continues to work correctly.
- **SECURITY-BACKLOG.md** → S2 (RLS Receipts) and S3 (RLS Photo Uploads) marked as Erledigt.

---

## 2026-02-26 – Block 0: Account, Auth & Multi-Device (F17)

- **New: `src/lib/auth/auth-context.tsx`** – AuthProvider with Supabase Auth (anonymous-first + email/password). Exports `useAuth()` hook and `getCurrentUserId()` helper. Auto-signs in anonymously on first visit.
- **New: `src/lib/auth/auth-helpers.ts`** – One-time migration of IndexedDB data and old device-id-based Supabase data (receipts, auto_reorder_settings) to new auth.uid().
- **New: `src/app/[locale]/login/page.tsx`** – Login/Registration page with email+password, "Ohne Konto fortfahren", and password reset.
- **New: `supabase/migrations/20260226000000_auth_account_migration.sql`** – Removes FK constraints on custom `users` table, changes `user_id` from UUID to TEXT, recreates RLS policies with `auth.uid()::TEXT`.
- **Modified: `src/lib/list/active-list.ts`** – Rewritten from IndexedDB (Dexie) to Supabase queries.
- **Modified: `src/lib/list/archive-trip.ts`** – Rewritten from IndexedDB to Supabase.
- **Modified: `src/lib/list/typical-products.ts`** – Rewritten from IndexedDB to Supabase.
- **Modified: `src/lib/list/last-trip.ts`** – Rewritten from IndexedDB to Supabase.
- **Modified: `src/lib/list/recent-list-products.ts`** – IndexedDB part replaced with Supabase queries.
- **Modified: `src/components/list/use-list-data.ts`** – Uses `getCurrentUserId()`, Supabase Realtime subscription for live sync.
- **Modified: `src/app/[locale]/layout.tsx`** – Wrapped in `<AuthProvider>`.
- **Modified: `src/app/[locale]/settings/settings-client.tsx`** – New "Konto" section at top (login status, sign out, create account).
- **Modified: All files using `getDeviceUserId()`** – Replaced with `getCurrentUserId()` from auth-context (receipt-scanner, receipts-client, product-detail-modal, admin-client, create-product-modal).
- **Modified: `src/messages/de.json` + `en.json`** – New `auth` translation namespace.
- **Deprecated: `src/lib/list/device-id.ts`** – `getDeviceUserId()` marked deprecated, `getOldDeviceId()` added for migration.
- **FEATURES-ACCOUNT.md** → Status: Implemented
- **SECURITY-BACKLOG.md** → S4 (Auth) marked as Erledigt

---

## 2026-02-25 – F23: List Item Comments (Backlog)

- **FEATURES-CORE.md:** New feature F23 "List Item Comments" added to Future Features table and full spec section. Users can add a free-text comment (~5 rows textarea) to any product on the shopping list via the product detail modal. Comment persists until the product is checked off. Auto-reorder and deferred specials preserve comments. Comment stored per list item, not per product. Includes UI mockup, data model changes, lifecycle rules, and affected files list.

---

## 2026-02-25 – Launch Readiness: Account Feature Spec & Preparation

- **FEATURES-ACCOUNT.md:** New file – complete specification for F17 (Accounts & Multi-Device). Covers: Supabase Auth (anonymous-first + email/password), IndexedDB → Supabase migration for shopping list data, Supabase Realtime for live sync, login/registration UI, data migration for existing users, deployment considerations.
- **LAUNCH-READINESS.md:** New file – checklist and implementation plan for Friendly User Test (100–1.000 users). 9 blocks: Account, RLS, Storage Security, Rate-Limiting, Error Tracking, Product Sync, Privacy, Onboarding, PWA. Each block has a corresponding prompt file.
- **prompts/launch-readiness/:** 9 new prompt files (00-account.md through 08-pwa.md) with detailed implementation instructions, affected files, fallstricke, and test plans.
- **FEATURES-CORE.md:** F17 (Accounts) updated from "Phase 3" to "Pre-Launch, Spec ready" with reference to FEATURES-ACCOUNT.md.
- **ARCHITECTURE.md:** Added Pre-Launch Extensions section (Supabase Auth, Realtime, Sentry, Upstash, Zod). Updated Auth section with current vs planned state. Updated State Management with migration plan. Updated Vercel limits to reflect Pro Plan. Updated Monitoring section.
- **README.md:** Added FEATURES-ACCOUNT.md and LAUNCH-READINESS.md to file index. Added Cursor prompt references.

---

## 2026-02-25 – Produktpräferenzen, Dietary Flags & Suchsortierung (F12)

- **Migration:** `20260225000000_product_dietary_flags.sql` – neue Spalten `is_bio`, `is_vegan`, `is_gluten_free`, `is_lactose_free`, `animal_welfare_level` auf `products`.
- **types/index.ts:** `Product` Interface um die 5 neuen Felder erweitert.
- **product-preferences.ts:** Neues Utility (`src/lib/settings/product-preferences.ts`) – liest/schreibt Nutzerpräferenzen in `localStorage`: Allergen-Ausschlüsse (Gluten, Laktose, Nüsse), Bevorzugungen (günstig, Bio, vegan, Tierwohl, Marke/Eigenmarke-Slider).
- **local-search.ts:** Allergen-Filter (`shouldExclude`) und Score-Boost (`computeScore`) implementiert. Ergebnisse werden nach Score absteigend sortiert.
- **settings-client.tsx:** Neue UI-Sektionen "Unverträglichkeiten" (3 Toggles) und "Produktpräferenzen" (4 Toggles + Marke/Eigenmarke-Slider).
- **de.json / en.json:** 14 neue Translation-Keys für Einstellungs-UI.
- **DATA-MODEL.md:** 5 neue Spalten dokumentiert, Status auf Draft v6.
- **FEATURES-CORE.md:** F12 um Dietary Exclusions und Product Preferences erweitert. F22 "Promotional Price Highlighting" als Future Feature hinzugefügt.

---

## 2026-02-25 – Store-Picker entfernt, Handzettel-Verarbeitung, UI-Verbesserungen

- **FEATURES-CORE.md (F04):** Manueller Store-Picker-Button aus dem Header entfernt. Laden-Erkennung erfolgt jetzt ausschließlich über GPS + Default-Store in den Einstellungen.
- **page.tsx:** Store-Button, `StorePickerOverlay`-Import und `storePickerOpen`-State entfernt. "Im Laden"-Badge bleibt erhalten.
- **flyer/[flyerId]/page.tsx:** Auto-Resume für unvollständig verarbeitete Handzettel-Seiten (erkennt status "processing" und "error"), Fortschrittsanzeige, explizites Supabase-Limit von 2000 statt Default 1000.
- **process-flyer-page/route.ts:** Idempotency-Guard gegen doppelte Claude-Aufrufe, `Math.max` für `pages_processed`-Counter.
- **page.tsx (Sortierung):** `sortMode` und `userHasManuallyChosenSort` in sessionStorage persistiert, `useIsomorphicLayoutEffect` für flackerfreie Wiederherstellung, `loading`-Gate im Store-Wechsel-Effect.
- **product-search.tsx:** Aktionsartikel-Panel mit bis zu 100 Specials, sortiert nach Verkaufsstart.
- **settings-client.tsx:** Standard-Laden als kompaktes Dropdown statt permanenter Liste.
- **flyer-page-image.tsx:** Pinch-to-Zoom, bidirektionale Bild-Virtualisierung gegen Memory-Crash auf Mobile.
- **de.json / en.json:** Neue Keys für Handzettel-Fortschritt, Aktionsartikel-Panel; "Nachkauf" statt "automatischer Nachkauf".

---

## 2026-02-24 – Deferred Section + Auto-Reorder Implementation

- **FEATURES-CORE.md:** Rewrote "Deferred Specials" into unified "Deferred Section (Upcoming Items)" covering both specials and auto-reorder. Added full Auto-Reorder spec: data model (`auto_reorder_settings` table), product detail modal UI, check-off flow, duplicate avoidance, deactivation.
- **Migration:** `20260224000000_auto_reorder_settings.sql` – new table with `user_id`, `product_id`, `reorder_value`, `reorder_unit`, `last_checked_at`, `is_active`, RLS policies.
- **list-helpers.ts:** Added `deferred_reason` field (`'special'` | `'reorder'`) to `ListItemWithMeta`.
- **use-list-data.ts:** Loads auto-reorder settings from Supabase, injects deferred reorder items, computes activation dates, updates `last_checked_at` on check-off. Unified activation timer for both types.
- **list-item-row.tsx:** Reason badges "(Aktion)" / "(Nachkauf)" with color-coded styling.
- **product-detail-modal.tsx:** Auto-reorder toggle with interval pickers (value + unit), next reorder date preview.
- **shopping-list-content.tsx:** Date format updated to include weekday.
- **de.json / en.json:** New translation keys for `deferredBadgeSpecial`, `deferredBadgeReorder`, `autoReorder.*`.

---

## 2026-02-23 – Deferred Specials Feature (F03)

- **FEATURES-CORE.md:** New subsection "Deferred Specials (Upcoming Promotions)" under F03 Shopping List. Specials from flyers with a future `special_start_date` appear in a deferred section on the shopping list. They cannot be checked off until activated (day before start at 15:00 local time). Includes display spec, activation rule, live timer, and in-app notification.

---

## 2026-02-20 – Bug Fixes: Duration, Crowdsourcing Removal, Data Extraction Auto-Fill

- **F07 Shopping Duration:** `archive-trip.ts` now calculates trip duration from first to last check-off timestamp instead of list creation time, matching spec.
- **F09 Crowdsourcing Removal:** Removed dead `CrowdsourceStatus` type, `ProductSuggestion` interface, `product_suggestions` IndexedDB table, admin crowdsourcing tab, and `crowdsource_status` field from Product interface and all API insert statements. Updated DATA-MODEL.md, FEATURES-CORE.md, TEST-PRODUKT-ANLEGEN.md.
- **F16 Data Extraction Auto-Fill:** `process-photo` data_extraction handler now looks up existing products by EAN and auto-fills NULL fields (nutrition_info, ingredients, allergens, weight_or_quantity) without overwriting manual entries.

---

## 2026-02-20 – Product Schema: Private Label, Seasonal, Assortment Type Expansion

- **DATA-MODEL.md:** Added `is_private_label` (BOOLEAN, NULL default), `is_seasonal` (BOOLEAN, false default) columns to products table. Updated `assortment_type` allowed values to include `special_food` and `special_nonfood` alongside `daily_range` and `special`.
- **ALDI-DATA-REQUEST.md:** Added field #9 "Private label flag" to Tier 1 Core Data. Renumbered subsequent fields. Updated summary totals (41 fields).
- **Migration:** `20260220200000_products_private_label_seasonal.sql` – adds columns and replaces `assortment_type` CHECK constraint with `('daily_range', 'special', 'special_food', 'special_nonfood')`.
- **Claude prompts:** All flyer/photo processing prompts now request `is_private_label` and `is_seasonal` per product. Reclassify admin route also classifies these fields.
- **API routes:** `process-photo`, `process-flyer-page`, `confirm-photo`, `create-manual`, `reclassify-products` – all persist the new fields on insert and update.

---

## 2026-02-23 – Receipt Scanner: Upload Architecture & Recent Purchases Integration

- **FEATURES-CAPTURE.md:** Rewrote receipt upload flow: photos now uploaded individually via `/api/upload-receipt-photo` (server-side Supabase Storage), then only URLs sent to `/api/process-receipt`. Claude receives URLs directly (`source.type: "url"`). Added camera fallback for iOS, client-side image resize (1600px, JPEG 0.7). Added security notes section referencing SECURITY-BACKLOG.md.
- **ARCHITECTURE.md:** Added new API endpoints: `POST /api/upload-receipt-photo`, `POST /api/process-receipt`. Added security backlog reference.
- **FEATURES-CORE.md:** Updated "Recent Purchases" data sources: now combines IndexedDB list_items + Supabase receipt_items (scanned receipts).
- **SECURITY-BACKLOG.md:** New file – central collection of 6 open security items (S1–S6): public storage bucket, RLS without user filtering, device-ID auth, no input validation, API key abuse protection. Includes recommended implementation order.
- **README.md:** Added SECURITY-BACKLOG.md to file index.

---

## 2025-02-22 – Spec Restructuring & English Translation

- **All files:** Translated all spec files from German to English
- **VISION.md:** New file – product vision, benefits for customers and ALDI, core principles
- **FEATURES.md:** Split into three files: FEATURES-CORE.md (F01-F12), FEATURES-CAPTURE.md (F13), FEATURES-FLYER.md (F14)
- **README.md:** New file – index of all spec files with responsibilities
- Removed: monetization section, privacy-first principle, MVP-specific references from VISION.md
- Updated: "Recent Purchases" from single last trip to 4-week history with quick-action chip

---

## 2025-02-22 – Demand Group Assignment

- **FEATURES-CAPTURE.md:** All Claude prompts now include full demand group/sub-group list. Keyword fallback for unassigned products. Admin batch assignment endpoint.

---

## 2025-02-21 – F14: Flyer Browser

- **FEATURES-FLYER.md:** New feature F14: Weekly flyers as browsable pages, products per page with [+] button. PDF import creates page images and product-to-page mapping.
- **DATA-MODEL.md:** New tables flyers and flyer_pages, Product extended with flyer_id and flyer_page

---

## 2025-02-20 – Three-Level Sorting Algorithm

- **LEARNING-ALGORITHMS.md:** Section 2.4 rewritten: Algorithm now learns on three levels (Demand Group → Sub-Group → Product). Each level has independent layered model with independent weighting.
- **FEATURES-CORE.md:** F03 Mode 2 updated: Three-level hierarchical sorting documented

---

## 2025-02-20 – F13: Photo Product Capture

- **FEATURES-CAPTURE.md:** New feature F13: Photos of products (front/back), receipts, flyers and shelf photos. Cloud processing via Claude Vision API. Auto photo type detection, data extraction, product image cropping, duplicate handling.
- **DATA-MODEL.md:** New table photo_uploads, Product extended with thumbnail_url, photo_source_id, nutrition_info, ingredients, allergens

---

## 2025-02-17 – Two Sort Modes with Auto-Switching

- **FEATURES-CORE.md:** F03 sorting rewritten: Two modes "My Order" (insertion order, for home) and "Shopping Order" (aisle order by demand groups, for in-store). Manual toggle via icon button next to search field + automatic switch on store detection.

---

## 2025-02-17 – Barcode, Demand Groups, Product Data, Future Features

- **DATA-MODEL.md:** New product fields: article_number, ean_barcode, demand_group, demand_sub_group, popularity_score
- **FEATURES-CORE.md:** F02 Barcode scanner added. F03 Grouping by demand groups. Future features Z1-Z6 documented.

---

## 2025-02-17 – Offline Mode Deferred

- **FEATURES-CORE.md:** F10 marked as deferred. MVP is online-only. Spec remains in OFFLINE-STRATEGY.md.

---

## 2025-02-17 – Specials Search & Category Intelligence

- **FEATURES-CORE.md:** "specials" command in search field. Availability display for specials. "Recent purchases" command specified.
- **FEATURES-CORE.md:** F09 Automatic category assignment: 3-layer model (Product DB → Alias table → AI language model)
- **DATA-MODEL.md:** New CategoryAlias table

---

## 2025-02-16 – Initial Creation

- **All files:** First creation of all spec documents (PRODUCT.md, MVP.md, FEATURES.md, UI.md, DATA-MODEL.md, OFFLINE-STRATEGY.md, LEARNING-ALGORITHMS.md, ARCHITECTURE.md)

---

<!-- Template for new entries:

## YYYY-MM-DD – Short description

- **FILENAME.md:** What changed and why

-->
