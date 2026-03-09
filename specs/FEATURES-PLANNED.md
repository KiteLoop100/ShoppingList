# FEATURES-PLANNED.md – Feature Backlog (Prioritized)

> Prioritized backlog of all planned features — the **single source of truth** for "what to build next."
> Each feature is scored by **Nutzen** (user value, 1-10) and **Einfachheit** (implementation ease, 1-10).
> The **Produkt** (Nutzen x Einfachheit) determines priority ranking.
>
> For implemented features see [FEATURES-CORE.md](FEATURES-CORE.md).
> For quick-win items (< half day effort) see [BACKLOG.md](BACKLOG.md) (BL-69 through BL-72).

---

## Priority Backlog

| Rang | ID | Feature | Nutzen | Einfach. | Produkt | Phase | Spec |
|-----:|----|---------|-------:|---------:|--------:|-------|------|
| 1 | F27 | Export / Share List | 8 | 9 | 72 | Phase 2 | below |
| 2 | F31 | Vergessen-Detektor | 8 | 6 | 48 | Phase 2 | below |
| 3 | F32 | 1-Tap Nachkauf | 6 | 8 | 48 | Phase 2 | below |
| 4 | F33 | Haushaltsbudget-Tracker | 8 | 6 | 48 | Phase 2 | below |
| 5 | F34 | Preisgedaechtnis | 7 | 6 | 42 | Phase 2 | below |
| 6 | F15 | Voice Input | 7 | 6 | 42 | Phase 2 | below |
| 7 | F37 | Dark Mode | 6 | 7 | 42 | Phase 2 | below |
| 8 | F38 | Bulk Text Entry | 6 | 7 | 42 | Phase 2 | below |
| 9 | F39 | Listenvorlagen / Templates | 7 | 6 | 42 | Phase 2 | below |
| 10 | BL-65 | Smart Catalog Filters Phase 2 | 5 | 8 | 40 | Phase 2 | [BACKLOG.md](BACKLOG.md) |
| 11 | F35 | Warenkorb-Optimierer | 8 | 5 | 40 | Phase 3 | below |
| 12 | F20 | Recipe Import (URL) | 9 | 4 | 36 | Phase 3 | below |
| 13 | F02-SS | Semantic Search (AI) | 6 | 6 | 36 | Phase 3 | below |
| 14 | F36 | Saisonkalender | 5 | 7 | 35 | Phase 2 | below |
| 15 | F41 | Loyalty Card Wallet | 5 | 7 | 35 | Phase 3 | below |
| 16 | F40 | Multi-Listen | 7 | 5 | 35 | Phase 3 | below |
| 17 | F24 | ALDI Insights | 7 | 4 | 28 | Phase 3 | [FEATURES-INSIGHTS.md](FEATURES-INSIGHTS.md) |
| 18 | F16 | Shared Lists | 9 | 3 | 27 | Phase 4 | — |
| 19 | BL-67 | Auto Store via OSM | 5 | 5 | 25 | Phase 3 | [BACKLOG.md](BACKLOG.md) |
| 20 | F22 | Promotional Price Highlighting | 6 | 4 | 24 | Phase 3 | below |
| 21 | F10 | Offline Mode | 7 | 3 | 21 | Phase 4 | [OFFLINE-STRATEGY.md](OFFLINE-STRATEGY.md) |
| 22 | F28 | Responsive Desktop & Tablet | 5 | 4 | 20 | Phase 3 | [BACKLOG.md](BACKLOG.md), [UI.md](UI.md) §6 |
| 23 | F18 | Analytics Dashboard | 5 | 4 | 20 | Phase 4 | — |
| 24 | — | Smart Savings Notifications | 8 | 2 | 16 | Phase 4 | [FEATURES-NOTIFICATIONS.md](FEATURES-NOTIFICATIONS.md) |
| 25 | F19 | Price Comparison (multi-retailer) | 6 | 2 | 12 | Phase 5 | — |
| 26 | F21 | External Voice Assistants | 5 | 2 | 10 | Phase 5 | — |
| 27 | F30 | ALDI Customer Intelligence | 4 | 2 | 8 | Phase 5 | [FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md](FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md) |

**Quick wins in [BACKLOG.md](BACKLOG.md)** (not ranked here, all < half day): BL-69 PWA App Shortcuts, BL-70 Produktfotos in Einkaufsliste, BL-71 Einkaufsnotizen pro Trip, BL-72 Retailer Memory.

---

## Kassenzettel-Flywheel

Features F31, F33, F34 and F35 form a self-reinforcing retention loop. Each scanned receipt makes the app more valuable:

```
User scans receipt
  |
  +---> Budget updated (F33)            "I need to scan to track my budget"
  +---> Price history grows (F34)       "Butter is 11% more expensive now"
  +---> Forgotten-item detection improves (F31)  "Next time it reminds me of eggs"
  +---> Cart optimizer gets smarter (F35)        "It knows my patterns better"
        |
        +---> User scans next receipt  (retention!)
```

This flywheel is the app's unique competitive moat. No other shopping list app has access to structured receipt data combined with a full product catalog. The features that drive this loop should be prioritized together.

**Recommended build order for the flywheel:** F31 (Vergessen-Detektor) first — it delivers the strongest "wow, this is smart" moment and is the simplest of the four. Then F33 (Budget), F34 (Preisgedaechtnis), F35 (Warenkorb-Optimierer).

---

## Detailed Specs

### F02-SS: Semantic Search (Not Yet Implemented)

> **Status:** None of the files or endpoints listed below exist yet. This is a specification for future implementation.

When a semantic query is detected, the input would be sent to an API endpoint that uses AI to interpret the intent and return matching products.

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

2. AI API call:
   - System prompt with full demand group list + product categories
   - User's dietary preferences injected as context
   - Query: user's semantic input
   - Instruction: Return JSON array of search criteria

3. AI returns structured filter/search instructions:
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

**Result display:**

Semantic search results appear in the same overlay as normal search results, but with an additional header showing the AI interpretation and sort criteria.

**Cost:** ~$0.003-0.008 per semantic search query (small context)

**Rate limiting:** Semantic search shares the AI rate limit. A client-side cooldown of 3 seconds between semantic queries prevents accidental rapid-fire calls.

**Fallback:** If AI API is unavailable or rate-limited, the query falls back to standard keyword search with a toast: "AI-Suche nicht verfügbar - zeige normale Ergebnisse"

**Planned files:**
- `src/lib/search/input-type-detector.ts` - Classification logic
- `src/lib/search/semantic-search-client.ts` - Client-side API call + result handling
- `src/app/api/semantic-search/route.ts` - AI API call + DB query
- `src/components/search/semantic-result-header.tsx` - Result header with explanation

---

### F15: Voice Input (Phase 2)

#### Goal

User taps a microphone button, speaks freely (e.g. "I need milk, two packs of butter, apples and the cheap olive oil"), and the app automatically extracts products and adds them to the shopping list with correct quantities.

#### Technical Flow

```
[Mic Button] -> Speech-to-Text -> Free text string
    -> AI parses text -> Structured product list (JSON)
    -> Each product matched against DB (name similarity, brand, aliases)
    -> Matched products added to list with quantities
    -> Unmatched items added as generic entries
    -> Brief confirmation shown: "Added 4 products to your list"
```

#### Speech-to-Text Options

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| Web Speech API (browser-native) | Free | No API cost, instant | Limited iOS Safari support, accuracy varies |
| OpenAI Whisper API | ~$0.006/min | Reliable, multilingual | Requires API call, slight latency |

Recommendation: Start with Web Speech API, fall back to Whisper if browser doesn't support it.

#### Cost Per Voice Command

- Speech-to-Text: $0.00 (Web Speech API) or ~$0.001 (Whisper)
- AI interpretation: ~$0.001-0.003
- **Total: ~$0.002-0.004 per voice command** (under half a cent)

#### UI

- Microphone icon next to the search field (beside the barcode scanner icon)
- Tap -> listening animation (pulsing circle)
- Speech detected -> brief processing spinner
- Results -> confirmation toast with count of added products

---

### F20: Recipe Import - URL to Shopping List

#### Goal

User pastes a recipe URL (e.g. from chefkoch.de, lecker.de, kitchenstories.com) into the search field. The app extracts all ingredients, matches them to ALDI products, and adds them to the shopping list - with correct quantities adjusted to the desired number of servings.

#### User Flow

```
[Search field] -> User pastes URL -> App detects URL pattern
  -> Loading indicator: "Rezept wird geladen..."
  -> API fetches page, AI extracts recipe data (title, servings, ingredients)
  -> Servings modal appears (adjust portion count)
  -> User confirms
  -> Ingredients matched against product DB
  -> Products added to shopping list
  -> Confirmation: "8 Zutaten hinzugefuegt (3 als ALDI-Produkt, 5 generisch)"
```

#### Technical Flow

