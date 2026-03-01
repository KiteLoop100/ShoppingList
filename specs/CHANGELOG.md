# CHANGELOG.md – Change Log

> Documents all changes to spec files.
> Format: Date, what changed, in which file, why.

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

- **FEATURES-CORE.md:** F03 sorting rewritten: Two modes "My Order" (insertion order, for home) and "Shopping Order" (aisle order by demand groups, for in-store). Manual toggle via tabs + automatic switch on store detection.

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
