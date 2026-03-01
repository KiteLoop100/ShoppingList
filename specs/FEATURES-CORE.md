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
- Max results: 20

### Product Search & Ranking

**→ Full specification: [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md)**

Summary of the ranking system:
- **5-layer pipeline:** Input Preprocessing → Query Classification → Candidate Retrieval → Scoring & Ranking → Post-Processing
- **5 weighted scoring signals:** Match Quality, Popularity (global), Personal Relevance (purchase history), User Preferences (dietary), Freshness (specials/seasonality)
- **Key features:** Word boundary analysis (Wein ≠ Weintraube), synonym/hypernym mapping, plural normalization, ALDI prefix stripping, quantity suffix removal
- **Signal weights shift** based on query specificity: short queries favor popularity + personal history, long queries favor match quality
- **All processing is local** (client-side, < 50ms target)

### Quick-Action Chips
Shown below empty search field:
- **"Recent Purchases"** – Products from last 4 weeks, sorted by frequency. Data sources: (1) IndexedDB list_items (products added to shopping list), (2) Supabase receipt_items (products from scanned receipts with linked product_id). Frequencies from both sources are combined.
- **"Specials"** – Current specials from last 30 days

### Magic Keywords

| Input | Action |
|-------|--------|
| "letzte einkäufe", "recent" | Products from last 4 weeks by frequency |
| "aktionsartikel", "specials" | Specials from last 30 days |

### Generic Add via Return Key
Pressing Return adds the typed text as a generic product immediately.

### Barcode Scanner
Camera icon next to search field. EAN scan → product added instantly. Not found → "Product not in database" + suggest option.

### F02-SS: Semantic Search (Claude API)

When a semantic query is detected, the input is sent to a new API endpoint that uses Claude to interpret the intent and return matching products.

**API Endpoint:** `POST /api/semantic-search`

**Request:**
```json
{
  "query": "Schokoladenprodukte mit wenig Zucker",
  "user_id": "auth.uid()",
  "locale": "de"
}
```

**Server-side flow:**
```
1. Load user context (optional, for personalized queries):
   - Recent purchases (last 30 days)
   - Product preferences (dietary settings)
   - Shopping frequency data

2. Claude API call (Sonnet for speed + cost):
   - System prompt with full demand group list + product categories
   - User's dietary preferences injected as context
   - Query: user's semantic input
   - Instruction: Return JSON array of search criteria

3. Claude returns structured filter/search instructions:
   {
     "interpretation": "Chocolate products with low sugar content",
     "search_strategy": "filter",
     "filters": {
       "demand_group": ["Süßwaren & Knabberartikel"],
       "keywords": ["Schokolade", "Schoko"],
       "nutrition_filter": { "field": "sugar_per_100g", "operator": "<", "value": 15 },
       "sort_by": "sugar_ascending"
     },
     "explanation_de": "Schokoladenprodukte mit weniger als 15g Zucker pro 100g",
     "explanation_en": "Chocolate products with less than 15g sugar per 100g"
   }

4. Server applies filters to product DB (Supabase query)
5. Returns filtered + sorted products to client
```

**Personalized queries** (e.g. "Aktionsartikel die mich interessieren könnten"):
```
Claude receives:
  - User's top 20 purchased demand groups (by frequency)
  - User's dietary preferences
  - Current specials list (last 30 days, active only)

Claude returns:
  - Subset of specials matching user's purchase patterns
  - Brief explanation per recommendation ("Du kaufst oft Milchprodukte – dieses Angebot passt dazu")
```

**Result display:**

Semantic search results appear in the same overlay as normal search results, but with an additional header:

```
┌─────────────────────────────────────┐
│ ✨ "Schokolade mit wenig Zucker"    │
│ 8 Produkte gefunden                 │
│ Sortiert nach Zuckergehalt ↑        │
├─────────────────────────────────────┤
│ 🍫 Moser Roth 85% Edelbitter  €1.29│
│    Zucker: 11g/100g                 │
│                              [+]    │
│─────────────────────────────────────│
│ 🍫 Choceur Zartbitter 70%    €0.85│
│    Zucker: 14g/100g                 │
│                              [+]    │
└─────────────────────────────────────┘
```