```
1. URL Detection
   - Search field input matches URL regex (http(s)://, www.)
   - Supported: Any recipe URL (not limited to specific sites)

2. Recipe Extraction (Server-side)
   POST /api/extract-recipe
   - Server fetches the URL content (HTML)
   - AI parses HTML -> structured recipe JSON (title, servings, ingredients)
   - JSON-LD (schema.org/Recipe) preferred if available on the page

3. Servings Adjustment
   - User picks desired servings (default = original_servings)
   - All amounts scaled proportionally

4. Product Matching (Server-side)
   POST /api/match-recipe-ingredients
   - Each ingredient matched against product DB
   - Quantity calculation: amount needed / product pack size -> packs (rounded up)

5. Add to List
   - Matched products added with calculated quantities
   - Generic items added with amount in the comment field (see F23)
   - Duplicate check: if product already on list -> increase quantity
```

#### "Nur ALDI-Zutaten" Mode

When enabled, AI substitutes ingredients that ALDI doesn't carry with suitable ALDI alternatives. Substitutions are shown in the confirmation screen.

#### Supported Recipe Sites

Works with **any URL** since AI can parse arbitrary HTML. Structured data (JSON-LD with schema.org/Recipe) improves extraction accuracy. Known JSON-LD sites: chefkoch.de, lecker.de, eatsmarter.de, kitchenstories.com, allrecipes.com, bbcgoodfood.com.

#### Cost Per Recipe Import

- **Total: ~$0.01-0.03 per recipe import**

#### Planned Files

- `src/lib/search/url-detection.ts` - URL regex, trigger recipe flow
- `src/components/search/recipe-import-modal.tsx` - Servings picker, confirmation screen
- `src/app/api/extract-recipe/route.ts` - Fetch URL, AI extraction
- `src/app/api/match-recipe-ingredients/route.ts` - DB matching, quantity calculation
- `src/lib/recipes/recipe-types.ts` - TypeScript interfaces
- `src/lib/recipes/ingredient-matcher.ts` - Product matching logic

---

### F22: Promotional Price Highlighting (Phase 3)

Highlight products that currently have a promotional price ("Aktionspreis") in search results and on the shopping list. Requires a new data model for time-bounded prices: a `product_prices` table tracking price history with `valid_from` / `valid_until`, and an `is_promotional` flag. When the promotional period ends, the previous regular price automatically applies again.

**Prerequisites:**
- `product_prices` table with price history and date ranges
- `is_promotional` flag on price records
- Automatic rollback to regular price after promotional period
- Visual indicator (e.g. strikethrough old price + highlighted new price) in search results and list

---

### F27: Export / Share List (Phase 2)

#### Phase 2 -- Simple Export

Export the shopping list as a plain-text list (product name, quantity) to share via email, messenger, clipboard, or other apps. Uses the Web Share API (`navigator.share`) with a fallback to `navigator.clipboard.writeText`.

**Prerequisites:**
- "Teilen" button accessible from the shopping list screen
- Web Share API detection with clipboard fallback
- List formatting function that renders items as readable text
- Include/exclude checked items option

#### Phase 5+ -- Delivery Service Integration

Integration with grocery delivery services (e.g. REWE Lieferservice, Flink, Amazon Fresh, Picnic). Requires product matching, cart handover via API/deeplink, and multi-retailer support leveraging F26.

---

## Lightweight Specs (New Features)

### F31: Vergessen-Detektor

**Goal:** After the user adds 3+ products to the list, suggest products they usually buy together with those items but haven't added yet. Addresses the #1 shopping pain point: forgetting items.

**Key Idea:** Co-occurrence analysis on the user's personal `receipt_items`. Find products that appear in >60% of receipts that also contain the current list products, but are not yet on the list. Show top 3-5 suggestions in a collapsible panel below the active list.

**Data Sources:** `receipt_items` (joined by `receipt_id` for co-occurrence), `list_items` (current list for exclusion), `products` (names + thumbnails).

**Core Query (Supabase RPC):**
```sql
SELECT ri2.product_id, p.name,
       COUNT(DISTINCT ri1.receipt_id) as co_occurrence
FROM receipt_items ri1
JOIN receipt_items ri2 ON ri1.receipt_id = ri2.receipt_id
  AND ri1.product_id != ri2.product_id
JOIN receipts r ON ri1.receipt_id = r.receipt_id
JOIN products p ON ri2.product_id = p.product_id
WHERE r.user_id = $user_id
  AND ri1.product_id = ANY($current_list_product_ids)
  AND ri2.product_id != ALL($current_list_product_ids)
GROUP BY ri2.product_id, p.name
HAVING COUNT(DISTINCT ri1.receipt_id) >= 3
ORDER BY co_occurrence DESC
LIMIT 5
```

