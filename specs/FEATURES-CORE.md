# FEATURES-CORE.md – Core Features (F01-F12)

> Home screen, product search, shopping list, store detection, sorting, settings.
> For photo capture see FEATURES-CAPTURE.md, for flyer browser see FEATURES-FLYER.md.

---

## Feature Overview

| ID | Feature | MVP | Description |
|----|---------|-----|-------------|
| F01 | Home Screen | ✅ | Entry point, "Fill with typical products" |
| F02 | Product Search & Add | ✅ | Live search, generic + specific, personalized ranking |
| F03 | Shopping List | ✅ | Display, check off, quantities, product details |
| F04 | Store Detection | ✅ | GPS-based + default store fallback |
| F05 | Aisle Sorting | ✅ | Self-learning, layered model with fallbacks |
| F06 | Error Feedback | ✅ | Simple "report error" button |
| F07 | Shopping Analytics | ✅ | Background data collection, no dashboard |
| F08 | Price Estimation | ✅ | Estimate based on known prices |
| F09 | Product Database & Admin | ✅ | Admin UI + photo capture |
| F10 | Offline Mode | ❌ | Deferred to later phase, MVP is online-only |
| F11 | Multi-language | ✅ | DE + EN, i18n-ready |
| F12 | Settings | ✅ | Language, default store, admin link |
| F29 | Product Catalog | ✅ | Visual browsing by category, one-tap add-to-list |

---

## F01: Home Screen

Single main screen. Search field on top, shopping list below. Empty list shows "Fill with typical products" button (adds products from at least every second past shopping trip).

---

## F02: Product Search & Add

### Overview

The search field is the app's single universal input. It handles product search, barcode scanning, magic keywords, semantic AI queries, and recipe URL imports. This section provides the summary; detailed specifications are in dedicated documents.

### Input Type Detection

A detection function runs on every keystroke (debounced) and routes input to the appropriate handler:

| Input Type | Detection | Handler | Detail Spec |
|---|---|---|---|
| URL pattern | `http://`, `https://`, `www.` | Recipe Import flow | F20 (below) |
| EAN/barcode | 8 or 13 digits, valid GS1 prefix | Barcode lookup | This document |
| Magic keyword | "letzte einkäufe", "aktionsartikel" etc. | Chip shortcut | This document |
| Semantic query | Comparatives, "für", "ohne", question words, 5+ words | Claude Semantic Search | F02-SS (below) |
| Empty query | No input, search field focused | Smart Default (personal top products) | [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md) §3.1 |
| Product name | Default (none of the above) | Product search & ranking | [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md) |

### Search Field Behavior
- Always visible, fixed at top of main screen
- Results overlay the shopping list completely
- Debounce: 150ms
- Max results: 50

### Search Result Row
Each result row displays: **[Thumbnail 40×40] Product Name [Price]**. A fixed 40px thumbnail slot is always reserved on the left so product names align consistently regardless of whether a thumbnail exists. Thumbnails use the existing 150×150 product images served via `next/image` at 40px display size (automatic optimization to ~1-2 KB). The PWA caches optimized images with CacheFirst strategy for instant repeat loads. Products without a thumbnail show an empty slot.

### Product Search & Ranking

**→ Full specification: [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md)**

Summary of the ranking system:
- **5-layer pipeline:** Input Preprocessing → Query Classification → Candidate Retrieval → Scoring & Ranking → Post-Processing
- **5 weighted scoring signals:** Match Quality, Popularity (global), Personal Relevance (purchase history), User Preferences (dietary), Freshness (specials/seasonality)
- **Key features:** Word boundary analysis (Wein ≠ Weintraube), synonym/hypernym mapping, plural normalization, ALDI prefix stripping, quantity suffix removal
- **Signal weights shift** based on query specificity: short queries favor popularity + personal history, long queries favor match quality
- **All processing is local** (client-side, < 50ms target)

### Quick-Action Chips
Shown inside the search field (right side, when field is empty):
- **"Recent Purchases"** – Products from last 4 weeks, sorted by frequency. Data source: Supabase receipt_items (products from scanned receipts with linked product_id). Only receipt-based purchases are shown; manually added or checked-off list items are excluded. Empty state prompts user to scan their first receipt.

Note: "Specials" is accessible via the magic keyword "aktionsartikel" (see below), not as a visible chip.