For personalized queries:
```
┌─────────────────────────────────────┐
│ ✨ Aktionsartikel für dich          │
│ 5 Vorschläge basierend auf deinen   │
│ Einkäufen                           │
├─────────────────────────────────────┤
│ ⭐ Milsani Skyr Natur 450g    €1.49│
│    Du kaufst oft Milchprodukte      │
│                              [+]    │
│─────────────────────────────────────│
│ ⭐ Bio Bananen 1kg             €1.99│
│    Auf deiner Liste: jede Woche     │
│                              [+]    │
└─────────────────────────────────────┘
```

**Cost:** ~$0.003–0.008 per semantic search query (Claude Sonnet, small context)

**Rate limiting:** Semantic search shares the Claude rate limit (5 req/hour/user by default, see ARCHITECTURE.md section 6.2). A client-side cooldown of 3 seconds between semantic queries prevents accidental rapid-fire calls.

**Fallback:** If Claude API is unavailable or rate-limited, the query falls back to standard keyword search with a toast: "AI-Suche nicht verfügbar – zeige normale Ergebnisse"

**Affected files:**
- `src/lib/search/input-type-detector.ts` – NEW: Classification logic
- `src/lib/search/semantic-search-client.ts` – NEW: Client-side API call + result handling
- `src/app/api/semantic-search/route.ts` – NEW: Claude API call + DB query
- `src/components/search/product-search.tsx` – Integration of InputTypeDetector, semantic result display
- `src/components/search/semantic-result-header.tsx` – NEW: Result header with explanation
- `src/messages/de.json` + `en.json` – Translation keys for semantic search UI

---

## F03: Shopping List

### Display
- Grouped by Customer Demand Group
- Compact rows: product name, thumbnail (if available), quantity, price
- Estimated total at bottom

### Two Sort Modes
- **"My Order"** (default at home): insertion order
- **"Shopping Order"** (default in store): hierarchical by Demand Group → Sub-Group → Product (see LEARNING-ALGORITHMS.md)
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

**Initial detection:** GPS-based (100 m radius around ALDI stores). If GPS is unavailable or no store is in range, the default store from Settings is used as fallback. Without store: default category sorting.

**Manual store picker removed (2026-02-25):** The header no longer contains a manual store picker button. Store selection is now fully automatic via GPS detection + default store in Settings. This simplifies the UI and removes a rarely-used control.

**Periodic GPS monitoring:** After the initial detection, the app polls GPS every 90 seconds while open. A `gps_confirmed_in_store` flag on the list tracks whether the user is currently near a store. Hysteresis prevents flickering: enter radius is 100 m, leave radius is 200 m.

**In-store indicator (MVP):** A small "Im Laden" / "In store" badge appears in the header when GPS confirms in-store presence.

**Learning gate:** Pairwise aisle-order learning only runs when `gps_confirmed_in_store` is true (not just when a default store is set). This prevents invalid learning data from home usage. See LEARNING-ALGORITHMS.md section 3.3.

---

## F05: Automatic Aisle Sorting

Core differentiator. Three-level learning algorithm (details in LEARNING-ALGORITHMS.md):

1. **Layer 1:** Store-specific data (highest priority)
2. **Layer 2:** Average across all stores
3. **Layer 3:** Category clustering (base fallback)
4. **Layer 4:** Specials zone

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

