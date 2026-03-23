# FEATURES-PHASE2-SPECS.md — Detailed Specs for Phase 2 Features

> Lightweight specs for features ranked in [FEATURES-PLANNED.md](FEATURES-PLANNED.md).
> These are the highest-priority planned features (Phase 2, Rang 1–9 + 15–17).

---

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

*Last updated: 2026-03-22*
*See also: [FEATURES-PLANNED.md](FEATURES-PLANNED.md) (priority ranking & flywheel strategy)*
