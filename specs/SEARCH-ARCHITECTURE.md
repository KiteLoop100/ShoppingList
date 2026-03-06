# SEARCH-ARCHITECTURE.md

> Produktsuche – Architektur, Ranking-Logik & Implementierungsplan  
> Stand: 2026-02-28 | Version: 1.0

---

## 1. Überblick & Designprinzipien

### 1.1 Ziel

Die Produktsuche ist das Kernfeature der App. Sie muss aus Nutzersicht **sofort, intuitiv und treffsicher** funktionieren. Der Nutzer soll in den meisten Fällen sein gewünschtes Produkt unter den ersten 3–5 Ergebnissen finden.

### 1.2 Designprinzipien

| Prinzip | Bedeutung |
|---|---|
| **Local-first** | Alle Suchdaten liegen im Speicher (IndexedDB → RAM). Kein Server-Call für die Kernsuche. Latenz < 15ms. |
| **Graceful Degradation** | Wenn Ranking-Signale fehlen (z.B. `popularity_score` = NULL), fällt das System auf neutrale Defaults zurück. Kein Feature bricht. |
| **Stufenweise Erweiterbarkeit** | Jedes Ranking-Signal ist ein eigenständiges Modul mit definiertem Interface. Neue Signale können hinzugefügt werden, ohne bestehende zu ändern. |
| **Transparenz** | Jede Scoring-Entscheidung ist nachvollziehbar und in diesem Dokument dokumentiert. |

### 1.3 Architektur-Schichten

```
Nutzer-Eingabe
     │
     ▼
┌─────────────────────────────────┐
│  1. INPUT PREPROCESSING         │  Normalisierung, Prefix-Bereinigung,
│     (query-preprocessor.ts)     │  Pluralformen, Mengenangaben-Stripping
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  2. QUERY CLASSIFICATION        │  Leere Query → Smart Default
│     (query-classifier.ts)       │  Barcode → EAN-Lookup
│                                 │  Text → Produkt-/Oberbegriff-Suche
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  3. CANDIDATE RETRIEVAL         │  Produkte finden, die zur Query passen
│     (candidate-retrieval.ts)    │  Mehrstufiges Matching (siehe §4)
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  4. SCORING & RANKING           │  Gewichtete Kombination aller Signale
│     (scoring-engine.ts)         │  (siehe §5)
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  5. POST-PROCESSING             │  Allergen-Ausschluss, Deduplizierung,
│     (post-processor.ts)         │  Limit-Anwendung
└─────────────┬───────────────────┘
              │
              ▼
         SearchResult[]
```

---

## 2. Input Preprocessing

### 2.1 Normalisierung (bestehend, erweitert)

Die bestehende `normalizeName()` bleibt die Basis. Zusätzlich:

```
Eingabe → lowercase → ß→ss → NFD-Stripping → Sonderzeichen→Leerzeichen → trim
```

### 2.2 ALDI-Prefix-Bereinigung (NEU)

Produktnamen enthalten interne Prefixe wie `"KA: "`, die für Nutzer irrelevant sind. Diese werden **beim Indexieren** (nicht bei jeder Suche) einmalig entfernt.

```
Bekannte Prefixe: "KA:", "KA :", weitere bei Bedarf ergänzen
"KA: Batterien AA 8 Stk." → "Batterien AA 8 Stk."
```

**Implementierung:** Neues Feld `search_name` (abgeleitet, nicht in DB), das beim Laden der Produkte in den Speicher erzeugt wird. Alle Matching-Operationen laufen gegen `search_name`.

### 2.3 Mengenangaben-Stripping (NEU)

Gewichts-/Mengenangaben am Ende des Produktnamens werden für das Matching entfernt, bleiben aber im Anzeigenamen erhalten.

```
Pattern: /\s+\d+[\.,]?\d*\s*(g|kg|ml|l|cl|stk|stück|pac|er|kne)\s*\.?\s*$/i
"Rundkorn Reis 500g"       → search_name: "Rundkorn Reis"
"Ferrero Paradiso 4er 116g" → search_name: "Ferrero Paradiso"
"Raeucherlachs 200g"       → search_name: "Raeucherlachs"
```

**Achtung:** Das Pattern muss konservativ sein. Im Zweifel lieber zu wenig strippen als zu viel. Edge Cases systematisch mit echten Daten testen.

### 2.4 Pluralformen-Normalisierung (NEU)

