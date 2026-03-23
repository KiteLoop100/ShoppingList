# F-RECIPE-FEATURES — Recipe Import & "What Can I Cook?"

> **Status:** Draft v2.1 — DB schema aligned  
> **Depends on:** Inventory/Pantry system (Nerd-Modus), Product catalog, Shopping list  
> **Scope:** MVP-ready for both sub-features  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Feature A: Recipe URL Import (F-RECIPE-IMPORT)](#2-feature-a-recipe-url-import)
3. [Feature B: "What Can I Cook?" (F-RECIPE-COOK)](#3-feature-b-what-can-i-cook)
4. [Shared Components](#4-shared-components)
5. [Data Model](#5-data-model)
6. [API Routes](#6-api-routes)
7. [Edge Cases & Decisions](#7-edge-cases--decisions)
8. [Cost Estimates](#8-cost-estimates)
9. [Implementation Phases](#9-implementation-phases)
10. [Cursor Prompts](#10-cursor-prompts)

---

## 1. Overview

Two complementary recipe features:

| Feature | Trigger | Input | Output |
|---------|---------|-------|--------|
| **A: Recipe Import** | User found a recipe online | URL (+ optional servings) | Ingredients on shopping list |
| **B: What Can I Cook?** | User wants cooking ideas | Pantry + free-text preferences | Recipe suggestion(s) |

### Relationship to F-RECIPE-SUGGESTIONS

Die ursprünglich geplante F-RECIPE-SUGGESTIONS-SPEC.md (Modus A: pantry-constrained, Modus B: all recipes) existiert nicht mehr als separate Datei. Ihre Konzepte sind in dieses Dokument integriert:

- **F-RECIPE-IMPORT** = "Ich habe ein Rezept, hilf mir beim Einkaufen"
- **F-RECIPE-COOK** = "Ich habe kein Rezept, was kann ich mit meinen Vorräten kochen?" (subsumiert Modus A aus der alten Spec)

Alle Features teilen die Ingredient→ALDI Matching Engine und Pantry-Vergleichslogik.

---

## 2. Feature A: Recipe URL Import (F-RECIPE-IMPORT)

### 2.1 User Flow

```
┌─────────────────────────────────────────────────────┐
│  ENTRY POINTS                                       │
│                                                     │
│  (a) Paste/type URL in recipe input field            │
│  (b) Share from browser → app receives URL          │
│  (c) Tap "Rezept importieren" button on list page   │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 1: URL ENTRY + EXTRACTION                     │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🔗 Rezept-URL einfügen                       │  │
│  │  [https://www.chefkoch.de/rezepte/...]        │  │
│  │                                    [Laden →]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Loading: "Rezept wird geladen..."                  │
│  → API extracts recipe data from URL                │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: RECIPE PREVIEW + SETTINGS                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🍝 Spaghetti Carbonara                       │  │
│  │  Quelle: chefkoch.de                          │  │
│  │                                               │  │
│  │  Portionen:  [- ] 4 [ +]                      │  │
│  │  (Original: 4 Portionen)                      │  │
│  │                                               │  │
│  │  ┌─ ALDI-Modus ──────────────────────────┐   │  │
│  │  │  ○ Originalrezept (ggf. andere Läden)  │   │  │
│  │  │  ● Mit ALDI-Zutaten anpassen           │   │  │
│  │  └────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Zutaten prüfen →]                                 │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: INGREDIENT REVIEW                          │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  ZUTATEN FÜR 4 PORTIONEN                     │  │
│  │                                               │  │
│  │  ── Vorrätig ─────────────────────────────    │  │
│  │                                               │  │
│  │  ✅ Spaghetti, 400g                           │  │
│  │     → ALDI: Cucina Spaghetti 500g (vorrätig) │  │
│  │     ⚠️ Packung geöffnet — reicht die Menge?  │  │
│  │     [Ja, reicht] [Nein, neu kaufen]           │  │
│  │                                               │  │
│  │  ✅ Eier, 4 Stück                             │  │
│  │     → ALDI: Freilandeier 10er (5 vorrätig)   │  │
│  │     ✓ Ausreichend                             │  │
│  │                                               │  │
│  │  ── Fehlt / Einkaufen ───────────────────     │  │
│  │                                               │  │
│  │  🛒 Guanciale, 150g                           │  │
│  │     → ALDI: Bauchspeck gewürfelt 200g         │  │
│  │     (ALDI-Alternative — Original nicht        │  │
│  │      verfügbar)                               │  │
│  │     [Akzeptieren] [Original beibehalten]      │  │
│  │                                               │  │
│  │  🛒 Pecorino Romano, 80g                      │  │
│  │     → ALDI: Grana Padano gerieben 100g        │  │
│  │     (ALDI-Alternative)                        │  │
│  │     [Akzeptieren] [Original beibehalten]      │  │
│  │                                               │  │
│  │  🛒 Schwarzer Pfeffer, frisch gemahlen        │  │
│  │     → ALDI: Le Gusto Pfeffer schwarz gem.     │  │
│  │     ✓ Automatisch zugeordnet                  │  │
│  │                                               │  │
│  │  ── Nicht bei ALDI erhältlich ────────────    │  │
│  │                                               │  │
│  │  ⚠️ Guanciale (wenn Original gewählt)         │  │
│  │     Muss anderswo gekauft werden              │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [Auf die Einkaufsliste setzen →]                   │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: CONFIRMATION                               │
│                                                     │
│  ✅ 3 Produkte auf die Einkaufsliste gesetzt        │
│  📌 Rezept gespeichert unter "Meine Rezepte"        │
│                                                     │
│  [Zur Einkaufsliste]  [Weiteres Rezept]             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Recipe Extraction Strategy

**Primary: JSON-LD / schema.org/Recipe (structured data)**

Most major recipe sites embed structured data:
- Chefkoch.de ✅ (schema.org/Recipe)
- Lecker.de ✅
- EatSmarter.de ✅
- BBC Good Food ✅
- AllRecipes ✅

Extraction priority:
1. Parse JSON-LD `@type: "Recipe"` from HTML `<script type="application/ld+json">`
2. Parse Microdata `itemtype="http://schema.org/Recipe"`
3. Fallback: Send raw HTML to Claude API for intelligent extraction

**Fallback: AI Extraction via Claude API**

For sites without structured data, send the page text to Claude Sonnet with a structured extraction prompt. Response format:

```json
{
  "title": "Spaghetti Carbonara",
  "servings": 4,
  "servings_label": "Portionen",
  "ingredients": [
    {
      "name": "Spaghetti",
      "amount": 400,
      "unit": "g",
      "category": "Nudeln",
      "notes": ""
    },
    {
      "name": "Guanciale",
      "amount": 150,
      "unit": "g",
      "category": "Fleisch/Wurst",
      "notes": "ersatzweise Pancetta oder Speck"
    }
  ],
  "source_url": "https://...",
  "source_name": "Chefkoch",
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "difficulty": "normal"
}
```

### 2.3 ALDI Product Matching

The matching engine maps extracted ingredients to ALDI products:

**Matching tiers:**

| Tier | Description | Example |
|------|-------------|---------|
| 1 - Exact | Direct product match | "Spaghetti 500g" → Cucina Spaghetti 500g |
| 2 - Category | Same category, different brand/variant | "Barilla Spaghetti" → Cucina Spaghetti |
| 3 - Substitute | Functionally equivalent | "Guanciale" → Bauchspeck gewürfelt |
| 4 - Not available | No ALDI equivalent exists | "Safranfäden" → ⚠️ nicht verfügbar |

**Matching implementation:**

Use Claude API with the ALDI product catalog as context. The prompt includes:
- The ingredient name, amount, unit
- The user's preferred ALDI country (DE/AT)
- Whether ALDI-mode is active
- A subset of the product catalog (filtered by likely category)

Response includes the matched product, confidence level, and whether it's a direct match or substitute.

### 2.4 Pantry Comparison Logic

When Nerd-Modus is active and inventory is available:

```
For each ingredient:
  1. Match to ALDI product (see 2.3)
  2. Check inventory for matched product
     a. Product in inventory AND status = "sealed"
        → quantity >= needed? → ✅ "Vorrätig, ausreichend"
        → quantity < needed?  → 🛒 "Vorrätig, aber zu wenig — Differenz: Xg"
     b. Product in inventory AND status = "opened"
        → Show prompt: "Packung geöffnet — reicht die Menge?"
        → User answers "Ja" → ✅ Mark as sufficient
        → User answers "Nein" → 🛒 Add to shopping list
     c. Product NOT in inventory
        → 🛒 Add to shopping list
```

**Without Nerd-Modus:** Skip pantry check entirely. All ingredients go to shopping list (minus items user manually excludes via toggle).

### 2.5 Servings Scaling

- Show original servings count from recipe
- Stepper (–/+) to adjust, range 1–12
- All ingredient amounts scale proportionally
- Round to sensible values (no "37.5g Butter" → "40g Butter")
- Package-aware suggestions: if recipe needs 600g pasta, suggest buying 2x 500g

### 2.6 Entry Points

**(a) In-app input field**
- Dedicated "Rezept importieren" section/page
- Text field for URL paste
- Accessible from main navigation or shopping list page

**(b) Web Share API (mobile)**
```typescript
// Register as share target in manifest.json
"share_target": {
  "action": "/api/share-recipe",
  "method": "GET",
  "params": { "url": "url" }
}
```
User shares from browser → app opens with URL pre-filled.

**(c) Clipboard detection (optional, nice-to-have)**
When user opens app and clipboard contains a recipe URL, show a subtle banner:
"Rezept-URL erkannt — importieren?"

### 2.7 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| URL not a recipe page | Show error: "Kein Rezept auf dieser Seite gefunden" |
| Recipe in foreign language | AI extraction handles multilingual; ingredients translated to German for matching |
| Vague quantities ("eine Prise", "etwas", "nach Geschmack") | Show ingredient but don't add to list; mark as "Grundzutat — vermutlich vorrätig" |
| Recipe for "1 Kuchen" not portions | Show as-is, allow scaling ("Wie viele Kuchen?") |
| Same ingredient listed twice (e.g., "Butter for dough" + "Butter for glaze") | Merge quantities, show combined |
| URL behind paywall/login | Show error: "Seite nicht zugänglich — Rezept manuell eingeben?" with manual entry option |
| Very large recipe (>30 ingredients) | Handle normally, but group by category for readability |
| Ingredient already on shopping list | Show hint: "Bereits auf der Liste (Xg) — Menge erhöhen?" |
| Recipe site temporarily down | Retry once, then suggest trying later or manual entry |

### 2.8 Features Included

- ✅ URL paste import
- ✅ Web Share API (mobile share-to-app)
- ✅ Servings adjustment with proportional scaling
- ✅ ALDI product matching with substitution suggestions
- ✅ Pantry comparison (Nerd-Modus)
- ✅ Opened-product quantity check
- ✅ Save imported recipes to "Meine Rezepte" for reuse
- ✅ Grouped ingredient display (vorrätig / einkaufen / nicht bei ALDI)
- ✅ Toggle individual ingredients on/off before adding to list

### 2.9 Features Excluded (Low-Value / Niche)

- ❌ Browser extension
- ❌ OCR from cookbook photos
- ❌ Recipe editing/modification in-app
- ❌ Nutritional information display
- ❌ Recipe rating/review system
- ❌ Social sharing of adapted recipes
- ❌ Meal planning calendar integration (future)

---

## 3. Feature B: "What Can I Cook?" (F-RECIPE-COOK)

### 3.1 Concept

A chat-based interface where the user describes what they want to eat, and the AI suggests recipes based on their current pantry. Requires Nerd-Modus for pantry access.

### 3.2 User Flow

```
┌─────────────────────────────────────────────────────┐
│  ENTRY: User taps "Was kann ich kochen?"            │
│                                                     │
│  IF Nerd-Modus OFF:                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  🔒 Diese Funktion benötigt den Nerd-Modus    │  │
│  │                                               │  │
│  │  Im Nerd-Modus werden deine Vorräte           │  │
│  │  automatisch berücksichtigt, um passende       │  │
│  │  Rezepte vorzuschlagen.                       │  │
│  │                                               │  │
│  │  [Nerd-Modus aktivieren]                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  IF Nerd-Modus ON:                                  │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  CHAT INTERFACE                                     │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🤖 Hallo! Ich kenne deine Vorräte und kann   │  │
│  │     dir passende Rezepte vorschlagen.          │  │
│  │                                               │  │
│  │     Was hast du Lust zu essen?                │  │
│  │     Du kannst z.B. sagen:                     │  │
│  │     • "Etwas Schnelles mit Nudeln"            │  │
│  │     • "Was Gesundes für 2 Personen"           │  │
│  │     • "Ein Abendessen ohne Fleisch"           │  │
│  │     • "Was kann ich mit meinen Vorräten       │  │
│  │       machen?"                                │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  💬 [Etwas Warmes für heute Abend...]    [→]  │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  AI PROCESSING                                      │
│                                                     │
│  API call includes:                                 │
│  - User message                                     │
│  - Full pantry/inventory list                       │
│  - ALDI product catalog (relevant subset)           │
│  - Conversation history (multi-turn)                │
│                                                     │
│  AI may:                                            │
│  → Suggest 2-3 recipes directly                     │
│  → Ask clarifying question first                    │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  RESPONSE: RECIPE SUGGESTIONS                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  🤖 Mit deinen Vorräten fallen mir drei        │  │
│  │     Ideen ein:                                │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  1️⃣  Pasta Aglio e Olio                  │  │  │
│  │  │  ⏱ 20 Min · Alles vorrätig              │  │  │
│  │  │  Spaghetti, Knoblauch, Olivenöl,        │  │  │
│  │  │  Chiliflocken, Petersilie               │  │  │
│  │  │  [Rezept anzeigen]                      │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  2️⃣  Kartoffelsuppe mit Würstchen        │  │  │
│  │  │  ⏱ 35 Min · 1 Zutat fehlt               │  │  │
│  │  │  Kartoffeln✓, Lauch✓, Würstchen✓,       │  │  │
│  │  │  Sahne ✗ (auf Einkaufsliste setzen?)    │  │  │
│  │  │  [Rezept anzeigen]                      │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │  3️⃣  Omelett mit Gemüse                  │  │  │
│  │  │  ⏱ 15 Min · Alles vorrätig              │  │  │
│  │  │  Eier, Paprika, Zwiebeln, Käse          │  │  │
│  │  │  [Rezept anzeigen]                      │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  │                                               │  │
│  │  Möchtest du eines der Rezepte sehen, oder    │  │
│  │  soll ich andere Vorschläge machen?           │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  User taps "Rezept anzeigen" on option 2            │
│                                                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  RECIPE DETAIL VIEW                                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Kartoffelsuppe mit Würstchen                 │  │
│  │  ⏱ 35 Min · 🍽 4 Portionen [- ] 4 [ +]       │  │
│  │                                               │  │
│  │  ── Zutaten ──────────────────────────────    │  │
│  │  ✅ Kartoffeln, 600g (vorrätig)               │  │
│  │  ✅ Lauch, 1 Stange (vorrätig)                │  │
│  │  ✅ Wiener Würstchen, 4 St. (vorrätig)        │  │
│  │  🛒 Sahne, 200ml (fehlt)                      │  │
│  │  ✅ Gemüsebrühe, 1L (vorrätig)                │  │
│  │                                               │  │
│  │  ── Zubereitung ──────────────────────────    │  │
│  │  1. Kartoffeln schälen und würfeln...         │  │
│  │  2. Lauch in Ringe schneiden...               │  │
│  │  3. ...                                       │  │
│  │                                               │  │
│  │  [Fehlende Zutaten auf die Liste →]           │  │
│  │                                               │  │
│  │  💡 Ähnliches Rezept auf Chefkoch:            │  │
│  │  [Omas Kartoffelsuppe →]                      │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 3.3 Chat vs. Checklist: Decision

**Recommendation: Free-text chat with smart quick-actions.**

Rationale:
- Chat is more natural ("was Schnelles mit Nudeln" beats clicking 5 filters)
- Covers infinite preference combinations impossible to pre-build as filters
- Allows follow-up ("ohne Zwiebeln" / "etwas Einfacheres")
- Quick-action chips below the input give structure without limiting

Quick-action chips (optional shortcuts, not required):
```
[🍝 Nudeln]  [🥗 Salat]  [🍲 Suppe]  [⚡ Unter 20 Min]  [🌱 Vegetarisch]
```

### 3.4 AI System Prompt Structure

```
You are a helpful cooking assistant for an ALDI shopping app. The user wants 
recipe suggestions based on their current pantry.

## User's Current Pantry
{pantry_items_json}

## ALDI Product Catalog (available for purchase)
{relevant_aldi_products_subset}

## Rules
1. Prioritize recipes that use MOSTLY pantry items (minimize extra purchases)
2. Suggest 2-3 recipes per response
3. For each recipe, clearly mark which ingredients are available (✅) vs. need 
   to be purchased (🛒)
4. Consider expiration: items expiring soon should be used first
5. If the user's request is vague, ask ONE clarifying question max
6. Respond in German
7. Keep recipes practical — everyday cooking, not restaurant-level
8. If pantry is very limited, honestly say so and suggest what's possible 
   with 1-2 additional purchases
9. When a recipe is selected, provide full cooking instructions in 
   HelloFresh-style numbered steps

## Response Format for Suggestions
Respond ONLY in this JSON format:
{
  "type": "suggestions" | "clarification" | "recipe_detail",
  "message": "Natural language intro",
  "suggestions": [...] | null,
  "question": "..." | null,
  "recipe": {...} | null
}
```

### 3.5 Multi-Turn Conversation

The chat supports multiple turns:

1. **Turn 1:** User states preference → AI suggests 2-3 recipes
2. **Turn 2:** User asks for details or refines ("etwas ohne Sahne?")
3. **Turn 3:** AI provides updated suggestions or full recipe detail
4. **Max turns:** 10 per session (rate limit)

Conversation history is maintained in client state and sent with each API call.

### 3.6 Recipe Output Options

When user selects a recipe, two options:

**(a) AI-generated recipe** (primary)
- Full recipe shown in-app with HelloFresh-style steps
- Missing ingredients can be added to shopping list with one tap
- Recipe saved to "Meine Rezepte"

**(b) External recipe link** (secondary, nice-to-have)
- AI searches for a matching recipe on Chefkoch/other sites
- Shows link with note: "Ähnliches Rezept auf Chefkoch gefunden"
- This bridges to Feature A (user can then import that URL)

**Recommendation:** Start with (a) only. Add (b) in a later iteration since it requires web search API calls and adds complexity.

### 3.7 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Pantry is empty | "Deine Vorratsliste ist leer. Füge Produkte hinzu, um personalisierte Vorschläge zu bekommen. Möchtest du trotzdem allgemeine ALDI-Rezepte sehen?" |
| Pantry has only staples (salt, oil, flour) | Suggest simple recipes that need 2-3 purchases: "Mit Mehl und Öl könntest du z.B. Pfannkuchen machen — du bräuchtest nur noch Milch und Eier." |
| User asks for something impossible with pantry | Be honest: "Für Sushi bräuchtest du einiges, was nicht vorrätig ist. Soll ich trotzdem ein Rezept mit Einkaufsliste erstellen?" |
| User asks non-cooking question | Politely redirect: "Ich bin dein Kochassistent — bei anderen Fragen kann ich leider nicht helfen. Was möchtest du kochen?" |
| Dietary restrictions mentioned | Remember within session: "Alles klar, ich schlage nur vegetarische Rezepte vor." |
| Products about to expire | Proactively mention: "Dein Joghurt läuft in 2 Tagen ab — soll ich ein Rezept damit vorschlagen?" |
| API rate limit reached | "Du hast heute schon viele Rezepte generiert. Morgen geht es weiter! Hier sind deine gespeicherten Rezepte." |
| Very specific/unusual request | AI handles naturally via free text; if truly impossible, says so |

---

## 4. Shared Components

### 4.1 Ingredient→ALDI Matching Engine

Shared between Feature A and Feature B. Also reusable by F-RECIPE-SUGGESTIONS.

```typescript
// src/lib/recipe/ingredient-matcher.ts

interface IngredientMatch {
  ingredient: RecipeIngredient;      // Original ingredient from recipe
  aldi_product: AldiProduct | null;  // Matched ALDI product
  match_tier: 1 | 2 | 3 | 4;       // exact, category, substitute, unavailable
  match_confidence: number;          // 0-1
  is_substitute: boolean;            // true if not exact match
  substitute_note?: string;          // "Bauchspeck statt Guanciale"
}

interface PantryCheckResult extends IngredientMatch {
  in_pantry: boolean;
  pantry_status: 'sealed' | 'opened' | 'not_present';
  pantry_quantity_sufficient: boolean | null;  // null = opened, user must confirm
  quantity_in_pantry?: number;
  quantity_needed: number;
  quantity_to_buy: number;           // 0 if sufficient
}
```

### 4.2 Recipe Data Model

Persisted recipes (`saved_recipes`) store **ingredients only** — no cooking steps in the database (D10); the user keeps the source page for URL imports.

For **F-RECIPE-COOK**, numbered steps exist only in **transient API responses** (`GeneratedRecipeDetail` in `src/lib/recipe/types.ts`, e.g. `steps: string[]`), not as a column on `saved_recipes`.

```typescript
// src/lib/recipe/types.ts (excerpt)

interface SavedRecipe {
  id: string;
  user_id: string;
  title: string;
  source_url: string | null;
  source_name: string;
  source_type: "url_import" | "ai_cook";
  original_servings: number;
  servings_label: string;
  ingredients: RecipeIngredient[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  difficulty: string | null;
  aldi_adapted: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface RecipeIngredient {
  name: string;
  amount: number | null;            // null for "nach Geschmack"
  unit: string | null;              // g, ml, Stück, EL, TL, Prise, etc.
  category: string;                 // for ALDI matching context
  notes: string;                    // "ersatzweise Pancetta"
  is_optional: boolean;             // "optional: Petersilie"
}
```

### 4.3 Saved Recipes ("Meine Rezepte")

Both features save recipes to a shared collection. Simple list view for v1.

---

## 5. Data Model (Supabase)

### 5.1 Tables

```sql
-- Imported/generated recipes (no instructions column — D10)
CREATE TABLE saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,                    -- NULL for AI-generated
  source_name TEXT NOT NULL,          -- 'chefkoch.de', 'ai-generated', 'lecker.de'
  source_type TEXT NOT NULL CHECK (source_type IN ('url_import', 'ai_cook')),
  original_servings INTEGER NOT NULL,
  servings_label TEXT NOT NULL DEFAULT 'Portionen',
  ingredients JSONB NOT NULL,         -- RecipeIngredient[]
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  difficulty TEXT,
  aldi_adapted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipes" ON saved_recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recipe import history (for analytics and dedup)
CREATE TABLE recipe_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  extraction_method TEXT NOT NULL CHECK (
    extraction_method IN ('json-ld', 'microdata', 'ai-fallback')
  ),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recipe_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own recipe imports" ON recipe_imports
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI cooking conversations
CREATE TABLE cook_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  pantry_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cook_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cook conversations" ON cook_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 5.2 Indexes

```sql
CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX idx_saved_recipes_user_source_type ON saved_recipes(user_id, source_type);
CREATE INDEX idx_recipe_imports_user_id ON recipe_imports(user_id);
CREATE INDEX idx_cook_conversations_user_id ON cook_conversations(user_id);
```

---

## 6. API Routes

### 6.1 Recipe URL Extraction

```
POST /api/recipe/extract
Body: { url: string }
Response: { recipe: ExtractedRecipe } | { error: string }

Steps:
1. Fetch URL content (server-side)
2. Try JSON-LD extraction
3. Try Microdata extraction  
4. Fallback: Claude API extraction
5. Return structured recipe data
```

### 6.2 Ingredient Matching

```
POST /api/recipe/match-ingredients
Body: { 
  ingredients: RecipeIngredient[],
  aldi_mode: boolean,
  country: 'DE' | 'AT',
  check_pantry: boolean
}
Response: { matches: PantryCheckResult[] }

Steps:
1. For each ingredient, search ALDI product catalog
2. Use Claude API for fuzzy/substitute matching
3. If check_pantry: compare against user's inventory
4. Return grouped results
```

### 6.3 Cook Chat

```
POST /api/recipe/cook-chat
Body: {
  message: string,
  conversation_id?: string,
  conversation_history: Message[]
}
Response: {
  conversation_id: string,
  response: AICookResponse
}

Steps:
1. Load user's pantry from inventory
2. Build system prompt with pantry + catalog context
3. Send to Claude API with conversation history
4. Parse structured response
5. Save conversation state
```

### 6.4 Save Recipe

```
POST /api/recipe/save
Body: { recipe: SavedRecipe }  -- insert shape; no persisted cooking steps (D10)
Response: { id: string }
```

---

## 7. Edge Cases & Decisions

### 7.1 Decisions Table

| # | Decision | Options | Chosen | Rationale |
|---|----------|---------|--------|-----------|
| D1 | Recipe extraction primary method | JSON-LD vs. always AI | JSON-LD first, AI fallback | Faster, cheaper, more reliable for supported sites |
| D2 | Chat vs. structured filters for F-COOK | Chat / Filters / Both | Chat with quick-action chips | More flexible, natural, covers edge cases |
| D3 | External recipe links in F-COOK | Include / Skip for v1 | Skip for v1 | Adds web search complexity; AI-generated recipes suffice |
| D4 | Clipboard URL detection | Include / Skip | Skip for v1 | Privacy concerns, platform inconsistency |
| D5 | Ingredient matching approach | Rules-based / AI / Hybrid | AI (Claude) with product catalog | Too many variations for pure rules |
| D6 | Conversation persistence | Per-session / Persist across sessions | Per-session | Cooking context is ephemeral |
| D7 | Manual ingredient entry (no URL) | Include / Skip | Include simple form | For cookbook recipes, oral recipes; low effort to add |
| D8 | Rate-Limit für AI-Rezept-Features | Getrennt / Gemeinsam 20 / Gemeinsam 30 | Gemeinsam: 30/Tag für F-RECIPE-COOK + F-RECIPE-SUGGESTIONS zusammen | Einfacher für User zu verstehen; 30 ist großzügig genug für Power-User |
| D9 | Web Share API | Jetzt / Später | Jetzt mit einbauen | Wichtigster mobiler Entry-Point; ohne Share-Funktion muss User URL manuell kopieren |
| D10 | Kochschritte bei URL-Import | Extrahieren / Nur Zutaten | Nur Zutaten | User hat die Originalseite; spart Komplexität und API-Kosten |

### 7.2 Open Questions

| # | Question | Impact | Notes |
|---|----------|--------|-------|
| Q2 | Rate limit for F-COOK conversations | Cost control | Propose: 10 conversations/day, 10 turns each |
| Q5 | Product catalog context window — full 7500 products too large for API call | Technical | Pre-filter by ingredient category; send ~200 relevant products |

---

## 8. Cost Estimates

### Feature A: Recipe Import

| Operation | Model | Tokens (est.) | Cost per call | Calls/recipe |
|-----------|-------|---------------|---------------|--------------|
| AI extraction (fallback) | Sonnet | ~3,000 in + 500 out | ~$0.012 | 0 or 1 |
| Ingredient matching | Sonnet | ~2,000 in + 400 out | ~$0.009 | 1 |
| **Total per import** | | | **~$0.01–0.02** | |

### Feature B: What Can I Cook?

| Operation | Model | Tokens (est.) | Cost per call | Calls/session |
|-----------|-------|---------------|---------------|---------------|
| Suggestion turn | Sonnet | ~4,000 in + 800 out | ~$0.018 | 2-4 |
| Recipe detail | Sonnet | ~3,000 in + 1,200 out | ~$0.015 | 0-1 |
| **Total per session** | | | **~$0.05–0.10** | |

### Monthly estimate (100 active users)

| Scenario | Imports/mo | Cook sessions/mo | Monthly cost |
|----------|------------|------------------|--------------|
| Light | 200 | 300 | ~$20 |
| Medium | 500 | 800 | ~$55 |
| Heavy | 1,000 | 1,500 | ~$110 |

---

## 9. Implementation Phases

### Phase 1: Foundation (2–3 Cursor sessions)

1. Supabase migration for new tables
2. Recipe types + shared interfaces (`src/lib/recipe/types.ts`)
3. URL extraction API route (JSON-LD + AI fallback)
4. Basic ingredient matching engine

### Phase 2: Feature A — Recipe Import (3–4 sessions)

1. Recipe import page/modal UI
2. Servings adjustment component
3. ALDI-mode toggle + matching display
4. Pantry comparison (Nerd-Modus)
5. Add-to-list flow
6. Save recipe functionality

### Phase 3: Feature B — What Can I Cook? (3–4 sessions)

1. Cook chat page + UI
2. Nerd-Modus gate
3. Chat API route with pantry injection
4. Recipe suggestion cards
5. Recipe detail view
6. "Add missing ingredients to list" flow

### Phase 4: Polish + Integration (1–2 sessions)

1. "Meine Rezepte" list view
2. Quick-action chips for chat
3. Error handling + edge cases
4. Rate limiting
5. Web Share API integration (if feasible)
6. Manual ingredient entry form

---

## 10. Cursor Prompts

See companion file: `CURSOR-PROMPTS-RECIPE-FEATURES.md`
