# FEATURES-INSIGHTS.md – ALDI Insights (F24)

> AI-powered personal shopping analytics and advice.
> Requires access to user's full shopping history (receipts, trips, list items).
> For data model see DATA-MODEL.md, for account/auth see FEATURES-ACCOUNT.md.

---

## 1. Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F24 |
| **Phase** | MVP |
| **Dependencies** | F17 (Account & Auth), F07 (Shopping Analytics background data), Receipt scanning (F13) |
| **Route** | `/[locale]/insights` |
| **Navigation** | Insights icon in bottom navigation (💡 or 📊) |

### Goal

A dedicated page where users get AI-generated insights about their shopping behavior. The AI (Claude) has access to the user's complete data — purchase history, receipts, product preferences, spending patterns — and generates personalized analyses, tips, and recommendations on demand.

This feature turns passive data collection (F07) into active, visible value for the user.

---

## 2. Data Sources (User Context for Claude)

When the user requests an insight, the server assembles a comprehensive context package from the user's data:

| Data Source | Table(s) | What It Provides |
|-------------|----------|------------------|
| **Receipt history** | `receipts`, `receipt_items` | Exact purchases, prices paid, dates, stores |
| **Shopping trips** | `shopping_trips`, `trip_items` | What was planned vs. bought, trip duration |
| **Shopping list** | `shopping_lists`, `list_items` | Current planned purchases |
| **Product details** | `products` (joined) | Nutrition info, categories, organic/vegan flags, prices |
| **Auto-reorder** | `auto_reorder_settings` | Regular purchase patterns |
| **User preferences** | `localStorage` (sent as param) | Dietary settings, preferred store |

**Context assembly endpoint:** `POST /api/insights/context`
- Fetches last 90 days of data (configurable)
- Aggregates into a structured summary (not raw rows — too many tokens)
- Summary includes: total spent, top 20 products by frequency, category breakdown, nutrition averages, spending trend (weekly), organic/vegan ratio

**Token budget:** The assembled context is kept under ~2,000 tokens to allow for a substantial Claude response within cost limits.

---

## 3. UI: Insights Page

### 3.1 Topic Selection (Landing State)

```
┌─────────────────────────────────────┐
│ 💡 ALDI Insights                    │
│                                     │
│ Was möchtest du über dein           │
│ Einkaufsverhalten erfahren?         │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🥗 Gesunde Ernährung            │ │
│ │ Tipps für eine ausgewogenere    │ │
│ │ Ernährung basierend auf deinen  │ │
│ │ Einkäufen                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💰 Günstiger einkaufen          │ │
│ │ Sparpotenziale und günstigere   │ │
│ │ Alternativen                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📊 Ernährungsanalyse            │ │
│ │ Nährwerte, Makros & Kalorien    │ │
│ │ deiner Einkäufe (Annahme:      │ │
│ │ alles wird verspeist)           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💶 Ausgaben-Analyse             │ │
│ │ Wohin fließt dein Geld?         │ │
│ │ Trends und Vergleiche           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🛒 Einkaufsgewohnheiten        │ │
│ │ Muster, Häufigkeiten und       │ │
│ │ Optimierungspotenzial           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ── oder ──                          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 Eigene Frage stellen…       │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│         [ Analyse starten ]         │
│                                     │
│ ⚠️ Für bessere Insights: scanne    │
│ regelmäßig deine Kassenzettel.      │
└─────────────────────────────────────┘
```

### 3.2 Predefined Topics

| Topic | Icon | Claude Instruction Summary |
|-------|------|---------------------------|
| **Gesunde Ernährung** | 🥗 | Analyze nutrition balance, suggest healthier ALDI alternatives, flag high-sugar/high-salt products purchased frequently |
| **Günstiger einkaufen** | 💰 | Identify expensive products with cheaper ALDI alternatives, calculate potential monthly savings, flag brand products that have equivalent private labels |
| **Ernährungsanalyse** | 📊 | Calculate approximate daily calorie/macro intake based on purchases (assuming 2-person household, adjustable). Show protein/carb/fat ratios |
| **Ausgaben-Analyse** | 💶 | Spending by category (pie chart data), weekly/monthly trends, biggest cost drivers, comparison to previous period |
| **Einkaufsgewohnheiten** | 🛒 | Shopping frequency, average trip size, most-bought items, seasonal patterns, time-of-day patterns |

### 3.3 Free Text Input

Below the predefined topics, a text field allows the user to ask any question about their shopping data:

- "Wie viel gebe ich pro Woche für Süßigkeiten aus?"
- "Welche Bio-Produkte kaufe ich am häufigsten?"
- "Kaufe ich genug Obst und Gemüse?"
- "Vergleiche meine Ausgaben Januar vs. Februar"
- "Was könnte ich weglassen, um 20€ pro Woche zu sparen?"

The free text is sent to Claude along with the same user context. Claude interprets the question and generates a relevant analysis.

### 3.4 Result Display

Results are rendered as a well-formatted card with markdown-like content:

```
┌─────────────────────────────────────┐
│ 💰 Günstiger einkaufen              │
│                                     │
│ Basierend auf deinen letzten        │
│ 12 Einkäufen (23.01. – 27.02.)     │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                     │
│ 💡 3 Spar-Tipps:                    │
│                                     │
│ 1. Du kaufst regelmäßig Markenbutter│
│    (Kerrygold, €2.49). Die ALDI     │
│    Eigenmarke Milsani Butter kostet │
│    nur €1.69 – Ersparnis: ~€3.20   │
│    pro Monat.                       │
│                                     │
│ 2. Bei Käse greifst du oft zu       │
│    Leerdammer (€2.99). Der Milsani  │
│    Maasdamer (€1.89) ist eine       │
│    günstige Alternative.            │
│                                     │
│ 3. Tipp: Aktionsartikel vormerken!  │
│    Du kaufst Waschmittel alle       │
│    ~3 Wochen. Im nächsten Flyer     │
│    ist Tandil im Angebot.           │
│                                     │
│ 📈 Geschätztes Sparpotenzial:       │
│    ~€8–12 pro Monat                 │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                     │
│ [🔄 Neue Analyse]  [💬 Nachfragen] │
│                                     │
│ [+ Milsani Butter zur Liste]        │
│ [+ Milsani Maasdamer zur Liste]     │
└─────────────────────────────────────┘
```

**Key features of result display:**
- **Actionable product suggestions** have an `[+ zur Liste]` button → adds product directly to shopping list
- **"Nachfragen" button** opens the free text input pre-filled with the topic context, allowing follow-up questions
- **"Neue Analyse" button** returns to topic selection
- Results are **not stored** in the database (generated fresh each time, stateless)

### 3.5 Minimum Data Requirement

If the user has fewer than 3 receipts or 2 completed shopping trips, the Insights page shows a friendly onboarding message instead of the topic cards:

```
┌─────────────────────────────────────┐
│ 💡 ALDI Insights                    │
│                                     │
│ Noch zu wenig Daten für             │
│ personalisierte Insights.           │
│                                     │
│ So sammelst du Daten:               │
│ ✅ Scanne Kassenzettel nach dem     │
│    Einkauf                          │
│ ✅ Hake Produkte während des        │
│    Einkaufs ab                      │
│                                     │
│ Nach ~3 Einkäufen mit Kassenzettel  │
│ sind die ersten Insights verfügbar. │
│                                     │
│ [📸 Kassenzettel scannen]           │
└─────────────────────────────────────┘
```

---

## 4. Technical Architecture

### 4.1 API Endpoint

**`POST /api/insights/generate`**

```json
{
  "topic": "savings" | "nutrition" | "nutrition_analysis" | "spending" | "habits" | "custom",
  "custom_query": "Wie viel gebe ich für Süßigkeiten aus?",
  "locale": "de",
  "household_size": 2
}
```

**Server-side flow:**
```
1. Authenticate user (auth.uid())
2. Assemble user context:
   - Query receipts + receipt_items (last 90 days)
   - Query shopping_trips + trip_items (last 90 days)
   - Query auto_reorder_settings
   - Join products for nutrition_info, prices, categories
   - Aggregate into summary JSON (~2,000 tokens)
3. Select Claude prompt template based on topic
4. Call Claude API (Sonnet for speed):
   - System: "You are a shopping analyst for ALDI customers..."
   - Context: aggregated user data
   - Instruction: topic-specific analysis prompt
   - Response format: structured markdown with optional product suggestions
5. Parse response, extract product_ids from suggestions
6. Return to client: { analysis_text, suggested_products[] }
```

### 4.2 Claude Prompt Templates

Each predefined topic has a dedicated prompt template stored in `src/lib/insights/prompts/`:

| File | Topic |
|------|-------|
| `savings-prompt.ts` | Günstiger einkaufen |
| `health-prompt.ts` | Gesunde Ernährung |
| `nutrition-prompt.ts` | Ernährungsanalyse |
| `spending-prompt.ts` | Ausgaben-Analyse |
| `habits-prompt.ts` | Einkaufsgewohnheiten |
| `custom-prompt.ts` | Freie Frage (wraps user input) |

All prompts share a common preamble with the user context. Each adds topic-specific instructions and output format requirements.

### 4.3 Response Format

Claude is instructed to return a JSON object:

```json
{
  "title": "3 Spar-Tipps für deinen Einkauf",
  "sections": [
    {
      "content": "Du kaufst regelmäßig Markenbutter (Kerrygold, €2.49)...",
      "suggested_product_id": "uuid-of-milsani-butter",
      "suggested_product_name": "Milsani Deutsche Markenbutter"
    }
  ],
  "summary": "Geschätztes Sparpotenzial: ~€8–12 pro Monat",
  "follow_up_suggestions": [
    "Zeige mir alle Eigenmarken-Alternativen",
    "Wie hoch sind meine Fixkosten pro Woche?"
  ]
}
```

The client renders this as formatted cards. `follow_up_suggestions` are shown as tappable chips that populate the free text field.