### Automatic Category Assignment (3 Layers)
1. Product database → category from DB
2. Alias table → brand names/terms mapped to categories
3. AI fallback → Claude API assigns, result saved to alias table

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
| F15 | Voice Input (in-app) | Phase 2 | Planned |
| F16 | Shared Lists | Phase 3 | Planned |
| F17 | Accounts & Multi-Device | Pre-Launch | **Spec ready** → see `FEATURES-ACCOUNT.md` |
| F18 | Analytics Dashboard | Phase 2+ | Planned |
| F19 | Price Comparison (LIDL etc.) | Phase 5 | Planned |
| F20 | Recipe Import (URL → Ingredients) | MVP | **Spec ready** → see below |
| F21 | External Voice Assistants (Alexa, Google) | Phase 5 | Planned |
| F22 | Promotional Price Highlighting | Phase 3 | Planned |
| F23 | List Item Comments | Phase 2 | Planned |
| F24 | ALDI Insights (AI-powered analytics) | MVP | **Spec ready** → see `FEATURES-INSIGHTS.md` |
| F25 | Customer Feedback | MVP | **Spec ready** → see `FEATURES-FEEDBACK.md` |
| F26 | Buy Elsewhere | MVP | **Spec ready** → see `FEATURES-ELSEWHERE.md` |
| F27 | Export / Share List | Phase 3 | Planned |

---

## F22: Promotional Price Highlighting (Phase 3)

Highlight products that currently have a promotional price ("Aktionspreis") in search results and on the shopping list. Requires a new data model for time-bounded prices: a `product_prices` table tracking price history with `valid_from` / `valid_until`, and an `is_promotional` flag. When the promotional period ends, the previous regular price automatically applies again. The existing `products.price` field becomes a computed/cached current price.

**Prerequisites:**
- `product_prices` table with price history and date ranges
- `is_promotional` flag on price records
- Automatic rollback to regular price after promotional period
- Visual indicator (e.g. strikethrough old price + highlighted new price) in search results and list

---

## F23: List Item Comments (Phase 2)

### Goal

Users can add a free-text comment to any product on the shopping list via the product detail modal. The comment serves as a personal note (e.g. "the one in the blue packaging", "check if on sale", "Peter wants the large size").

### UI – Product Detail Modal

The comment field appears at the bottom of the product detail modal, **above** the "Produkt bearbeiten" button and **below** the Auto-Reorder section.

```
┌─────────────────────────────────────┐
│ Produktdetails                    ✕ │
│                                     │
│ ... (product info, nutrition, etc.) │
│                                     │
│ 🔄 Automatischer Nachkauf    [off] │
│                                     │
│─────────────────────────────────────│
│ 💬 Kommentar                        │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  (textarea, ~5 rows)           │ │
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│  [ Produkt bearbeiten ]             │
└─────────────────────────────────────┘
```

- **Textarea:** ~5 rows height, full width, subtle border
- **Auto-save:** Comment is saved on blur (or after a short debounce while typing, e.g. 500ms)
- **No submit button:** Changes persist automatically
- **Placeholder:** "Notiz zu diesem Produkt…" / "Note about this product…"

### Data Model

The comment is stored on the **list item**, not the product. Each time a product is added to the list, it gets its own (initially empty) comment.

**New field on `list_items` (IndexedDB) / future Supabase `list_items` table:**

| Field | Type | Description |
|-------|------|-------------|
| comment | TEXT (nullable) | Free-text user comment, max 500 characters |

### Comment Lifecycle

The comment persists as long as the list item is active on the shopping list. Deletion rules depend on how the product leaves the list:

| Scenario | Comment behavior |
|----------|-----------------|
| **Normal check-off** | Comment is cleared (set to `null`) when the item is checked off and the trip is archived |
| **Auto-reorder active** | Comment is **preserved** – the product stays on the list (moves to deferred section) and reappears with the same comment |
| **Deferred special** (future `special_start_date`) | Comment is **preserved** while the item is in the deferred section. Cleared only when the item is finally checked off after activation |
| **Swipe to delete** | Comment is deleted together with the list item |
| **Undo after check-off** | Comment is restored (since the check-off is reversed) |

### Implementation Notes

- The comment is stored per list item, so the same product can have different comments on different shopping trips
- When archiving a trip (`archive-trip.ts`): copy `comment` to `trip_items` for history, then clear from `list_items` (unless auto-reorder or deferred)
- The `TripItem` model (section 9 in DATA-MODEL.md) should also get an optional `comment` field to preserve historical comments

### Affected Files

