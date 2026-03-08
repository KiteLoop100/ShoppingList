# SEARCH-SCORING.md

> Scoring Engine, Gewichtung, Konfiguration & Implementierungsplan  
> Stand: 2026-02-28 | Version: 1.0

> **Hinweis:** Dieses Dokument beschreibt die Scoring- und Ranking-Logik der Produktsuche.  
> Für die Pipeline-Übersicht, Preprocessing, Query Classification und Candidate Retrieval siehe [SEARCH-ARCHITECTURE.md](./SEARCH-ARCHITECTURE.md).

---

## 5. Scoring & Ranking Engine

### 5.1 Scoring-Formel

Jeder Kandidat erhält einen `totalScore`, der sich aus gewichteten Einzelsignalen zusammensetzt:

```
totalScore = (matchScore × matchWeight)
           + (popularityScore × popularityWeight)
           + (personalScore × personalWeight)
           + (preferenceScore × preferenceWeight)
           + (freshnessScore × freshnessWeight)
```

### 5.2 Signale im Detail

#### Signal 1: Match Quality (`matchScore`)

Basiert auf `matchType` aus dem Retrieval (SEARCH-ARCHITECTURE.md §4):

```
MatchType              matchScore
─────────────────────────────────
EXACT_NAME              100
NAME_STARTS_WITH         90
NAME_FIRST_WORD          85
NAME_CONTAINS
  → standalone           80
  → dominant             75
  → modifier             25   ← stark reduziert!
MULTI_WORD_ALL           70
CATEGORY_MATCH           60
BRAND_MATCH              55
DEMAND_GROUP             50
FUZZY_MATCH              35   (Phase 2)
```

#### Signal 2: Popularität (`popularityScore`)

```
Quelle:    products.popularity_score (0.0 – 1.0, von ALDI)
Default:   0.025 (solange keine ALDI-Daten vorliegen)
Formel:    popularityScore = popularity_score × 100
Bereich:   0 – 100
```

#### Signal 3: Persönliche Relevanz (`personalScore`)

```
Quelle:    user_product_preferences.purchase_count + last_purchased_at
Formel:    personalScore = purchaseFrequencyScore + recencyScore

purchaseFrequencyScore:
  purchase_count = 0  →  0
  purchase_count = 1  → 15
  purchase_count = 2  → 25
  purchase_count = 3  → 35
  purchase_count ≥ 5  → 50  (Cap)

recencyScore (Decay-Faktor):
  Letzer Kauf < 7 Tage    → 50
  Letzer Kauf < 30 Tage   → 35
  Letzer Kauf < 90 Tage   → 20
  Letzer Kauf < 180 Tage  → 10
  Letzer Kauf ≥ 180 Tage  →  0

Bereich:   0 – 100
Default:   0 (kein Eintrag in user_product_preferences)
```

#### Signal 4: Nutzer-Präferenzen (`preferenceScore`)

Bestehende Logik, normalisiert auf 0–100:

```
Basis: 0
+ prefer_bio       UND product.is_bio           → +25
+ prefer_vegan     UND product.is_vegan         → +25
+ prefer_brand     UND !product.is_private_label → +25
+ prefer_cheapest  → +(50 - min(price, 50))      (günstigere = höher)
+ prefer_animal_welfare UND level > 0            → +(level × 8)

Bereich:   0 – 100 (theoretisches Max ~125, wird auf 100 gekappt)
```

#### Signal 5: Frische / Aktualität (`freshnessScore`)

```
Aktionsartikel-Awareness:
  Produkt ist daily_range                              →  0 (neutral)
  Produkt ist special UND heute im Aktionszeitraum     → 30 (Boost)
  Produkt ist special UND Aktionszeitraum abgelaufen   → Kandidat wird AUSGESCHLOSSEN
  Produkt ist special UND Aktionszeitraum in Zukunft   → 10 (leichter Boost)

Saisonalität (Phase 2+):
  Produkt ist is_seasonal UND Saison passt zu aktuellem Monat → +20
  Produkt ist is_seasonal UND Saison passt NICHT              → -20

Bereich:   -20 – 50
```

### 5.3 Gewichtung der Signale

Die Gewichte bestimmen, wie stark jedes Signal den Gesamtscore beeinflusst. **Kritisch: Die Gewichte verschieben sich je nach Query-Spezifität.**

