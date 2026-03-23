# FEATURES-CORE.md – Core Features (F01-F12, F23, F29)

> Implemented core features. Specs must support a full rebuild from scratch.
> For photo capture see FEATURES-CAPTURE.md, for flyer browser see FEATURES-FLYER.md.
> For planned features see [FEATURES-PLANNED.md](FEATURES-PLANNED.md).

---

## Feature Overview

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| F01 | Home Screen | ✅ | Entry point, "Fill with typical products" |
| F02 | Product Search & Add | ✅ | Live search, generic + specific, personalized ranking |
| F03 | Shopping List | ✅ | Display, check off, quantities, deferred items, auto-reorder |
| F04 | Store Detection | ✅ | GPS-based + default store fallback |
| F05 | Aisle Sorting | ✅ | Self-learning, layered model with fallbacks |
| F06 | Error Feedback | ✅ | Simple "report error" button |
| F07 | Shopping Analytics | ✅ | Background data collection, no dashboard |
| F08 | Price Estimation | ✅ | Estimate based on known prices |
| F09 | Product Database & Admin | ✅ | Admin UI + unified ProductCaptureModal |
| F10 | Offline Mode | ❌ | Deferred → [OFFLINE-STRATEGY.md](OFFLINE-STRATEGY.md) |
| F11 | Multi-language | ✅ | DE + EN via next-intl |
| F12 | Settings | ✅ | Language, store, dietary exclusions, preferences |
| F23 | List Item Comments | ✅ | Free-text notes per list item |
| F29 | Product Catalog | ✅ | Visual browsing by category, one-tap add-to-list |

---

## F01: Home Screen

Single main screen. Search field on top, shopping list below. Empty list shows "Fill with typical products" button (adds products from at least every second past shopping trip).

---

## F02: Product Search & Add

The search field is the app's single universal input. A detection function routes input to the appropriate handler:

| Input Type | Detection | Handler |
|---|---|---|
| URL pattern | `http://`, `https://`, `www.` | Recipe Import (F20) |
| EAN/barcode | 8 or 13 digits, valid GS1 prefix | Barcode lookup |
| Magic keyword | "letzte einkäufe", "aktionsartikel" | Chip shortcut |
| Semantic query | Comparatives, "für", "ohne", 5+ words | Semantic Search (F02-SS, planned) |
| Empty query | No input | Smart Default (personal top products) |
| Product name | Default | Product search & ranking |

> Details: [F-RECIPE-FEATURES-SPEC.md](F-RECIPE-FEATURES-SPEC.md)

**Search pipeline:** 5-layer (Input → Classification → Retrieval → Scoring → Post-Processing) with 5 weighted scoring signals (Match Quality, Popularity, Personal Relevance, Preferences, Freshness). All client-side, <50ms. Full spec: [SEARCH-ARCHITECTURE.md](SEARCH-ARCHITECTURE.md).

**Search result row:** `[Thumbnail 40×40] Product Name [Price]`. Fixed 40px slot for thumbnail alignment. 150×150 images served via `next/image` at 40px. PWA caches with CacheFirst strategy.

**Sort toggle:** Button next to search field toggles "My Order" ↔ "Shopping Order".

**Quick-Action Chip:** "Recent Purchases" — products from last 4 weeks by frequency. Data: `receipt_items` only (not manually checked-off items).

**Return key:** Adds typed text as generic product. **Barcode scanner:** Camera icon, EAN scan → instant add.

---

## F03: Shopping List

### Display
- Compact rows: thumbnail (52×52, right side), product name, quantity, price
- **Category labels:** ALDI demand-group name below each product name (e.g. "Milch/Sahne/Butter"). Source: `demand_groups.name`. 6 demand groups have manual display overrides in `DEMAND_GROUP_ALIASES_DE` (`src/lib/i18n/category-translations.ts`).
- **Category colour bar (Shopping Order only):** Continuous 4px vertical bar on left groups consecutive items of same demand group. 12px gap between groups. ~61 demand-group-specific colours keyed by code in `category-colors.ts`. Only on active (unchecked, non-deferred) items.

### Two Sort Modes
- **"My Order"** (default at home): insertion order, flat list, no colour bar
- **"Shopping Order"** (default in store): hierarchical by Demand Group → Sub-Group → Product, with colour bar
- Auto-switches when store detected via GPS

### Interactions
- **Check off:** Tap circle → item moves to bottom. Last item checked → trip archived.
- **Quantity:** Tap number → iOS-style scroll picker (1-99)
- **Remove:** Swipe left with undo
- **Defer:** Swipe right → "Nächster Einkauf" button → item moves to deferred section
- **Details:** Tap name → ProductDetailModal

### Deferred Section

Between active and checked items. Contains upcoming specials, auto-reorder items, and manually deferred items.

**Shared visual treatment:** Greyed out, disabled checkbox (`pointer-events-none`), badge next to name indicating reason ("Aktion", "Nachkauf", "Nächster Einkauf"). Section headers: "Ab {date}" clustered chronologically. Swipe-to-delete works. Product detail tap works.

**Live activation:** `setTimeout` fires at next activation time. On timer: `refetch()` → items move to active list. Toast: "{count} Produkte jetzt verfügbar".

#### Deferred Specials

Products with `assortment_type` = `special_food` or `special_nonfood` and future `special_start_date` are deferred.

**Activation rule:** 2 **Werktage** before `special_start_date` at 12:00 local time. **Werktag = Monday–Saturday; Sunday does not count.** Example: sale starts Monday 23 Mar → activation Friday 20 Mar 12:00. Timezone: `DE` → `Europe/Berlin`, `AT` → `Europe/Vienna`. If `special_start_date` is NULL → immediately active.