- `src/components/list/product-detail-modal.tsx` – New textarea section
- `src/lib/list/list-helpers.ts` – `comment` field on `ListItemWithMeta`
- `src/lib/list/archive-trip.ts` – Comment clearing logic with auto-reorder/deferred exception
- `src/messages/de.json` + `en.json` – New translation keys (`comment`, `commentPlaceholder`)
- IndexedDB schema: add `comment` field to list_items store

---

## F15: Voice Input (Phase 2)

### Goal

User taps a microphone button, speaks freely (e.g. "I need milk, two packs of butter, apples and the cheap olive oil"), and the app automatically extracts products and adds them to the shopping list with correct quantities.

### Technical Flow

```
[🎤 Mic Button] → Speech-to-Text → Free text string
    → Claude API parses text → Structured product list (JSON)
    → Each product matched against DB (name similarity, brand, aliases)
    → Matched products added to list with quantities
    → Unmatched items added as generic entries
    → Brief confirmation shown: "Added 4 products to your list"
```

### Speech-to-Text Options

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| Web Speech API (browser-native) | Free | No API cost, instant | Limited iOS Safari support, accuracy varies |
| OpenAI Whisper API | ~$0.006/min | Reliable, multilingual | Requires API call, slight latency |

Recommendation: Start with Web Speech API, fall back to Whisper if browser doesn't support it.

### AI Interpretation (Claude API)

Prompt sends the transcribed text + the list of demand groups to Claude Sonnet. Claude returns a JSON array:

```json
[
  { "name": "Milch", "quantity": 1, "match_hint": "generic" },
  { "name": "Butter", "quantity": 2, "match_hint": "brand:Milsani" },
  { "name": "Äpfel", "quantity": 1, "match_hint": "category:Obst" },
  { "name": "Olivenöl", "quantity": 1, "match_hint": "cheap/budget" }
]
```

Each item is then matched against the product database using the existing search logic.

### Cost Per Voice Command

- Speech-to-Text: $0.00 (Web Speech API) or ~$0.001 (Whisper)
- Claude Sonnet interpretation: ~$0.001-0.003
- **Total: ~$0.002-0.004 per voice command** (under half a cent)

### UI

- Microphone icon next to the search field (beside the barcode scanner icon)
- Tap → listening animation (pulsing circle)
- Speech detected → brief processing spinner
- Results → confirmation toast with count of added products
- User can review and adjust the added products on the list

### Edge Cases

- Empty/unclear speech → "I didn't understand that. Please try again."
- Mixed languages (German product names in English UI) → Claude handles multilingual input
- Very long input (>30 seconds) → Split into segments
- No microphone permission → Show explanation and link to browser settings

---

## F20: Recipe Import – URL to Shopping List (MVP)

### Goal

User pastes a recipe URL (e.g. from chefkoch.de, lecker.de, kitchenstories.com) into the search field. The app extracts all ingredients, matches them to ALDI products, and adds them to the shopping list – with correct quantities adjusted to the desired number of servings.

### User Flow

```
[Search field] → User pastes URL → App detects URL pattern
  → Loading indicator: "Rezept wird geladen…"
  → API fetches page, Claude extracts recipe data (title, servings, ingredients)
  → Servings modal appears:

┌─────────────────────────────────────┐
│ 🍳 Spaghetti Carbonara             │
│    (Quelle: chefkoch.de)           │
│                                     │
│ Originalrezept für 4 Personen      │
│                                     │
│ Für wie viele Personen?            │
│         ┌─────────┐                │
│    [-]  │    4    │  [+]           │
│         └─────────┘                │
│                                     │
│ ☐ Nur ALDI-Zutaten verwenden       │
│   (Rezept wird angepasst)          │
│                                     │
│  [ Zutaten zur Liste hinzufügen ]  │
│  [ Abbrechen ]                     │
└─────────────────────────────────────┘

  → User confirms
  → Ingredients matched against product DB
  → Products added to shopping list
  → Confirmation: "8 Zutaten hinzugefügt (3 als ALDI-Produkt, 5 generisch)"
```

### Technical Flow

