# FEATURES-PLANNED.md – Planned Features (Detailed Specs)

> Detailed specifications for features that are planned but **not yet implemented**.
> For implemented core features see [FEATURES-CORE.md](FEATURES-CORE.md).
> For implemented feature modules see FEATURES-CAPTURE.md, FEATURES-ELSEWHERE.md, FEATURES-ACCOUNT.md, FEATURES-FEEDBACK.md, FEATURES-FLYER.md.

---

## Overview

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| F02-SS | Semantic Search (AI) | MVP | Spec ready |
| F15 | Voice Input (in-app) | Phase 2 | Planned |
| F20 | Recipe Import (URL) | MVP | Spec ready |
| F22 | Promotional Price Highlighting | Phase 3 | Planned |
| F27 | Export / Share List | Phase 3+ | Planned |

---

## F02-SS: Semantic Search (Not Yet Implemented)

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

## F15: Voice Input (Phase 2)

### Goal

User taps a microphone button, speaks freely (e.g. "I need milk, two packs of butter, apples and the cheap olive oil"), and the app automatically extracts products and adds them to the shopping list with correct quantities.

### Technical Flow

```
[Mic Button] -> Speech-to-Text -> Free text string
    -> AI parses text -> Structured product list (JSON)
    -> Each product matched against DB (name similarity, brand, aliases)
    -> Matched products added to list with quantities
    -> Unmatched items added as generic entries
    -> Brief confirmation shown: "Added 4 products to your list"
```

### Speech-to-Text Options

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| Web Speech API (browser-native) | Free | No API cost, instant | Limited iOS Safari support, accuracy varies |
| OpenAI Whisper API | ~$0.006/min | Reliable, multilingual | Requires API call, slight latency |

Recommendation: Start with Web Speech API, fall back to Whisper if browser doesn't support it.

### Cost Per Voice Command

- Speech-to-Text: $0.00 (Web Speech API) or ~$0.001 (Whisper)
- AI interpretation: ~$0.001-0.003
- **Total: ~$0.002-0.004 per voice command** (under half a cent)

### UI

- Microphone icon next to the search field (beside the barcode scanner icon)
- Tap -> listening animation (pulsing circle)
- Speech detected -> brief processing spinner
- Results -> confirmation toast with count of added products

---

## F20: Recipe Import - URL to Shopping List

### Goal

User pastes a recipe URL (e.g. from chefkoch.de, lecker.de, kitchenstories.com) into the search field. The app extracts all ingredients, matches them to ALDI products, and adds them to the shopping list - with correct quantities adjusted to the desired number of servings.

### User Flow

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

### Technical Flow

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

### "Nur ALDI-Zutaten" Mode

When enabled, AI substitutes ingredients that ALDI doesn't carry with suitable ALDI alternatives. Substitutions are shown in the confirmation screen.

### Supported Recipe Sites

Works with **any URL** since AI can parse arbitrary HTML. Structured data (JSON-LD with schema.org/Recipe) improves extraction accuracy. Known JSON-LD sites: chefkoch.de, lecker.de, eatsmarter.de, kitchenstories.com, allrecipes.com, bbcgoodfood.com.

### Cost Per Recipe Import

- **Total: ~$0.01-0.03 per recipe import**

### Planned Files

- `src/lib/search/url-detection.ts` - URL regex, trigger recipe flow
- `src/components/search/recipe-import-modal.tsx` - Servings picker, confirmation screen
- `src/app/api/extract-recipe/route.ts` - Fetch URL, AI extraction
- `src/app/api/match-recipe-ingredients/route.ts` - DB matching, quantity calculation
- `src/lib/recipes/recipe-types.ts` - TypeScript interfaces
- `src/lib/recipes/ingredient-matcher.ts` - Product matching logic

---

## F22: Promotional Price Highlighting (Phase 3)

Highlight products that currently have a promotional price ("Aktionspreis") in search results and on the shopping list. Requires a new data model for time-bounded prices: a `product_prices` table tracking price history with `valid_from` / `valid_until`, and an `is_promotional` flag. When the promotional period ends, the previous regular price automatically applies again.

**Prerequisites:**
- `product_prices` table with price history and date ranges
- `is_promotional` flag on price records
- Automatic rollback to regular price after promotional period
- Visual indicator (e.g. strikethrough old price + highlighted new price) in search results and list

---

## F27: Export / Share List (Phase 3+)

### Phase 3 -- Simple Export

Export the shopping list as a plain-text list (product name, quantity) to share via email, messenger, clipboard, or other apps. Uses the Web Share API (`navigator.share`) with a fallback to `navigator.clipboard.writeText`.

**Prerequisites:**
- "Teilen" button accessible from the shopping list screen
- Web Share API detection with clipboard fallback
- List formatting function that renders items as readable text
- Include/exclude checked items option

### Phase 5+ -- Delivery Service Integration

Integration with grocery delivery services (e.g. REWE Lieferservice, Flink, Amazon Fresh, Picnic). Requires product matching, cart handover via API/deeplink, and multi-retailer support leveraging F26.

---

*Last updated: 2026-03-07*
*See also: [FEATURES-CORE.md](FEATURES-CORE.md) (implemented features), [FEATURES-INSIGHTS.md](FEATURES-INSIGHTS.md) (F24), [FEATURES-NOTIFICATIONS.md](FEATURES-NOTIFICATIONS.md) (F29)*