**UI:** Collapsible panel: "Auch mitnehmen? Eier (bei 4 von 5 Einkaeufen dabei) [+]". Triggers when list has 3+ DB-linked products. No AI needed.

**Effort:** 1-2 days. Supabase RPC function + suggestion panel component + useEffect trigger.

**Part of:** Kassenzettel-Flywheel (more receipts = better suggestions).

---

### F32: 1-Tap Nachkauf

**Goal:** One button to copy all products from the last completed shopping trip onto the current list. Reduces list creation from 5 minutes to 5 seconds for routine shoppers.

**Key Idea:** Query `trip_items` or `receipt_items` for the most recent trip per retailer. Show a button (or multiple, one per retailer if multi-retailer receipts exist) that adds all items at once with their last quantities.

**Data Sources:** `shopping_trips` + `trip_items`, or `receipts` + `receipt_items` (receipts are more accurate since they reflect actual purchases).

**UI Example:**
```
Letzten Einkauf wiederholen
  ALDI (02.03.) -- 18 Produkte    [Uebernehmen]
  dm (28.02.) -- 6 Produkte       [Uebernehmen]
```

**Differentiation from "Fill with typical products":** "Typical" uses statistical frequency across many trips. "Nachkauf" copies exactly the last trip — perfect for routine households. Both have value; they complement each other.

**Effort:** 1 day. Query last receipt per retailer, bulk-add to list (existing `addListItem` with duplicate check).

---

### F33: Haushaltsbudget-Tracker

**Goal:** Set a monthly grocery budget and track spending based on scanned receipts. Shows progress bar on the main screen.

**Key Idea:** User sets budget in Settings (stored in `user_settings`). Aggregate `receipts.total_amount` by month. Show: spent / budget, remaining, daily allowance, projected total after current cart.

**Data Sources:** `receipts` (total_amount, date), `user_settings` (budget), current list price estimate (F08, already implemented).

**UI Example:**
```
Maerz 2026
[================----]  EUR 287 / EUR 400
Noch EUR 113 fuer 8 Tage (~EUR 14/Tag)
Aktueller Warenkorb: ~EUR 34
```

**Where:** Compact widget on main page (above or below list), expandable. Alternatively in a dedicated section accessible from header.

**Effort:** 1-2 days. Budget field in Settings, receipt aggregation query, progress bar component. Strong retention driver: users must scan receipts to keep budget current.

**Part of:** Kassenzettel-Flywheel.

---

### F34: Preisgedaechtnis

**Goal:** Show personal price trends for products based on the user's own receipt history. Small trend arrows next to prices in the shopping list.

**Key Idea:** For each product with receipt history, compare current price to the average of the last 3 months from `receipt_items`. Show trend: arrow up (more expensive), arrow down (cheaper), arrow right (stable). In product detail: mini price chart.

**Data Sources:** `receipt_items` (price, date, product_id), `products` (current price).

**UI in list:** `Milsani H-Milch 1,5%    2    EUR 0.89 ↓`

**UI after receipt scan:** "3 Produkte sind teurer geworden (+EUR 0.73 gesamt)"

**Effort:** 1-2 days. Aggregation query on receipt_items, trend computation (current vs. 3-month avg), trend icon in `list-item-row.tsx`. No new data model needed.

**Part of:** Kassenzettel-Flywheel.

---

### F35: Warenkorb-Optimierer

**Goal:** Before shopping, automatically show contextual savings tips based on the current list combined with flyer data, purchase history, and pack-size information.

**Key Idea:** Three types of tips, all computed without AI:
1. **Flyer match:** Cross-reference current list products against `flyer_page_products` for active flyers — "Olivenoel ist diese Woche im Angebot"
2. **Eigenmarken-Substitution:** If the user regularly buys a brand product, suggest the cheaper private-label equivalent in the same `demand_group_code` — "Milsani Butter statt Kerrygold: ~EUR 3.20/Monat Ersparnis"
3. **Pack-size optimization:** Compare price-per-unit across pack sizes in the same product family — "6er-Pack Joghurt statt 6x Einzel: -11%"

**Data Sources:** `list_items` + `products`, `flyer_page_products` + `flyers` (active), `receipt_items` (purchase frequency for savings projection), `products.is_private_label` + `products.weight_or_quantity`.

**UI:** Collapsible banner above or below the list: "3 Spartipps fuer deinen Einkauf" with [+] buttons to swap/add products.

**Effort:** 2-3 days. Flyer cross-ref is a simple JOIN. Substitution requires same-category lookup. Pack-size comparison needs unit parsing from `weight_or_quantity`.