```
1. URL Detection
   - Search field input matches URL regex (http(s)://, www.)
   - Supported: Any recipe URL (not limited to specific sites)
   - Fallback for unsupported sites: "Recipe could not be extracted"

2. Recipe Extraction (Server-side)
   POST /api/extract-recipe
   - Server fetches the URL content (HTML)
   - Claude parses HTML → structured recipe JSON:
     {
       "title": "Spaghetti Carbonara",
       "source_url": "https://www.chefkoch.de/...",
       "original_servings": 4,
       "ingredients": [
         { "name": "Spaghetti", "amount": 500, "unit": "g" },
         { "name": "Speck", "amount": 200, "unit": "g" },
         { "name": "Eier", "amount": 4, "unit": "Stück" },
         { "name": "Parmesan", "amount": 100, "unit": "g" },
         { "name": "Sahne", "amount": 100, "unit": "ml" },
         { "name": "Knoblauch", "amount": 2, "unit": "Zehe" },
         { "name": "Salz", "amount": null, "unit": "nach Geschmack" },
         { "name": "Pfeffer", "amount": null, "unit": "nach Geschmack" }
       ]
     }
   - JSON-LD (schema.org/Recipe) preferred if available on the page
   - Fallback: Claude interprets raw HTML

3. Servings Adjustment
   - User picks desired servings (default = original_servings)
   - All amounts scaled proportionally: new_amount = amount × (desired / original)

4. Product Matching (Server-side)
   POST /api/match-recipe-ingredients
   - Each ingredient matched against product DB:
     a) Exact product match → specific ALDI product with correct pack size
     b) Category match → best-fitting ALDI product (e.g. "Parmesan" → "Milsani Parmigiano")
     c) No match → generic product with name + required amount as comment
   - Quantity calculation: amount needed ÷ product pack size → number of packs (rounded up)
     Example: Recipe needs 500g spaghetti, ALDI sells 500g packs → quantity 1
     Example: Recipe needs 750g Hackfleisch, ALDI sells 400g packs → quantity 2

5. Add to List
   - Matched products added with calculated quantities
   - Generic items added with amount in the comment field (see F23)
   - Duplicate check: if product already on list → increase quantity
   - Items grouped with a comment referencing the recipe title
```

### "Nur ALDI-Zutaten" Mode (ALDI-Only Mode)

When enabled, Claude receives an additional instruction to substitute ingredients that ALDI doesn't carry with suitable ALDI alternatives:

| Original ingredient | ALDI substitute | Reasoning |
|---------------------|-----------------|-----------|
| Crème fraîche | Milsani Schmand | Similar fat content, works in same dishes |
| Mascarpone | Milsani Frischkäse | Closest ALDI equivalent |
| Pine nuts | Sonnenblumenkerne | Budget-friendly, available at ALDI |
| Fresh basil | TK Basilikum (Kräuter) | Frozen herbs always in stock |

The substitution prompt includes:
- The full ALDI product database (demand groups + product names)
- Instruction to find the closest available product
- Instruction to note substitutions in the confirmation screen

**Substitution confirmation screen:**
```
┌─────────────────────────────────────┐
│ 🍳 Spaghetti Carbonara             │
│    für 4 Personen                   │
│                                     │
│ ✅ Combino Spaghetti 500g    ×1    │
│ ✅ Metzgerfrisch Speck 200g  ×1   │
│ ✅ Frische Eier 10er         ×1    │
│ 🔄 Milsani Parmigiano 200g  ×1    │
│    (statt: Parmesan, frisch)       │
│ ✅ Milsani Schlagsahne 200ml ×1   │
│ ✅ Knoblauch                 ×1    │
│ ── Gewürze (bereits vorhanden?) ── │
│ ⚪ Salz                             │
│ ⚪ Pfeffer                          │
│                                     │
│ ☐ Gewürze/Basics überspringen      │
│                                     │
│  [ Alle hinzufügen ]               │
│  [ Einzeln auswählen ]             │
└─────────────────────────────────────┘
```

- ✅ = exact or close match found
- 🔄 = substituted (original shown below)
- ⚪ = basic ingredient / seasoning (often already at home)
- User can uncheck individual items before adding
- "Einzeln auswählen" opens checkboxes on each item

### Supported Recipe Sites