### 4.4 Household Size

The Ernährungsanalyse topic requires a household size to estimate per-person intake. This is asked once (stored in `localStorage` as `insights_household_size`) and shown as an adjustable field:

```
Haushaltsgröße: [ 2 ▾ ] Personen
(Für die Berechnung pro Person)
```

Default: 2. Range: 1–8.

---

## 5. Cost & Rate Limiting

| Metric | Value |
|--------|-------|
| **Claude model** | Sonnet (balance of speed + quality) |
| **Context size** | ~2,000 tokens (aggregated data) |
| **Response size** | ~500–1,000 tokens |
| **Cost per insight** | ~$0.005–0.015 |
| **Rate limit** | Shares Claude rate limit: 5 req/hour/user |

**Client-side guardrail:** After generating an insight, the "Analyse starten" button shows a 10-second cooldown timer to prevent rapid consecutive calls.

---

## 6. Privacy & Data Handling

- All analysis happens server-side — user data is sent to Claude API but **not stored** by Anthropic (API data retention policy: zero days)
- No insights are stored in the database — they are ephemeral, generated fresh each time
- User data never leaves the Supabase → Vercel → Claude API pipeline
- The Insights page includes a small info text: "Deine Daten werden nur für diese Analyse verwendet und nicht gespeichert."
- Household size is stored locally only (`localStorage`)

---

## 7. Affected Files

### New Files

| File | Purpose |
|------|---------|
| `src/app/[locale]/insights/page.tsx` | Server component wrapper |
| `src/app/[locale]/insights/insights-client.tsx` | Client component: state machine, auth-wait, AbortController, cooldown |
| `src/app/api/insights/generate/route.ts` | API route: auth, validation, rate-limit, context assembly, Claude call |
| `src/lib/insights/types.ts` | Zod schemas (request + response), InsightTopic, TOPIC_PROMPT_MAP |
| `src/lib/insights/context-assembler.ts` | Main aggregation function (Promise.allSettled) |
| `src/lib/insights/context-queries.ts` | Supabase query functions, parseNutritionSafe |
| `src/lib/insights/format-context.ts` | formatContextForPrompt with 8k-char hard truncation |
| `src/lib/insights/prompts/shared-preamble.ts` | System prompt with JSON format instructions |
| `src/lib/insights/prompts/savings-prompt.ts` | Prompt template: savings |
| `src/lib/insights/prompts/health-prompt.ts` | Prompt template: healthy eating (topic enum: "nutrition") |
| `src/lib/insights/prompts/nutrition-prompt.ts` | Prompt template: nutrition analysis (topic enum: "nutrition_analysis") |
| `src/lib/insights/prompts/spending-prompt.ts` | Prompt template: spending |
| `src/lib/insights/prompts/habits-prompt.ts` | Prompt template: habits |
| `src/lib/insights/prompts/custom-prompt.ts` | Prompt template: free question |
| `src/components/insights/topic-card.tsx` | Reusable topic selection card |
| `src/components/insights/insight-result.tsx` | Result display with follow-up chips |
| `src/components/layout/mobile-header.tsx` | Extracted mobile header (from page.tsx) with 7 nav icons |
| `src/lib/insights/__tests__/context-assembler.test.ts` | 28 unit tests |

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/app-shell.tsx` | Added Insights entry to desktop nav bar |
| `src/app/[locale]/page.tsx` | Extracted mobile header into `mobile-header.tsx`, reduced from 408 to 338 lines |
| `src/messages/de.json` | Added `insights` namespace (31 keys) |
| `src/messages/en.json` | Added `insights` namespace (31 keys) |

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| No receipts scanned | Show onboarding message (section 3.5) |
| Only 1–2 receipts | Generate basic insights with disclaimer: "Mehr Daten = bessere Insights" |
| No nutrition data on products | Skip nutrition-dependent topics, show info: "Nährwertdaten werden laufend ergänzt" |
| Claude API unavailable | "Insights sind gerade nicht verfügbar. Bitte versuche es später." |
| User asks harmful question | Claude's built-in safety filters apply; response is generic and non-harmful |
| Very old data only (>6 months) | Disclaimer: "Basierend auf älteren Einkaufsdaten – scanne aktuelle Kassenzettel für bessere Ergebnisse" |

---

## 9. Future Extensions

- **Insight history:** Optionally save generated insights for later review
- **Weekly digest:** Automatic weekly summary (push notification or email)
- **Comparison:** "Vergleiche mit durchschnittlichem ALDI-Kunden" (requires anonymized aggregate data)
- **Goal tracking:** "Weniger Zucker" goal → track progress over time
- **Shopping list optimizer:** "Optimiere meine aktuelle Liste" → suggest swaps for healthier/cheaper alternatives
- **Charts & visualizations:** Spending trends, nutrition breakdown as interactive charts (Phase 2)

---

*Created: 2026-02-27*
*Implemented: 2026-03-29*
*Status: Implemented — MVP*
*Implementation plan: [plans/Feature-Insights.md](plans/Feature-Insights.md)*