#### Auto-Reorder

Configurable recurring purchase interval per DB product (not generic items).

**Data model:**
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

**UI in ProductDetailModal:** Toggle On/Off + two scroll pickers (number 1–99 + unit Tage/Wochen/Monate). Shows next reorder date when active.

**Flow:** Enable → check off product → `last_checked_at` updated → product appears deferred with activation = `last_checked_at` + interval → auto-activates → cycle repeats. Duplicate check: if already on active list → do nothing.

#### Manual Deferral

**Data model:** `list_items.deferred_until` (TEXT, nullable, `YYYY-MM-DD` format). If `deferred_until > today` → deferred. When `deferred_until <= today` → auto-cleared in DB, item becomes active.

**Gesture:** Swipe right → "Nächster Einkauf" (sets to tomorrow). On deferred item: swipe right → "↩" to un-defer.

**Trip completion:** Deferred items carry over to new active list. `deferred_until` is NOT copied → items become active in next trip.

---

## F04: Store Detection

**GPS-based:** 200m enter / 350m leave hysteresis. Polls every 90s with exponential backoff (30s to 5min) on errors, auto-recovers. Background → foreground triggers immediate refresh. "Im Laden" badge when confirmed.

**Unknown location → Create Store dialog:** Retailer dropdown (22 known DACH + NZ retailers, plus custom entry), optional store name, auto-detected address via reverse geocoding (OpenStreetMap Nominatim). Saved to Supabase + IndexedDB.

**Learning gate:** Pairwise aisle-order learning only runs when GPS confirms in-store presence (not just default store).

---

## F05: Aisle Sorting

Four-level learning (details in [LEARNING-ALGORITHMS.md](LEARNING-ALGORITHMS.md)):
1. Store-specific pairwise data (highest priority)
2. Same-chain aggregate (with all-stores fallback)
3. Category clustering (demand group `sort_position`)
4. Specials zone

Retailer-agnostic: operates on universal demand group codes.

---

## F06-F08

- **F06 Error Feedback:** "Report Error" button in-store. Logged with context.
- **F07 Analytics:** Background data collection (check-off order, timestamps, store).
- **F08 Price Estimation:** Estimated total based on known product prices.

---

## F09: Product Database & Admin

Admin UI at `/admin` (password protected). Functions: Product CRUD, CSV import, demand group batch assignment.

**Unified ProductCaptureModal** — used across:
1. GenericProductPicker: "Produkt anlegen" (new product)
2. ProductDetailModal: "Produkt bearbeiten" (edit ALDI product)
3. Elsewhere section: "Produkt erfassen" (new competitor product)
4. CompetitorProductDetailModal: "Produkt bearbeiten" (edit competitor)

**Form fields:** Photo upload (AI analysis), name, brand, retailer, category (demand group), subcategory, EAN, product number, price, weight/quantity, assortment type, dietary criteria (bio, vegan, gluten-free, lactose-free, animal welfare level).

**Photo analysis:** `POST /api/analyze-product-photos` (multi-image: classify, extract, thumbnail, verify).

**Category assignment:** 3 layers — DB `demand_group_code` → keyword fallback (~40 patterns) → Gemini AI fallback (~90% accuracy).

---

## F11-F12: Language & Settings

- **F11:** German (default) + English. Auto-detected from device. Product names not translated. i18n via next-intl.
- **F12:** Settings synced to Supabase `user_settings` with localStorage cache. Fallback: localStorage-only if anonymous or Supabase unreachable. On sign-in: one-time migration from localStorage.

**Synced fields:** `preferred_language`, `default_store_id`, `exclude_gluten`, `exclude_lactose`, `exclude_nuts`, `prefer_cheapest`, `prefer_brand`, `prefer_bio`, `prefer_vegan`, `prefer_animal_welfare`.

**Dietary exclusions (filter out):** Gluten-free (hides `is_gluten_free=false`), Lactose-free (hides `is_lactose_free=false`), Nut-free (hides allergens with "Nuss"/"Mandel"/"Erdnuss").

**Product preferences (boost in search ranking):** Günstigste (+50 – price, capped), Bio (`is_bio` +25), Vegan (`is_vegan` +25), Tierwohl (`animal_welfare_level × 8`), Brand slider (-2 to +2, ±15/step based on `is_private_label`).

---

## F23: List Item Comments

Free-text comment per list item (max 500 chars, `list_items.comment` TEXT nullable). Auto-saved on blur. Preserved through deferral/reorder. Cleared on trip archive, copied to `trip_items.comment` for history.

---

## F29: Product Catalog

Visual browsing: 14 meta-categories (top chips) → demand groups (sidebar/chips) → product grid.

**Meta-categories** (in `demand_groups` table, code prefix "M", `parent_group = NULL`):

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

**Product tiles:** 2-col grid, square tiles, full-bleed image (`object-cover`). Bottom-right: orange "+" button (44px, `#F37D1E`). Tap "+": add with qty 1 (flash checkmark). Already on list: quantity badge on top-right, "+" increments. Tap image: opens ProductDetailModal.

**Sorting:** `scoreForCatalog()` — Popularity 30%, Personal relevance 35%, Preferences 20%, Freshness 15%.

---

*Last updated: 2026-03-22*
*See also: [FEATURES-PLANNED.md](FEATURES-PLANNED.md) (planned features), [FEATURES-ACCOUNT.md](FEATURES-ACCOUNT.md) (F17)*