### Sort Toggle Button
A square icon button (sort icon: three descending lines) is displayed to the right of the search field. Tapping toggles between "My Order" and "Shopping Order". A brief toast ("Sortierung: …") appears for 2 seconds to confirm the active mode. The button is visually highlighted (blue) when "Shopping Order" is active.

### Magic Keywords

| Input | Action |
|-------|--------|
| "letzte einkäufe", "recent" | Products from last 4 weeks by frequency |
| "aktionsartikel", "specials" | Specials from last 30 days |

### Generic Add via Return Key
Pressing Return adds the typed text as a generic product immediately.

### Barcode Scanner
Camera icon next to search field. EAN scan → product added instantly. Not found → "Product not in database" + suggest option.

### F02-SS: Semantic Search (Planned)

> **Not yet implemented.** Full specification in [FEATURES-PLANNED.md](FEATURES-PLANNED.md#f02-ss-semantic-search-not-yet-implemented).

---

## F03: Shopping List

### Display
- Grouped by Customer Demand Group
- Compact rows: product name, thumbnail (if available), quantity, price
- Estimated total at bottom
- **Category labels:** Both sort modes show the ALDI demand-group name as label below each product name (e.g. "Milch/Sahne/Butter", "Joghurts/Quark"). For items without a linked product (generic free-text entries), the app-category name is shown as fallback (e.g. "Milchprodukte"). Demand-group codes are converted to user-friendly labels by stripping the numeric prefix; manual overrides exist for truncated codes. See `src/lib/i18n/category-translations.ts`.
- **Category colour bar (Shopping Order only):** A continuous 4px vertical bar on the left side groups consecutive items of the same demand group. When the demand group changes, a 12px gap separates the groups visually. This provides immediate orientation -- same-group items form a connected colour block, transitions are obvious at a glance. Colours are bold, ALDI-inspired tones (~61 demand-group-specific colours, keyed by demand group code in `src/lib/categories/category-colors.ts`). Applied only to active (unchecked, non-deferred) items.

### Two Sort Modes
- **"My Order"** (default at home): insertion order, flat list, no colour bar
- **"Shopping Order"** (default in store): hierarchical by Demand Group → Sub-Group → Product (see LEARNING-ALGORITHMS.md), with continuous category colour bar
- Auto-switches when store is detected via GPS

### Interactions
- **Change quantity:** Tap number → iOS-style scroll picker (1-99)
- **Remove:** Swipe left, with undo
- **Defer to next trip:** Swipe right → blue "Nächster Einkauf" button appears on left. Item moves to the deferred section with badge "(Nächster Einkauf)". Swiping right on a manually deferred item reveals "↩" to un-defer it back to the active list.
- **Check off:** Tap circle → checkmark, product moves to bottom (greyed out)
- **Product details:** Tap product name → modal with all product info + "Edit Product" button
- **Last product checked:** "Shopping complete" animation → trip archived

### Deferred Section (Upcoming Items)

The shopping list has a **deferred section** between the active items and the checked items. It contains products that are not yet actionable – either because they are upcoming promotions (specials), scheduled for automatic re-purchase (auto-reorder), or manually deferred by the user ("Nächster Einkauf"). All deferred items share the same visual treatment and are sorted/clustered by date or reason.

**Display:**
```
── Active products (normal sorting) ──────────────
  🟢 Äpfel Granny Smith               1    €1.99
  🟢 Milsani H-Milch 1,5%             2    €0.85

── Ab Di, 04.03. ─────────────────────────────────
  ⚪ Philips Zahnbürste (Aktion)       1   €29.99
  ⚪ Butter (Nachkauf)                 1    €1.49

── Ab Mo, 10.03. ─────────────────────────────────
  ⚪ Toilettenpapier (Nachkauf)        1    €3.49

── Ab Mo. 3. März ────────────────────────────────
  ⚪ Olivenöl (Nächster Einkauf)       1    €4.99

── Abgehakt ──────────────────────────────────────
  ✓  Reis                              1    €1.29
```

**Shared rules for all deferred items:**
- **Section headers:** "Ab {date}" for all deferrals (specials, reorder, manual), clustered chronologically
- **Visual:** Items at reduced opacity, badge next to name
- **Badge:** Small label indicating the reason: "(Aktion)" for specials, "(Nachkauf)" for auto-reorder, "(Nächster Einkauf)" for manual deferral
- **Check-off circle:** Greyed out, not interactive (`pointer-events-none`)
- **Swipe to delete:** Works normally
- **Swipe right (manual deferrals only):** Reveals "↩" button to un-defer back to active list
- **Product detail tap:** Works normally
- **Sort position:** After all active unchecked items, before checked items

**Live activation:**
- A `setTimeout` timer fires at the next activation time across all deferred items
- On timer: automatic `refetch()` → activated items move into the active list, sorted normally
- In-app toast: "{count} Produkte jetzt verfügbar"
- Future: Web Push notification (Phase 2)

#### Deferred Specials (Upcoming Promotions)

**When is a special deferred?**
- `assortment_type` is `special_food` or `special_nonfood` (not `daily_range`)
- `special_start_date` is set and lies in the future
- If `special_start_date` is `null`, the product is immediately active (not deferred)

**Activation rule:**
- Product becomes active on the **day before** `special_start_date` at **15:00 local time**
- Timezone determined by `product.country`: `DE` → `Europe/Berlin`, `AT` → `Europe/Vienna`
- No manual override

**Data source:**
- `special_start_date` extracted from flyer PDFs (Claude Vision in `process-flyer-page`), stored on `products` table
- Flyer `valid_from` used as fallback

#### Auto-Reorder (Automatic Re-Purchase)

Users can configure a recurring purchase interval for any database product (not generic items). After checking off, the product reappears in the deferred section with a countdown, then automatically moves back to the active list.

**Data model – new table `auto_reorder_settings`:**
```sql
CREATE TABLE auto_reorder_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES products(product_id),
  reorder_value INTEGER NOT NULL CHECK (reorder_value >= 1),
  reorder_unit TEXT NOT NULL CHECK (reorder_unit IN ('days', 'weeks', 'months')),
  last_checked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
```

**UI – Product Detail Modal (bottom section, only for DB products):**
```
┌─────────────────────────────────────┐
│ 🔄 Automatischer Nachkauf          │
│                                     │
│ ○ Aus                               │
│ ● Alle  [ 2 ▾]  [ Wochen ▾]       │
│                                     │
│   Scroll picker   Scroll picker     │
│     (1–99)      (Tage/Wochen/Mon.)  │
│                                     │
│ Nächster Nachkauf: Di, 04.03.       │
└─────────────────────────────────────┘
```

- Toggle: Off / On
- Two scroll pickers side by side: number (1–99) + unit (Tage / Wochen / Monate)
- Changes saved to Supabase immediately
- If active and `last_checked_at` is set, show calculated next date
- Deactivation sets `is_active = false`; product stays on list but won't auto-reappear after next check-off

**Flow:**
1. User enables auto-reorder for a product (e.g. "Alle 2 Wochen")
2. User checks off the product during shopping → `last_checked_at` updated in `auto_reorder_settings`
3. Product appears in deferred section with activation date = `last_checked_at` + interval
4. When activation date is reached → product moves to active list (if not already present → duplicate check)
5. Cycle repeats on next check-off

**Duplicate avoidance:**
- When activation date arrives and the product is already on the active list → do nothing

**Deactivation:**
- User can turn off auto-reorder anytime via product detail modal
- Product currently on the list (active or deferred) remains, but no further auto-reordering occurs after next check-off

**Affected files (both Deferred Specials + Auto-Reorder):**
- New Supabase migration for `auto_reorder_settings` table
- `src/lib/list/list-helpers.ts` – `ListItemWithMeta` interface: `is_deferred`, `available_from`, `deferred_reason` (`'special'` | `'reorder'`)
- `src/components/list/use-list-data.ts` – Load auto-reorder settings, deferred calculation for both types, activation timer, `deferred` array
- `src/components/list/shopping-list-content.tsx` – Unified deferred section with date clusters
- `src/components/list/list-item-row.tsx` – Deferred styling, reason badge
- `src/components/list/product-detail-modal.tsx` – Auto-reorder UI (toggle, scroll pickers)
- `src/messages/de.json` + `en.json` – New translation keys

#### Manual Deferral ("Nächster Einkauf")

Users can defer any active (unchecked) item to the next day by swiping right. The item moves to the deferred section and no longer counts toward the current trip. It automatically reactivates the next day (midnight) when the app loads.

**Gesture:**
- Swipe right on an active (unchecked) list item → blue "Nächster Einkauf" button appears on the left
- Tap button → item moves to deferred section under "Ab {tomorrow's date}" header
- On a manually deferred item, swipe right reveals "↩" to un-defer back to the active list

**Data model:**
- `list_items.deferred_until` column (TEXT, nullable) – set to tomorrow's date as `'YYYY-MM-DD'` string
- Computed at runtime: if `deferred_until > today` → `is_deferred = true`, `deferred_reason = 'manual'`, `available_from = deferred_until`
- When `deferred_until <= today` → item is no longer deferred, `deferred_until` is auto-cleared in DB

**Visual treatment:**
- Same as other deferred items (grey background, disabled checkbox)
- Badge: "(Nächster Einkauf)" in grey (`bg-gray-200 text-gray-600`)
- Section header: calendar icon + "Ab {date}" (same format as specials)
- Grouped chronologically with other deferred items

**Reactivation:**
- **Automatic:** The next day (when `deferred_until <= today`), the item appears as a normal active item. The `deferred_until` field is cleared in the DB on load.
- **Manual:** User can un-defer at any time via swipe right → "↩" button.

**Trip completion behavior:**
- When the list is archived as a shopping trip, manually deferred items carry over to the new active list
- The `deferred_until` column is NOT copied → items become active in the next trip

**Affected files:**
- `supabase/migrations/20260228200000_list_items_deferred_until.sql` – New column
- `src/types/index.ts` – `ListItem.deferred_until`
- `src/lib/list/active-list.ts` – Read/write `deferred_until`
- `src/lib/list/list-helpers.ts` – `deferred_reason` includes `'manual'`
- `src/components/list/use-list-data.ts` – `deferItem()`, `undeferItem()`, manual deferral detection
- `src/components/list/list-item-row.tsx` – Bidirectional swipe (right = defer, left = delete)
- `src/components/list/shopping-list-content.tsx` – "Nächster Einkauf" section header, onDefer/onUndefer handlers
- `src/messages/de.json` + `en.json` – `deferToNextTrip`, `deferredBadgeManual`, `deferredSectionNextTrip`

---

## F04: Store Detection

**Initial detection:** GPS-based (100 m radius around known stores — ALDI, REWE, EDEKA, Lidl, or any user-created store). If GPS is unavailable or no store is in range, the default store from Settings is used as fallback. Without store: default category sorting.

**Manual store picker removed (2026-02-25):** The header no longer contains a manual store picker button. Store selection is now fully automatic via GPS detection + default store in Settings. This simplifies the UI and removes a rarely-used control.

**Unknown location → Create Store dialog (2026-03-07):** When GPS finds a position but no known store is within range, the app shows a dialog prompting the user to create a new store. The dialog includes a retailer dropdown (22 known DACH + NZ retailers, plus custom entry), an optional store name field, and the auto-detected address via reverse geocoding (OpenStreetMap Nominatim). The new store is saved to both Supabase and IndexedDB.

**Periodic GPS monitoring:** After the initial detection, the app polls GPS every 90 seconds while open. A `gps_confirmed_in_store` flag on the list tracks whether the user is currently near a store. Hysteresis prevents flickering: enter radius is 100 m, leave radius is 200 m.

**In-store indicator (MVP):** A small "Im Laden" / "In store" badge appears in the header when GPS confirms in-store presence.

**Learning gate:** Pairwise aisle-order learning only runs when `gps_confirmed_in_store` is true (not just when a default store is set). This prevents invalid learning data from home usage. See LEARNING-ALGORITHMS.md section 3.3.

---

## F05: Automatic Aisle Sorting

Core differentiator. Three-level learning algorithm (details in LEARNING-ALGORITHMS.md):

1. **Layer 1:** Store-specific data (highest priority)
2. **Layer 2:** Average across same-chain stores (e.g. all REWEs), with all-stores fallback
3. **Layer 3:** Category clustering (base fallback, demand group `sort_position`)
4. **Layer 4:** Specials zone

**Multi-retailer support (2026-03-07):** The learning algorithm is retailer-agnostic — it operates on demand group codes which are universal across all grocery stores. Layer 2 aggregation scopes pairwise data to stores of the same retailer chain (via `stores.retailer` field). If no same-chain data exists, it falls back to all stores. See `src/lib/store/hierarchical-order.ts`.

---

## F06-F08: Feedback, Analytics, Price Estimation

- **F06:** Simple "Report Error" button in-store. Logged with context.
- **F07:** Background data collection (check-off order, timestamps, store).
- **F08:** Estimated total based on known product prices.

---

## F09: Product Database & Admin

### Admin UI
- Route: /admin (link in settings page)
- Password protected
- Functions: Product CRUD, CSV import, demand group batch assignment, reclassification

### Unified Product Capture Module

A single `ProductCaptureModal` component is used across the entire app for creating and editing products. The retailer field determines the target table: ALDI products are saved to the `products` table, all others to `competitor_products`.

**Call sites:**
- GenericProductPicker: "Produkt anlegen" button below search (creates a new product when no existing one matches)
- ProductDetailModal: "Produkt bearbeiten" button (edits an ALDI product, retailer field hidden)
- Elsewhere section: "Produkt erfassen" button (creates a competitor product)
- CompetitorProductDetailModal: "Produkt bearbeiten" button (edits a competitor product)

**Form fields:** Photo upload (with AI analysis), name, brand, retailer (select), category (demand group), subcategory, EAN barcode, product number, price, weight/quantity, assortment type, dietary criteria (bio, vegan, gluten-free, lactose-free, animal welfare level).

**Photo analysis:** Uses unified endpoint `POST /api/analyze-product-photos` (multi-image pipeline: classify, extract, thumbnail, verify). Auto-fills form fields from extracted data.

**Implementation files:**
- `src/components/product-capture/product-capture-modal.tsx` -- modal shell
- `src/components/product-capture/product-capture-fields.tsx` -- all form fields
- `src/components/product-capture/product-capture-criteria.tsx` -- dietary flag checkboxes
- `src/components/product-capture/hooks/use-product-capture-form.ts` -- form state and photo handling
- `src/components/product-capture/product-capture-save.ts` -- save routing (ALDI vs competitor)
- `src/components/product-capture/photo-upload-section.tsx` -- photo upload UI
- `src/components/product-capture/extracted-info-cards.tsx` -- display extracted nutrition/ingredients

### Automatic Category Assignment (3 Layers)
1. Product database -> category from DB
2. Alias table -> brand names/terms mapped to categories
3. AI fallback -> Claude API assigns, result saved to alias table

---

## F10: Offline Mode (DEFERRED)

Deferred to later phase. MVP is online-only. Spec in OFFLINE-STRATEGY.md.

---

## F11: Multi-language

German (default) + English. Auto-detected from device language. Product names are not translated. i18n via next-intl.

---

## F12: Settings

- Language: DE / EN
- Default store selection
- Dietary exclusions (allergen filtering)
- Product preferences (search ranking boost)
- Link to admin area
- Info / About

### Settings Sync (Cross-Device)

All personal settings are persisted in the Supabase `user_settings` table (one row per user, upserted on save). On each device, localStorage serves as a fast synchronous cache. When the Settings page loads, settings are fetched from Supabase and applied locally; when settings change, the update is written to both localStorage and Supabase.

**Synced fields:** `preferred_language`, `default_store_id`, `exclude_gluten`, `exclude_lactose`, `exclude_nuts`, `prefer_cheapest`, `prefer_brand`, `prefer_bio`, `prefer_vegan`, `prefer_animal_welfare`.

**Fallback:** If the user is anonymous or Supabase is unreachable, settings are read/written to localStorage only (same behavior as before). When the user later signs in, a one-time migration seeds their Supabase row from existing localStorage values.

**Implementation files:**
- `src/lib/settings/settings-sync.ts` — `loadSettings()` / `saveSettings()` with Supabase upsert + localStorage cache
- `src/lib/settings/product-preferences.ts` — synchronous getter (for search) + async save via settings-sync
- `src/lib/settings/default-store.ts` — synchronous getter + async save via settings-sync
- `supabase/migrations/20260227200000_user_settings.sql` — table definition + RLS

### Dietary Exclusions
Users can enable allergen filters that **exclude** matching products from search results:
- **Gluten-free:** Hides products where `is_gluten_free = false` or allergens contain "Gluten"
- **Lactose-free:** Hides products where `is_lactose_free = false` or allergens contain "Laktose"/"Milch"
- **Nut-free:** Hides products where allergens contain "Nuss"/"Mandel"/"Erdnuss"

Each filter is a toggle (on/off). Stored in Supabase `user_settings` (synced across devices) with localStorage as cache.

### Product Preferences
Users can set preferences that **boost** matching products in search result ranking (higher score = listed first):
- **Günstigste Produkte bevorzugen:** Cheaper products ranked higher (+50 – price, capped)
- **Bio-Produkte bevorzugen:** Products with `is_bio = true` get +25 score
- **Vegane Produkte bevorzugen:** Products with `is_vegan = true` get +25 score
- **Tierwohlprodukte bevorzugen:** Products with `animal_welfare_level > 0` get +(level × 8) score
- **Marke vs. Eigenmarke (Slider -2 to +2):** Negative = prefer private label, positive = prefer brand. Score adjustment: ±15 per step based on `is_private_label`

Preferences are stored in Supabase `user_settings` (synced across devices) with localStorage as cache. Applied in `src/lib/search/local-search.ts` via `computeScore()`. Products are sorted by descending score, then alphabetically.

---

## Future Features

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| F15 | Voice Input (in-app) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F16 | Shared Lists | Phase 3 | Planned |
| F17 | Accounts & Multi-Device | Pre-Launch | **Spec ready** → see `FEATURES-ACCOUNT.md` |
| F18 | Analytics Dashboard | Phase 2+ | Planned |
| F19 | Price Comparison (LIDL etc.) | Phase 5 | Planned |
| F20 | Recipe Import (URL → Ingredients) | MVP | **Spec ready** → see `FEATURES-PLANNED.md` |
| F21 | External Voice Assistants (Alexa, Google) | Phase 5 | Planned |
| F22 | Promotional Price Highlighting | Phase 3 | Planned → see `FEATURES-PLANNED.md` |
| F23 | List Item Comments | MVP | **Implemented** |
| F24 | ALDI Insights (AI-powered analytics) | MVP | **Spec ready** → see `FEATURES-INSIGHTS.md` |
| F25 | Customer Feedback | MVP | **Implemented** → see `FEATURES-FEEDBACK.md` |
| F26 | Buy Elsewhere | MVP | **Spec ready** → see `FEATURES-ELSEWHERE.md` |
| F27 | Export / Share List | Phase 3+ | Planned → see `FEATURES-PLANNED.md` |
| F28 | Responsive Multi-Device (Desktop & Tablet) | Pre-Launch | **In progress** → see `UI.md` §6, `ARCHITECTURE.md` §7 |
| F29 | Product Catalog | MVP | **Implemented** → see below |
| F30 | ALDI Customer Intelligence | Phase 5 | Planned → see `FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md` |
| F31 | Vergessen-Detektor (Forgotten Items) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F32 | 1-Tap Nachkauf (Repeat Last Trip) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F33 | Haushaltsbudget-Tracker | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F34 | Preisgedaechtnis (Personal Price History) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F35 | Warenkorb-Optimierer (Cart Savings Tips) | Phase 3 | Planned → see `FEATURES-PLANNED.md` |
| F36 | Saisonkalender (Seasonal Produce) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F37 | Dark Mode | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F38 | Bulk Text Entry (Multi-Add) | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F39 | Listenvorlagen / Templates | Phase 2 | Planned → see `FEATURES-PLANNED.md` |
| F40 | Multi-Listen (Multiple Lists) | Phase 3 | Planned → see `FEATURES-PLANNED.md` |
| F41 | Loyalty Card Wallet | Phase 3 | Planned → see `FEATURES-PLANNED.md` |

---

## F23: List Item Comments (Implemented)

Users can add a free-text comment to any product on the shopping list via the product detail modal. The comment serves as a personal note (e.g. "the one in the blue packaging", "check if on sale").

- **Data model:** `comment` field on `list_items` (TEXT, nullable, max 500 chars). Stored per list item, not per product.
- **UI:** Textarea in product detail modal, auto-saved on blur. Component: `src/components/list/item-comment-section.tsx` with hook `use-item-comment.ts`.
- **Lifecycle:** Comment is preserved through auto-reorder and deferral. Cleared when item is checked off and trip is archived. Copied to `trip_items.comment` for history.

---

## F29: Product Catalog (Katalog)

### Goal

Visual product browsing by category with one-tap add-to-list. Complements the search-first approach with a discovery-oriented view.

### Navigation

- Desktop: "Katalog" link in top navigation bar (between home and flyer)
- Mobile: Grid icon in the header bar

### Layout (3-Panel)

```
+-----------------------------------------------------------+
| [Obst & Gemüse] [Brot] [Milch] [Fleisch] [TK] [...]      |  <-- 14 meta-categories
+--------+--------------------------------------------------+
|        |                                                  |
| Gemüse |  [  Product  ] [  Product  ]                    |
| Obst   |  [  Tile     ] [  Tile     ]                    |
| Salate |  [           ] [           ]                    |
|        |                                                  |
+--------+--------------------------------------------------+
        demand groups          product grid (2 columns)
```

- **Top bar:** 14 meta-categories (consolidation of 61 demand groups via `parent_group` FK). Horizontally scrollable chips.
- **Sidebar / second row:** Demand groups belonging to selected meta-category. "Alle" option shows all. Desktop: vertical sidebar. Mobile: horizontal chip row.
- **Product grid:** 2-column grid of square tiles. Product image fills entire tile (`object-cover`). No product name on tile.

### Meta-Categories

14 meta-category rows in `demand_groups` table (code prefix "M", `parent_group = NULL`). The 61 existing demand groups have their `parent_group` set to point at the appropriate meta-category:

| Meta-Category | Child Demand Groups |
|---|---|
| Obst & Gemüse | Gemüse, Obst, Salate |
| Brot & Backwaren | Bake-Off, Brot/Kuchen, Backartikel |
| Milchprodukte & Eier | H-Milch, Joghurts/Quark, Eier, Margarine, Milch/Sahne/Butter, Käse |
| Fleisch, Fisch & Wurst | Dauerwurst, Frischfleisch, Fisch, Geflügel, Schwein, Wurstwaren, Gekühltes Fleisch, Gekühlter Fisch, Konserven Fleisch/Fisch |
| Feinkost & Fertiggerichte | Konserven, Fertiggerichte/Suppen, Gekühlte Fertiggerichte, Gekühlte Feinkost |
| Tiefkühl | TK Fleisch/Fisch, TK Obst/Gemüse, TK Desserts/Eis, TK Fertiggerichte |
| Getränke | Spirituosen, Sekt, Wein, Bier, Wasser, Funktionsgetränke, Erfrischungsgetränke, Fruchtsäfte, Gekühlte Getränke |
| Kaffee & Tee | Kaffee/Kakao, Tee |
| Süßwaren & Snacks | Bonbons, Schokolade, Gebäck, Saisonartikel, Salzgebäck, Chips, Nüsse, Cerealien |
| Grundnahrungsmittel | Dressings/Öle/Soßen, Konfitüren/Brotaufstriche, Nährmittel |
| Haushalt | Reinigungsmittel, Papierwaren, Folien/Tücher, Haushaltsartikel |
| Körperpflege & Baby | Kosmetik, Körperhygiene, Babyartikel, Apothekenprodukte |
| Tiernahrung | Tiernahrung |
| Aktionsartikel | Aktionsartikel |

### Product Tiles

- Square aspect ratio, full-bleed thumbnail image
- Bottom-right: circular orange "+" button (44px, ALDI orange `#F37D1E`)
- Tap "+": adds product with quantity 1, brief checkmark flash
- If product already on list: quantity badge on top-right, tap "+" increments
- Tap image: opens `ProductDetailModal` (reuse existing component)
- No product name or brand visible on tile (image is sufficient)

### Sorting

Products within a category are sorted by relevance using `scoreForCatalog()` from `src/lib/search/scoring-engine.ts`. This function reuses the same scoring signals as the search pipeline:

- **Popularity** (30%): global popularity score
- **Personal relevance** (35%): purchase frequency + recency
- **User preferences** (20%): dietary preferences (bio, vegan, etc.)
- **Freshness** (15%): active/upcoming specials boost

No `matchScore` signal (no search query involved).

### Affected Files

- `supabase/migrations/20260306100000_catalog_meta_categories.sql`
- `src/app/[locale]/catalog/page.tsx`
- `src/components/catalog/*.tsx` (6 components)
- `src/lib/search/scoring-engine.ts` — `scoreForCatalog()`
- `src/lib/categories/category-service.ts` — `getMetaCategories()`, `getChildGroups()`
- `src/components/layout/app-shell.tsx`, `src/app/[locale]/page.tsx` — nav links
- `src/messages/de.json` + `en.json` — `catalog` namespace

---

---

*Last updated: 2026-03-08*
*See also: [FEATURES-PLANNED.md](FEATURES-PLANNED.md) (prioritized feature backlog, F02-SS through F41), [FEATURES-ACCOUNT.md](FEATURES-ACCOUNT.md) (F17), [LAUNCH-READINESS.md](LAUNCH-READINESS.md)*