```
                      Kurze Query         Lange Query
Signal                (1-2 Wörter)        (3+ Wörter)
──────────────────────────────────────────────────────
matchWeight            0.30                0.50
popularityWeight       0.25                0.10
personalWeight         0.25                0.15
preferenceWeight       0.10                0.10
freshnessWeight        0.10                0.15

Begründung:
- Kurze Query ("Milch"): Nutzer sucht breit → Popularität und persönliche
  Historie sind wichtiger, um die besten Treffer nach oben zu bringen.
- Lange Query ("Milch laktosefrei"): Nutzer sucht spezifisch → Match-Qualität
  dominiert, weil exakte Treffer die klar bessere Antwort sind.
```

### 5.4 Sortierung

```
1. totalScore ABSTEIGEND
2. Bei Gleichstand: matchType AUFSTEIGEND (besserer Match-Typ gewinnt)
3. Bei Gleichstand: name A-Z (Deutsch-Locale)
```

---

## 6. Post-Processing

### 6.1 Allergen-Ausschluss

Bestehende `shouldExclude()`-Logik bleibt unverändert. Wird **nach** dem Scoring angewandt, um ausgeschlossene Produkte zu entfernen.

### 6.2 Abgelaufene Aktionsartikel

Produkte mit `assortment_type = 'special'` und `special_end_date < today` werden entfernt.

### 6.3 Deduplizierung

Aktuell kein Problem (product_id ist unique), aber relevant falls zukünftig mehrere Datenquellen gemergt werden.

### 6.4 Ergebnis-Limit

Standard: 20 Ergebnisse. Für Smart Default (leere Query): 10 Ergebnisse.

---

## 7. Datenaufbereitung (Indexierung)

Beim Laden der Produkte in den Speicher (App-Start) wird jedes Produkt um berechnete Suchfelder angereichert:

```typescript
interface SearchableProduct extends Product {
  search_name: string;             // Name ohne ALDI-Prefixe und Mengenangaben
  search_name_normalized: string;  // search_name normalisiert
  search_name_words: string[];     // Einzelwörter für schnelles Matching
  search_brand_normalized: string | null;
  demand_group_normalized: string | null;
}
```

**Zeitpunkt:** Einmalig beim App-Start nach dem Laden aus IndexedDB. Wird im Speicher gehalten, nicht persistiert.

**Persönliche Daten:** `user_product_preferences` werden ebenfalls beim App-Start geladen und als `Map<string, UserProductPreference>` (Key: `product_id`) im Speicher gehalten.

---

## 8. Synonym-Map: Aufbau & Pflege

### 8.1 Datenquelle für initiale Map

Um die Synonym-Map korrekt zu befüllen, müssen die tatsächlichen `demand_group`-Werte aus der DB exportiert werden.

```sql
SELECT DISTINCT demand_group, COUNT(*) as product_count
FROM products
WHERE status = 'active' AND country = 'DE'
GROUP BY demand_group
ORDER BY demand_group;
```

### 8.2 Struktur

Die Map wird als statische TypeScript-Datei gepflegt (`src/lib/search/synonym-map.ts`). Jeder Eintrag bildet einen Suchbegriff auf ein oder mehrere `demand_group`-Prefixe ab.

### 8.3 Erweiterungsstrategie

Phase 1: Manuelle Pflege der 30-50 häufigsten Oberbegriffe.
Phase 2: Logging von Suchanfragen ohne Treffer → regelmäßig auswerten → Map erweitern.
Phase 3: AI-gestütztes Mapping (Claude API) für automatische Synonym-Erkennung.

---

## 9. Implementierungsphasen

### Phase 1 – Fundament (Priorität: HOCH)

Ziel: Die zwei kritischsten Verbesserungen, die den größten Nutzer-Impact haben.

| # | Feature | Dateien | Aufwand |
|---|---|---|---|
| 1.1 | Input Preprocessing: ALDI-Prefix-Bereinigung + Mengenangaben-Stripping | `query-preprocessor.ts` | S |
| 1.2 | `SearchableProduct` mit vorberechneten Suchfeldern | `search-indexer.ts` | S |
| 1.3 | Wortgrenzen-Logik (`classifySubstringMatch`) | `word-boundary.ts` | M |
| 1.4 | MatchType-Hierarchie im Retrieval | `candidate-retrieval.ts` | M |
| 1.5 | Synonym-Map (initiale 30-50 Einträge) + demand_group-Export | `synonym-map.ts` | M |
| 1.6 | Scoring Engine mit matchScore + Wortgrenzen-Gewichtung | `scoring-engine.ts` | M |
| 1.7 | Pluralformen-Normalisierung | `query-preprocessor.ts` (getStemVariants) | S |
| 1.8 | Post-Processing: Abgelaufene Aktionsartikel ausschließen | `post-processor.ts` | S |

### Phase 2 – Personalisierung

Ziel: Suche wird persönlich und populäre Produkte steigen auf.