Deutsche Pluralbildung ist komplex. Wir nutzen einen pragmatischen Ansatz mit **bidirektionalem Suffix-Matching**, kein vollständiges Stemming.

```
Strategie: Query UND Produktname werden auf gemeinsamen Stamm reduziert.

Suffixe (in dieser Reihenfolge prüfen):
  -en  → Tomate/Tomaten, Kartoffel/Kartoffeln
  -n   → Birne/Birnen
  -e   → Wurst/Würste (begrenzt nützlich wegen Umlaut)
  -er  → Ei/Eier (begrenzt)
  -s   → Joghurt/Joghurts

Mindeststammlänge: 4 Zeichen (verhindert Übermatch bei kurzen Wörtern)
```

**Implementierung:** Funktion `getStemVariants(word: string): string[]` gibt den Originalterm + Varianten zurück. Beim Matching wird geprüft, ob **irgendeine** Variante matcht.

---

## 3. Query Classification

### 3.1 Smart Default bei leerer Query (NEU)

Wenn die Query leer ist oder der Nutzer nur das Suchfeld antippt:

```
Priorität:
1. Persönliche Top-Produkte (aus user_product_preferences, sortiert nach
   gewichtetem Score aus purchase_count + recency)
2. Wenn keine persönlichen Daten: keine Ergebnisse (aktuelles Verhalten)
```

**Limit:** 10 Produkte. Wird nur angezeigt, wenn `user_product_preferences` mindestens 3 Einträge hat, damit die Liste sinnvoll wirkt.

### 3.2 Bestehende Kommando-Erkennung

Bleibt unverändert:
- `isLastTripCommand()` → Letzte Einkäufe
- `isAktionsartikelCommand()` → Aktionsartikel

### 3.3 Retailer-Prefix-Erkennung (Implementiert)

`detectRetailerPrefix()` erkennt einen vollständigen Retailer-Namen am Anfang der Query (case-insensitive).

```
"Rossmann"          → { retailer: Rossmann, productQuery: "" }
"Rossmann Shampoo"  → { retailer: Rossmann, productQuery: "Shampoo" }
```

**Verhalten:** Statt der normalen ALDI-Produktsuche wird die `search_retailer_products` Supabase-RPC aufgerufen. Diese gibt `competitor_products` zurück, die über `competitor_product_prices` oder `competitor_product_stats` dem Retailer zugeordnet sind.

**Ranking:**
1. Persönliche Kaufhäufigkeit (`competitor_product_stats.purchase_count` für den aktuellen User) DESC
2. Globale Kaufhäufigkeit (Summe aller User) DESC
3. Produktname ASC

**Filterung:** Wenn ein Produkt-Subquery vorhanden ist (z.B. "Shampoo"), wird `ILIKE` auf `name_normalized` und `brand` angewandt.

**Tracking:** Beim Abhaken eines Elsewhere-Items mit `competitor_product_id` wird ein Upsert in `competitor_product_stats` durchgeführt (fire-and-forget, blockiert nicht die Item-Löschung).

### 3.4 EAN-Barcode-Erkennung

Bleibt unverändert: Query besteht aus ≥ 4 Ziffern → EAN-Lookup.

### 3.5 Textsuche

Alles andere → weiter zu Candidate Retrieval (§4).

---

## 4. Candidate Retrieval (Treffer finden)

### 4.1 Philosophie

Das Retrieval sammelt **alle potenziell relevanten Produkte** mit einem `matchType`, der die Qualität des Treffers beschreibt. Die Sortierung erfolgt danach in der Scoring-Engine (§5). Das Retrieval filtert **nicht** nach Score – es liefert Kandidaten.

### 4.2 Match-Typen (Hierarchie)

Jeder Kandidat erhält genau einen `matchType`. Bei Mehrfach-Match zählt der höchste.

```typescript
enum MatchType {
  EXACT_NAME        = 1,  // Query === Produktname (nach Normalisierung)
  NAME_STARTS_WITH  = 2,  // Produktname beginnt mit Query
  NAME_FIRST_WORD   = 3,  // Erstes Wort des Produktnamens matcht
  NAME_CONTAINS     = 4,  // Query ist Substring im Produktnamen
  MULTI_WORD_ALL    = 5,  // Alle Query-Wörter kommen im Namen vor
  CATEGORY_MATCH    = 6,  // Query matcht Oberbegriff/Synonym → Kategorie
  BRAND_MATCH       = 7,  // Query matcht Markenname
  DEMAND_GROUP      = 8,  // Query matcht demand_group
  FUZZY_MATCH       = 9,  // Levenshtein-Distanz ≤ Schwellwert (Phase 2)
}
```