The feature works with **any URL** since Claude can parse arbitrary HTML. However, structured data (JSON-LD with schema.org/Recipe) significantly improves extraction accuracy. Sites known to use JSON-LD:

- chefkoch.de
- lecker.de
- eatsmarter.de
- kitchenstories.com
- allrecipes.com
- bbcgoodfood.com

For sites without structured data, Claude falls back to HTML content analysis. Success rate may vary.

### Handling Seasonings & Basics

Ingredients like salt, pepper, oil, and sugar are flagged as "basics" that most households already have. The confirmation screen offers a checkbox to skip these. The classification is done by Claude based on common cooking knowledge.

### Cost Per Recipe Import

- URL fetch: negligible
- Claude extraction (HTML → JSON): ~$0.005–0.02 (depends on page size)
- Product matching: ~$0.002–0.005
- **Total: ~$0.01–0.03 per recipe import**

### Edge Cases

- **URL not a recipe page:** "This page doesn't appear to contain a recipe."
- **Recipe in foreign language:** Claude handles multilingual content; ingredients translated to German for matching
- **Very long ingredient list (>30 items):** Processed normally, no limit
- **Ingredient with no reasonable ALDI match (e.g. truffle oil):** Added as generic item with note
- **User already has items on list:** Duplicate check merges quantities
- **Recipe requires equipment (e.g. "Springform 26cm"):** Equipment items filtered out, only food ingredients added
- **Amount unspecified (e.g. "etwas Salz"):** Added as generic with amount "nach Bedarf"

### Affected Files

- `src/lib/search/url-detection.ts` – URL regex, trigger recipe flow
- `src/components/search/recipe-import-modal.tsx` – Servings picker, confirmation screen
- `src/app/api/extract-recipe/route.ts` – Fetch URL, Claude extraction
- `src/app/api/match-recipe-ingredients/route.ts` – DB matching, quantity calculation
- `src/lib/recipes/recipe-types.ts` – TypeScript interfaces for recipe data
- `src/lib/recipes/ingredient-matcher.ts` – Product matching logic
- `src/messages/de.json` + `en.json` – Translation keys

### Future Extensions

- **Recipe history:** Save imported recipes for re-use ("Letzte Rezepte" chip in search)
- **Meal planning:** Import multiple recipes for the week, combined ingredient list
- **Favorites:** Star recipes for quick re-import
- **Manual recipe input:** Type/paste ingredient list directly (without URL)
- **Recipe scaling memory:** Remember preferred servings per recipe

---

## F27: Export / Share List (Phase 3+)

### Phase 3 -- Simple Export

Export the shopping list as a plain-text list (product name, quantity) to share via email, messenger, clipboard, or other apps. Uses the Web Share API (`navigator.share`) with a fallback to `navigator.clipboard.writeText`. The format is a simple, human-readable list without app-specific metadata -- ready to paste into any text context.

**Example output:**

```
Einkaufsliste (12 Produkte):
- 2x Vollmilch 3,5% 1L
- 1x Bio-Eier 10er
- 3x Bananen
- 1x Olivenöl 750ml
...
```

**Prerequisites:**
- "Teilen" button accessible from the shopping list screen (e.g. share icon in the header)
- Web Share API detection with clipboard fallback
- List formatting function that renders items as readable text
- Include/exclude checked items option

### Phase 5+ -- Delivery Service Integration

Integration with grocery delivery services (e.g. REWE Lieferservice, Flink, Getir, Amazon Fresh, Picnic) that can fulfill the shopping list on behalf of the user. This is a long-term vision requiring:

- **Product matching:** Map app products to each delivery service's catalog (fuzzy name matching, EAN-based matching where available)
- **Cart handover:** Transfer the matched product list to the delivery service via API or deeplink
- **Confirmation flow:** Show the user which products were matched, which need manual selection, and the estimated delivery cost
- **Multi-retailer support:** Leverage the "Buy Elsewhere" (F26) retailer assignments to route items to the correct delivery service

---

*Last updated: 2026-03-01*
*See also: FEATURES-ACCOUNT.md (F17), LAUNCH-READINESS.md*
