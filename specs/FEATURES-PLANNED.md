# FEATURES-PLANNED.md – Feature Backlog (Prioritized)

> Prioritized backlog of all planned features — the **single source of truth** for "what to build next."
> Each feature is scored by **Nutzen** (user value, 1-10) and **Einfachheit** (implementation ease, 1-10).
> The **Produkt** (Nutzen x Einfachheit) determines priority ranking.
>
> For implemented features see [FEATURES-CORE.md](FEATURES-CORE.md).
> For tech-debt and code quality items see [BACKLOG.md](BACKLOG.md).

---

## Priority Backlog

| Rang | ID | Feature | Nutzen | Einfach. | Produkt | Phase | Spec |
|-----:|----|---------|-------:|---------:|--------:|-------|------|
| 1 | F27 | Export / Share List | 8 | 9 | 72 | Phase 2 | [below](#f27-export--share-list-phase-2) |
| 2 | F31 | Vergessen-Detektor | 8 | 6 | 48 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 3 | F32 | 1-Tap Nachkauf | 6 | 8 | 48 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 4 | F33 | Haushaltsbudget-Tracker | 8 | 6 | 48 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 5 | F34 | Preisgedaechtnis | 7 | 6 | 42 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 6 | F15 | Voice Input | 7 | 6 | 42 | Phase 2 | [below](#f15-voice-input-phase-2) |
| 7 | F37 | Dark Mode | 6 | 7 | 42 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 8 | F38 | Bulk Text Entry | 6 | 7 | 42 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 9 | F39 | Listenvorlagen / Templates | 7 | 6 | 42 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 10 | BL-65 | Smart Catalog Filters Phase 2 | 5 | 8 | 40 | Phase 2 | [below](#bl-65-smart-catalog-filters-phase-2) |
| 11 | F35 | Warenkorb-Optimierer | 8 | 5 | 40 | Phase 3 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 12 | F20 | Recipe Import (URL) | 9 | 4 | 36 | Phase 3 | [below](#f20-recipe-import---url-to-shopping-list) |
| 13 | F02-SS | Semantic Search (AI) | 6 | 6 | 36 | Phase 3 | [below](#f02-ss-semantic-search-not-yet-implemented) |
| 14 | F36 | Saisonkalender | 5 | 7 | 35 | Phase 2 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 15 | F41 | Loyalty Card Wallet | 5 | 7 | 35 | Phase 3 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 16 | F40 | Multi-Listen | 7 | 5 | 35 | Phase 3 | [PHASE2-SPECS](FEATURES-PHASE2-SPECS.md) |
| 17 | F24 | ALDI Insights | 7 | 4 | 28 | Phase 3 | [FEATURES-INSIGHTS.md](FEATURES-INSIGHTS.md) |
| 18 | F16 | Shared Lists | 9 | 3 | 27 | Phase 4 | — |
| 19 | BL-67 | Auto Store via OSM | 5 | 5 | 25 | Phase 3 | [below](#bl-67-auto-store-via-osm) |
| 20 | F22 | Promotional Price Highlighting | 6 | 4 | 24 | Phase 3 | [below](#f22-promotional-price-highlighting-phase-3) |
| 21 | F10 | Offline Mode | 7 | 3 | 21 | Phase 4 | [OFFLINE-STRATEGY.md](OFFLINE-STRATEGY.md) |
| 22 | F18 | Analytics Dashboard | 5 | 4 | 20 | Phase 4 | — |
| 23 | — | Smart Savings Notifications | 8 | 2 | 16 | Phase 4 | [FEATURES-NOTIFICATIONS.md](FEATURES-NOTIFICATIONS.md) |
| 24 | F19 | Price Comparison (multi-retailer) | 6 | 2 | 12 | Phase 5 | — |
| 25 | F21 | External Voice Assistants | 5 | 2 | 10 | Phase 5 | — |
| 26 | F30 | ALDI Customer Intelligence | 4 | 2 | 8 | Phase 5 | [FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md](FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md) |

**Implemented:** F42 Haushaltsinventar ([FEATURES-INVENTORY.md](FEATURES-INVENTORY.md)), F43 Scan & Go ([SCAN-AND-GO.md](SCAN-AND-GO.md)), F28 Responsive Desktop & Tablet, BL-69 PWA Shortcuts, BL-70 Produktfotos, BL-71 Einkaufsnotizen, BL-72 Retailer Memory.

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

**Cost:** ~$0.003-0.008 per query | **Rate limiting:** 3s client-side cooldown | **Fallback:** Standard keyword search with toast.

---

### F15: Voice Input (Phase 2)

User taps a microphone button, speaks freely (e.g. "I need milk, two packs of butter, apples and the cheap olive oil"), and the app automatically extracts products and adds them to the shopping list with correct quantities.

**Flow:** `[Mic Button] → Speech-to-Text → AI parses text → Structured product list (JSON) → DB matching → Add to list`

**Speech-to-Text:** Web Speech API (free, browser-native) with Whisper API fallback (~$0.006/min). **Cost per command:** ~$0.002-0.004.

**UI:** Microphone icon next to search field. Tap → pulsing circle → processing spinner → confirmation toast.

---

### F20: Recipe Import - URL to Shopping List

> **Vollständige Spezifikation:** Siehe [F-RECIPE-FEATURES-SPEC.md](F-RECIPE-FEATURES-SPEC.md) — deckt Recipe Import (Feature A), "Was kann ich kochen?" Chat (Feature B), Ingredient→ALDI Matching, Pantry-Vergleich und Supabase-Schema ab.

User pastes a recipe URL into the search field. The app extracts ingredients, matches them to ALDI products, and adds them to the shopping list with correct quantities adjusted to desired servings.

**Flow:** `URL detected → POST /api/extract-recipe (AI) → Servings modal → POST /api/match-recipe-ingredients → Add to list`

**"Nur ALDI-Zutaten" Mode:** AI substitutes ingredients ALDI doesn't carry with suitable alternatives.

Works with **any URL** (AI parses HTML). JSON-LD (schema.org/Recipe) improves accuracy. **Cost:** ~$0.01-0.03 per import.

---

### F22: Promotional Price Highlighting (Phase 3)

Highlight products with promotional prices ("Aktionspreis") in search results and shopping list. Requires `product_prices` table with `valid_from`/`valid_until` and `is_promotional` flag. Visual indicator: strikethrough old price + highlighted new price.

---

### F27: Export / Share List (Phase 2)

**Phase 2:** Export shopping list as plain-text (product name, quantity) via Web Share API (`navigator.share`) with clipboard fallback. "Teilen" button on shopping list screen. Option to include/exclude checked items.

**Phase 5+:** Delivery service integration (REWE Lieferservice, Flink, Amazon Fresh, Picnic) via API/deeplink.

---

### BL-65: Smart Catalog Filters Phase 2

Currently implemented: Preference exclusions (Glutenfrei, Laktosefrei, Vegan, Bio, Tierwohl) + bottom-15% popularity cutoff. Planned extensions: (1) Zeitraum-Filter (nur Angebote dieser Woche), (2) Nährwert-Filter (Kalorien, Zucker), (3) Marken-Favoriten-Filter, (4) "Nur mit Bild" Toggle, (5) Persistierung des Filter-Status in localStorage. Additive Erweiterung, kein Breaking Change.

---

### BL-67: Auto Store via OSM

**Goal:** Automatically create competitor stores when user checks off multiple competitor products in a short time window.

**Trigger:** ≥3 `buy_elsewhere` items checked off in 5 minutes → "wahrscheinlich im Laden".

**Flow:** GPS position → OpenStreetMap Overpass API query (`node["shop"~"supermarket|convenience|discount"](around:100,{lat},{lng})`) → match against `KNOWN_RETAILERS` (lowercase normalization) → auto-create store (`createStore()` + `setListStore()`) if match found, else show `CreateStoreDialog`. Duplicate check: no store within ≤200m radius.

**Privacy:** GPS coordinates only used server-side for store creation, not stored.

---

*Last updated: 2026-03-22*
*See also: [FEATURES-PHASE2-SPECS.md](FEATURES-PHASE2-SPECS.md) (F31-F41 detail specs), [FEATURES-CORE.md](FEATURES-CORE.md) (implemented), [FEATURES-INVENTORY.md](FEATURES-INVENTORY.md) (F42), [SCAN-AND-GO.md](SCAN-AND-GO.md) (F43), [FEATURES-INSIGHTS.md](FEATURES-INSIGHTS.md) (F24), [FEATURES-NOTIFICATIONS.md](FEATURES-NOTIFICATIONS.md)*
