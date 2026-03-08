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
| **Local-first** | Alle Suchdaten liegen im Speicher (IndexedDB → RAM). Kein Server-Call für die Kernsuche. Latenz < 50ms. |
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
│  2. CANDIDATE RETRIEVAL         │  Produkte finden, die zur Query passen
│     (candidate-retrieval.ts)    │  Mehrstufiges Matching (siehe §4)
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  3. SCORING & RANKING           │  Gewichtete Kombination aller Signale
│     (scoring-engine.ts)         │  (siehe §5)
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  4. POST-PROCESSING             │  Allergen-Ausschluss, Deduplizierung,
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

**Scoring-Auswirkung (in [SEARCH-SCORING.md](./SEARCH-SCORING.md) §5):**
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

## See also

- **[SEARCH-SCORING.md](./SEARCH-SCORING.md)** — Scoring Engine (Signale, Gewichte, Sortierung), Post-Processing, Indexierung, Synonym-Map-Pflege, Implementierungsphasen, Konfiguration, Catalog Scoring und offene Fragen.