### 4.3 Matching-Pipeline

Die Pipeline läuft **alle Stufen durch** für jedes Produkt und weist den besten `matchType` zu. Kein frühes Abbrechen mehr – das ermöglicht korrektes Scoring.

```
Für jedes Produkt p:
  1. EXACT_NAME:       normalize(query) === p.search_name_normalized
  2. NAME_STARTS_WITH: p.search_name_normalized.startsWith(normalize(query))
  3. NAME_FIRST_WORD:  erstes Wort von p.search_name_normalized === query
                       ODER erstes Wort von p.search_name_normalized === stemVariant(query)
  4. NAME_CONTAINS:    p.search_name_normalized.includes(normalize(query))
                       → ABER: Wortgrenzen-Check (siehe §4.4)
  5. MULTI_WORD_ALL:   Bei Multi-Wort-Query: jedes Query-Wort (inkl. Stem-Varianten)
                       kommt im Namen vor
  6. CATEGORY_MATCH:   Query matcht Eintrag in Synonym-Map (siehe §4.5)
                       → alle Produkte dieser Kategorie/demand_group sind Kandidaten
  7. BRAND_MATCH:      Query matcht p.brand (Prefix oder exakt)
  8. DEMAND_GROUP:     Query ist Substring von p.demand_group
  9. FUZZY_MATCH:      Levenshtein(query, jedes Wort in p.search_name_normalized) ≤ 2
                       (nur Phase 2)
```

### 4.4 Wortgrenzen-Logik (NEU) – Das "Wein ≠ Weintraube"-Problem

**Problem:** Substring-Match `"wein"` trifft sowohl `"rotwein"` als auch `"weintraube"`. Aber "Rotwein" ist ein Wein, "Weintraube" ist kein Wein.

**Lösung: Wortposition-Analyse**

```
Ein Substring-Treffer wird klassifiziert:

DOMINANT_MATCH:  Query bildet das Kern-/Stammwort des Produktnamens
                 → Query am ENDE eines zusammengesetzten Wortes
                 → z.B. "wein" in "Rotwein", "Weißwein", "Glühwein"
                 → ODER Query am Anfang und das Wort IST die Query
                 → z.B. "wasser" in "Wasser Classic"

MODIFIER_MATCH:  Query ist Bestandteil, aber nicht das Kernprodukt
                 → Query am ANFANG eines zusammengesetzten Wortes, gefolgt von mehr
                 → z.B. "wein" in "Weintraube", "Weinessig", "Weinblätter"
                 → ODER Query nach Präposition ("in", "mit", "und", "auf")
                 → z.B. "wasser" in "Thunfisch in Wasser"

STANDALONE_MATCH: Query ist eigenständiges Wort im Produktnamen
                  → z.B. "reis" in "Rundkorn Reis 500g"
                  → Höchste Relevanz bei NAME_CONTAINS
```

**Implementierung:**

```typescript
type SubstringPosition = 'standalone' | 'dominant' | 'modifier';

function classifySubstringMatch(
  queryNorm: string,
  productNameNorm: string
): SubstringPosition | null {
  const words = productNameNorm.split(' ');
  const prepositions = ['in', 'mit', 'und', 'auf', 'aus', 'ohne', 'zum', 'zur'];

  // 1. Eigenständiges Wort?
  if (words.includes(queryNorm)) return 'standalone';

  // 2. Zusammengesetztes Wort analysieren
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.includes(queryNorm)) continue;

    // Nach Präposition → modifier
    if (i > 0 && prepositions.includes(words[i - 1])) return 'modifier';

    // Query am Ende des Wortes → dominant (Rot-WEIN, Mineral-WASSER)
    if (word.endsWith(queryNorm) && word.length > queryNorm.length) return 'dominant';

    // Query am Anfang des Wortes → modifier (WEIN-traube, WASSER-melone)
    if (word.startsWith(queryNorm) && word.length > queryNorm.length) return 'modifier';
  }

  return null; // Kein Match
}
```

**Scoring-Auswirkung (in §5):**
- `standalone` → voller Match-Score
- `dominant` → voller Match-Score
- `modifier` → stark reduzierter Match-Score (Produkt erscheint weit unten, nicht oben)

### 4.5 Oberbegriff- & Synonym-Mapping (NEU)

Statische Map, die Suchbegriffe auf `demand_group`-Prefixe oder `category_id`s abbildet.