| # | Feature | Dateien | Aufwand |
|---|---|---|---|
| 2.1 | `popularity_score` Default auf 0.5 setzen (DB-Migration) | Migration SQL | S |
| 2.2 | `user_product_preferences` beim App-Start laden | `user-history-loader.ts` | S |
| 2.3 | personalScore: Kaufhäufigkeit + Recency-Decay | `scoring-engine.ts` | M |
| 2.4 | popularityScore in Scoring-Engine integrieren | `scoring-engine.ts` | S |
| 2.5 | Smart Default bei leerer Query | `local-search.ts` (inline) | M |
| 2.6 | Query-Länge als Gewichtungs-Shifter | `scoring-engine.ts` | S |

### Phase 3 – Feinschliff & Intelligence

Ziel: Typo-Toleranz, Saisonalität, kontinuierliche Verbesserung.

| # | Feature | Dateien | Aufwand |
|---|---|---|---|
| 3.1 | Fuzzy Match (Levenshtein aktivieren, Schwellwert kalibrieren) | `candidate-retrieval.ts` | M |
| 3.2 | Synonym-Matching (Joghurt/Yoghurt/Jogurt) | `synonym-map.ts` | S |
| 3.3 | Saisonalitäts-Mapping (Monat → relevante demand_groups) | `seasonality.ts` | M |
| 3.4 | Such-Logging (Queries ohne gute Treffer tracken) | `search-analytics.ts` | M |
| 3.5 | Synonym-Map aus Logs erweitern | Manuell | Laufend |

### Aufwandschätzung

```
S = Small  (< 2h)
M = Medium (2-4h)
L = Large  (> 4h)
```

---

## 10. Dateistruktur (Soll)

```
src/lib/search/
├── index.ts                    # Entry Point (bestehend, anpassen)
├── types.ts                    # Typen (bestehend, erweitern)
├── query-preprocessor.ts       # NEU: Normalisierung, Prefix, Mengen, Plural
├── query-classifier.ts         # NEU: Leere Query, Barcode, Text
├── candidate-retrieval.ts      # Matching-Pipeline mit MatchTypes
├── scoring-engine.ts           # Gewichtete Score-Berechnung
├── post-processor.ts           # Ausschlüsse, Limits
├── word-boundary.ts            # Wortgrenzen-Klassifikation
├── synonym-map.ts              # Oberbegriffe & Synonyme (~120+ Einträge)
├── search-indexer.ts           # SearchableProduct-Aufbereitung
├── purchase-history.ts         # Einkaufshistorie laden (Supabase receipt_items)
├── normalize.ts                # nameMatchesQuery, Levenshtein (delegates to products/normalize)
├── commands.ts                 # Kommando-Erkennung (letzte Einkäufe, Aktionsartikel, Retailer-Prefix)
├── local-search.ts             # Orchestriert die Pipeline (Preprocess → Retrieve → Score → PostProcess)
├── types.ts                    # SearchModule interface
├── constants.ts                # Gewichte, Schwellwerte, Konfiguration
└── README.md                   # Kurzbeschreibung
```

---

## 11. Konfiguration & Tuning

Alle Schwellwerte und Gewichte werden in `constants.ts` zentral definiert, damit sie leicht anpassbar sind:

```typescript
// src/lib/search/constants.ts

export const SEARCH_CONFIG = {
  // Limits
  MAX_RESULTS: 50,
  SMART_DEFAULT_RESULTS: 10,
  SMART_DEFAULT_MIN_HISTORY: 3,
  MIN_QUERY_LENGTH: 1,
  DEBOUNCE_MS: 150,

  // Fuzzy-Matching (Phase 2)
  MAX_LEVENSHTEIN_DISTANCE: 2,
  MIN_WORD_LENGTH_FOR_FUZZY: 5,

  // Pluralformen
  MIN_STEM_LENGTH: 4,

  // Match-Scores
  MATCH_SCORES: {
    EXACT_NAME: 100,
    NAME_STARTS_WITH: 90,
    NAME_FIRST_WORD: 85,
    NAME_CONTAINS_STANDALONE: 80,
    NAME_CONTAINS_DOMINANT: 75,
    NAME_CONTAINS_MODIFIER: 25,
    MULTI_WORD_ALL: 70,
    CATEGORY_MATCH: 60,
    BRAND_MATCH: 55,
    DEMAND_GROUP: 50,
    FUZZY_MATCH: 35,
  },

  // Signal-Gewichte nach Query-Länge
  WEIGHTS_SHORT_QUERY: {  // 1-2 Wörter
    match: 0.30,
    popularity: 0.25,
    personal: 0.25,
    preference: 0.10,
    freshness: 0.10,
  },
  WEIGHTS_LONG_QUERY: {   // 3+ Wörter
    match: 0.50,
    popularity: 0.10,
    personal: 0.15,
    preference: 0.10,
    freshness: 0.15,
  },

  // Recency-Decay (Tage)
  RECENCY_TIERS: [
    { maxDays: 7, score: 50 },
    { maxDays: 30, score: 35 },
    { maxDays: 90, score: 20 },
    { maxDays: 180, score: 10 },
  ],

  // Freshness
  ACTIVE_SPECIAL_BOOST: 30,
  UPCOMING_SPECIAL_BOOST: 10,
  IN_SEASON_BOOST: 20,
  OUT_OF_SEASON_PENALTY: -20,

  // Mengenangaben-Pattern
  QUANTITY_SUFFIX_PATTERN: /\s+\d+[\.,]?\d*\s*(g|kg|ml|l|cl|stk|stück|pac|er|kne)\s*\.?\s*$/i,

  // ALDI-Prefixe
  ALDI_PREFIXES: ["KA:", "KA :"],
} as const;
```