**Part of:** Kassenzettel-Flywheel.

---

### F36: Saisonkalender

**Goal:** Show which fruits and vegetables are currently in season in DACH. Products in season get a badge in search results and catalog.

**Key Idea:** A static JSON data file mapping ~50 produce items to their seasonal availability (in-season / storage / import) per month. Match against products in demand groups "Obst", "Gemuese", "Salate" by keyword. Show green badge "In Saison" in search and catalog tiles.

**Data Sources:** Static seasonal data (JSON), `products` (matched by name keywords in produce demand groups).

**Effort:** 1 day. Static data file, keyword matcher, badge component in search results and catalog tiles. No backend, no AI, no new DB tables.

---

### F37: Dark Mode

**Goal:** Dark color scheme alternative, switchable in Settings or following system preference.

**Key Idea:** Use `next-themes` package with Tailwind CSS `darkMode: 'class'` strategy. Add `dark:` variant classes to all components. Store preference in `user_settings` (synced across devices). ALDI brand colors need a dark-mode palette: keep orange `#F37D1E` as accent, use dark blue `#0A1628` as background, `#E5E7EB` for text.

**Effort:** 1-2 days. Setup (next-themes + ThemeProvider) takes 1 hour. The bulk is adding `dark:` classes to all existing components (~30 files). Design challenge: ALDI brand colors in dark context.

---

### F38: Bulk Text Entry

**Goal:** Paste multiple products at once (e.g. from WhatsApp, notes, email) and add them all to the list in one action.

**Key Idea:** When the search field input contains commas, newlines, or "und"/"and" separators AND has 3+ segments, detect as bulk input. Parse into individual items, add each as a generic list item. Show confirmation toast: "5 Produkte hinzugefuegt".

**Detection:** New rule in `input-type-detector.ts`: if input contains `,` or `\n` and splitting produces 3+ non-empty segments, trigger bulk mode.

**Effort:** 1 day. Input detection, split logic, batch `addListItem` calls, confirmation toast. No AI, no backend changes.

---

### F39: Listenvorlagen / Templates

**Goal:** Save the current list as a named template ("Grillparty", "Standard-Wocheneinkauf") and restore it later.

**Key Idea:** New DB tables `list_templates` (template_id, user_id, name, created_at) and `list_template_items` (template_id, product_id, product_name, quantity). "Als Vorlage speichern" button in list header. "Vorlage laden" as magic keyword or in Settings. Loading a template adds all items to the current list (with duplicate check).

**Differentiation from "Fill with typical products":** Typical products are statistical/automatic. Templates are manually curated and named — perfect for recurring events (Grillparty, Weihnachtsbacken) or highly specific standard lists.

**Effort:** 1-2 days. Two DB tables + migration, save/load UI, template list view.

---

### F40: Multi-Listen

**Goal:** Multiple independent shopping lists that the user can switch between. "ALDI Wocheneinkauf", "Grillparty Samstag", "dm Drogerie".

**Key Idea:** The data model already supports multiple lists per user (`shopping_lists` table with `user_id` + `is_active`). The challenge is the UI: currently everything assumes one active list. Needs a list switcher in the header, list creation/rename/delete, and scoping of all list operations to the selected list.

**Relationship to F16 (Shared Lists):** Multi-Listen = one user, multiple independent lists. Shared Lists = multiple users, same list. Both are complementary. Multi-Listen is much simpler and should come first.

**Effort:** 2-3 days. List switcher component, create/rename/delete dialogs, scope `use-list-data.ts` to selected list, update Realtime subscription.

---

### F41: Loyalty Card Wallet

**Goal:** Store loyalty/membership cards (Payback, DeutschlandCard, dm-Karte) digitally. Show barcode at checkout.

**Key Idea:** Scan the card barcode (ZBar WASM already available), store card data in Supabase (card_name, retailer, barcode_value, barcode_format, card_image_url). Display screen renders barcode using a JS barcode library (e.g. `JsBarcode`). Accessible from Settings or as a quick action.

**Note:** ALDI does not have a loyalty program, but with multi-retailer support (F26) this becomes relevant for other stores.

**Effort:** 1-2 days. Scan (existing infra), store (simple table), display (JsBarcode rendering). No AI needed.

---

*Last updated: 2026-03-08*
*See also: [FEATURES-CORE.md](FEATURES-CORE.md) (implemented features), [FEATURES-INSIGHTS.md](FEATURES-INSIGHTS.md) (F24), [FEATURES-NOTIFICATIONS.md](FEATURES-NOTIFICATIONS.md) (Smart Savings Notifications)*