```typescript
// src/lib/search/synonym-map.ts

interface SynonymEntry {
  demand_group_prefixes?: string[];  // Matcht gegen Anfang von demand_group
  category_ids?: string[];           // Direkte Kategorie-IDs
}

const SYNONYM_MAP: Record<string, SynonymEntry> = {
  // Oberbegriffe → demand_groups
  "wein":       { demand_group_prefixes: ["39-Wein"] },
  "bier":       { demand_group_prefixes: ["40-Bier"] },
  "wasser":     { demand_group_prefixes: ["38-Mineral", "38-Wasser"] },
  "saft":       { demand_group_prefixes: ["37-Fruchtsaft", "37-Saft"] },
  "käse":       { demand_group_prefixes: ["65-Käse", "66-Käse"] },
  "fleisch":    { demand_group_prefixes: ["60-Frisch", "61-Rind", "62-Schwein", "63-Geflügel"] },
  "fisch":      { demand_group_prefixes: ["71-Gekühlter"] },
  "brot":       { demand_group_prefixes: ["80-Brot", "81-Back"] },

  // Synonyme → gleicher Oberbegriff
  "joghurt":    { demand_group_prefixes: ["67-Joghurt", "67-Milchfrisch"] },
  "yoghurt":    { demand_group_prefixes: ["67-Joghurt", "67-Milchfrisch"] },
  "jogurt":     { demand_group_prefixes: ["67-Joghurt", "67-Milchfrisch"] },
};
```

**Wichtig:** Diese Map muss gegen die tatsächlichen `demand_group`-Werte in der Datenbank validiert werden. Die obigen Werte sind Platzhalter.

**Pflege:** Neue Einträge werden manuell hinzugefügt, basierend auf Nutzer-Feedback und Suchanfragen, die keine guten Ergebnisse liefern. Langfristig könnte ein AI-gestütztes Mapping hinzukommen.

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

Basiert auf `matchType` aus dem Retrieval (§4):

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
Default:   0.5 (solange keine ALDI-Daten vorliegen)
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
  // Berechnete Felder (nicht in DB)
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
| 1.7 | Pluralformen-Normalisierung | `stemmer.ts` | S |
| 1.8 | Post-Processing: Abgelaufene Aktionsartikel ausschließen | `post-processor.ts` | S |

### Phase 2 – Personalisierung

Ziel: Suche wird persönlich und populäre Produkte steigen auf.

| # | Feature | Dateien | Aufwand |
|---|---|---|---|
| 2.1 | `popularity_score` Default auf 0.5 setzen (DB-Migration) | Migration SQL | S |
| 2.2 | `user_product_preferences` beim App-Start laden | `user-history-loader.ts` | S |
| 2.3 | personalScore: Kaufhäufigkeit + Recency-Decay | `scoring-engine.ts` | M |
| 2.4 | popularityScore in Scoring-Engine integrieren | `scoring-engine.ts` | S |
| 2.5 | Smart Default bei leerer Query | `query-classifier.ts` | M |
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
├── candidate-retrieval.ts      # NEU: Matching-Pipeline mit MatchTypes
├── scoring-engine.ts           # NEU: Gewichtete Score-Berechnung
├── post-processor.ts           # NEU: Ausschlüsse, Limits
├── word-boundary.ts            # NEU: Wortgrenzen-Klassifikation
├── synonym-map.ts              # NEU: Oberbegriffe & Synonyme
├── stemmer.ts                  # NEU: Pluralformen-Normalisierung
├── search-indexer.ts           # NEU: SearchableProduct-Aufbereitung
├── normalize.ts                # Bestehend: nameMatchesQuery (wird abgelöst)
├── commands.ts                 # Bestehend: Kommando-Erkennung
├── local-search.ts             # Bestehend: wird refactored → orchestriert neue Module
└── constants.ts                # NEU: Gewichte, Schwellwerte, Konfiguration
```

---

## 11. Konfiguration & Tuning

Alle Schwellwerte und Gewichte werden in `constants.ts` zentral definiert, damit sie leicht anpassbar sind:

```typescript
// src/lib/search/constants.ts

export const SEARCH_CONFIG = {
  // Limits
  MAX_RESULTS: 20,
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
| 3 | Soll `popularity_score` per Migration auf 0.5 gesetzt werden oder im Code als Default behandelt? | VORSCHLAG | Im Code: `product.popularity_score ?? 0.5` |
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