---

## 12. Offene Fragen & Entscheidungen

| # | Frage | Status | Entscheidung |
|---|---|---|---|
| 1 | Welche `demand_group`-Werte existieren tatsächlich? | OFFEN | DB-Export nötig für Synonym-Map |
| 2 | Sind die Kategorienamen langfristig deutsch oder englisch? | OFFEN | Aktuell englisch, für Suche wenig nützlich |
| 3 | Soll `popularity_score` per Migration auf 0.025 gesetzt werden oder im Code als Default behandelt? | ENTSCHIEDEN | Im Code: `product.popularity_score ?? 0.025` |
| 4 | Performance-Budget: Wie viele ms darf die Suche maximal dauern? | VORSCHLAG | 50ms auf Durchschnitts-Smartphone |
| 5 | Soll die Synonym-Map auch englische Begriffe unterstützen? | OFFEN | Ggf. für "water", "wine" etc. |

---

## Anhang A: Beispiel-Durchlauf

**Query: "wein"**

```
1. PREPROCESSING
   normalize("wein") → "wein"
   stemVariants → ["wein", "weine", "weinen"]

2. CLASSIFICATION → Textsuche

3. CANDIDATE RETRIEVAL
   Produkt "Rotwein Merlot 0,75l"
     → search_name: "Rotwein Merlot"
     → "wein" in "rotwein" → ends_with → DOMINANT → NAME_CONTAINS (dominant)

   Produkt "Weintrauben kernlos 500g"
     → search_name: "Weintrauben kernlos"
     → "wein" in "weintrauben" → starts_with → MODIFIER → NAME_CONTAINS (modifier)

   Produkt "Weißwein Chardonnay 1l"
     → search_name: "Weisswein Chardonnay"
     → "wein" in "weisswein" → ends_with → DOMINANT → NAME_CONTAINS (dominant)

   Synonym-Map: "wein" → demand_group_prefixes: ["39-Wein"]
     → Alle Produkte mit demand_group starting "39-Wein" → CATEGORY_MATCH

4. SCORING (kurze Query → WEIGHTS_SHORT_QUERY)
   "Rotwein Merlot":     matchScore=75, popularity=50, personal=35 → total: X
   "Weißwein Chardonnay": matchScore=75, popularity=50, personal=0  → total: Y
   "Weintrauben kernlos": matchScore=25, popularity=50, personal=0  → total: Z (weit unten!)

5. ERGEBNIS: Rotweine und Weißweine oben, Weintrauben weit unten ✓
```

---

## §12: Catalog Scoring (`scoreForCatalog`)

The catalog view (F29) reuses the scoring engine to sort products within a category by relevance — without a search query.

### Entry Point

```typescript
scoreForCatalog(
  products: SearchableProduct[],
  preferences: ProductPreferences,
  userHistory: Map<string, UserProductPreference>,
  now?: Date
): CatalogScoredProduct[]
```

### Signals Used

The same internal scoring functions as search, but without the match quality signal:

| Signal | Weight | Function |
|---|---|---|
| Popularity | 0.30 | `computePopularityScore()` |
| Personal relevance | 0.35 | `computePersonalScore()` |
| User preferences | 0.20 | `computePreferenceScore()` |
| Freshness | 0.15 | `computeFreshnessScore()` |

Match quality is excluded because there is no search query — all products in a category are equally "matched".

### Design Decision

A single `scoreForCatalog()` function was added to `scoring-engine.ts` instead of creating a separate sorting module. This keeps the scoring logic DRY and ensures catalog sorting automatically benefits from any future improvements to the scoring signals.
