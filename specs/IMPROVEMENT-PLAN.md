# Improvement Plan — Code Quality, Architecture & Process

Erstellt: 2026-03-03 · Basierend auf Analyse von 155 Chat-Sessions, Codebase-Review und Architektur-Audit.

---

## Übersicht: 8 Sessions, 12 Aufgaben

| Session | Aufgabe | Parallelisierbar mit | Modell | Geschätzte Nachrichten |
|---------|---------|---------------------|--------|----------------------|
| S1 | Supabase Types generieren | — | Schnelles Modell | 3-4 |
| S2 | Hardcodiertes Jahr fixen + ESLint aktivieren | — | Schnelles Modell | 3-4 |
| S3 | `use-list-data.ts` aufbrechen (Part 1: Hooks extrahieren) | — | Starkes Modell | 8-10 |
| S4 | `use-list-data.ts` aufbrechen (Part 2: Tests) | — | Mittleres Modell | 6-8 |
| S5 | `shopping-list-content.tsx` aufbrechen | — | Starkes Modell | 8-10 |
| S6 | `product-search.tsx` aufbrechen + add-to-list DRY | — | Mittleres Modell | 6-8 |
| S7 | Tests: API-Routes + Listen-Operationen | — | Mittleres Modell | 6-8 |
| S8 | Code-Review der Ergebnisse | — | Starkes Modell (Ask Mode) | 5-6 |

**S1 und S2 können parallel laufen** (unabhängige Änderungen an verschiedenen Dateien).
Alle anderen Sessions sind sequenziell, da sie aufeinander aufbauen.

---

## S1: Supabase Types generieren

**Ziel:** Manuelle `rowToProduct`-Konvertierung durch generierte Types ersetzen.

**Modell:** Schnelles Modell

### Prompt:

```
Aufgabe: Supabase TypeScript Types generieren und einbinden.

Schritte:
1. Lies src/lib/products-context.tsx — finde die Funktion `rowToProduct` die manuell 
   Record<string, unknown> in Product konvertiert.
2. Führe aus: npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/supabase.ts
   (Die Project-ID findest Du in .env.local unter NEXT_PUBLIC_SUPABASE_URL — der Teil zwischen 
   https:// und .supabase.co)
3. Ersetze in products-context.tsx die manuelle Konvertierung durch typisierte Supabase-Queries.
4. Prüfe alle anderen Stellen mit Record<string, unknown> oder .from("table") ohne Typparameter.

Akzeptanzkriterien:
- src/types/supabase.ts existiert mit generierten Types
- rowToProduct ist entfernt oder auf < 5 Zeilen reduziert
- Alle Supabase .from()-Aufrufe nutzen generierte Types
- `npx tsc --noEmit` hat keine neuen Fehler
- `npx vitest run` läuft durch

Nicht anfassen: Die Product-Interfaces in src/types/index.ts bleiben als App-Level Types bestehen.
```

---

## S2: Hardcodiertes Jahr + ESLint aktivieren

**Ziel:** Zwei Quick-Fixes die sofort Fehlerklassen eliminieren.

**Modell:** Schnelles Modell

**Kann parallel zu S1 laufen.**

### Prompt:

```
Aufgabe: Zwei Quick-Fixes.

Fix 1 — Hardcodiertes Jahr:
Datei: src/lib/api/photo-processing/prompts.ts
Problem: "Das aktuelle Jahr ist 2026" ist zweimal hardcodiert (Zeilen 10 und 53).
Lösung: Ersetze durch Template-Literal mit new Date().getFullYear().

Fix 2 — ESLint bei Builds aktivieren:
Datei: next.config.js
Problem: eslint: { ignoreDuringBuilds: true } unterdrückt alle Lint-Fehler.
Lösung: 
1. Entferne ignoreDuringBuilds: true
2. Führe `npx next lint` aus
3. Fixe alle Fehler die auftreten (wahrscheinlich unused vars, missing deps)
4. Wenn ein Fehler nicht sinnvoll fixbar ist, füge einen gezielten // eslint-disable Kommentar hinzu

Akzeptanzkriterien:
- Kein hardcodiertes "2026" mehr in prompts.ts
- `npx next lint` läuft fehlerfrei
- `npx next build` läuft fehlerfrei
```

---

## S3: `use-list-data.ts` aufbrechen — Part 1

**Ziel:** Den 1017-Zeilen-Hook in fokussierte Hooks dekomponieren.

**Modell:** Starkes Modell (komplexes Refactoring mit vielen Abhängigkeiten)

### Prompt:

```
Aufgabe: Dekomponiere src/components/list/use-list-data.ts (1017 Zeilen) in kleinere Hooks.

Lies zuerst die gesamte Datei und identifiziere die logischen Blöcke.

Ziel-Struktur:
1. src/components/list/hooks/use-list-fetch.ts 
   — fetchListData, buildProductMaps, refetch-Logik, Supabase-Channel-Subscription
2. src/components/list/hooks/use-list-sort.ts 
   — sortAndGroupItems, Sortier-Logik, demand-group-Ordering
3. src/components/list/hooks/use-auto-reorder.ts 
   — processAutoReorder, Auto-Reorder-Settings, deferred-items-Logik
4. src/components/list/hooks/use-list-mutations.ts 
   — addItem, removeItem, updateItem, checkOff, optimistic updates mit rollback
5. src/components/list/use-list-data.ts 
   — orchestriert die 4 Hooks, exportiert UseListDataResult (max 100 Zeilen)

Regeln:
- Jeder Hook < 250 Zeilen
- Alle bestehenden Exports und das UseListDataResult-Interface bleiben API-kompatibel
- Keine Änderungen an Dateien die use-list-data importieren
- Keine Funktionalitäts-Änderungen — reines Refactoring

Akzeptanzkriterien:
- use-list-data.ts < 100 Zeilen (Orchestrierung)
- Kein Hook > 250 Zeilen
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
- Manueller Test: Einkaufsliste öffnen, Produkt hinzufügen, abhaken, löschen — alles funktioniert
```

---

## S4: Tests für die neuen List-Hooks

**Ziel:** Testabdeckung für die in S3 extrahierten Hooks.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Schreibe Vitest-Tests für die neuen List-Hooks.

Lies die Dateien:
- src/components/list/hooks/use-list-mutations.ts
- src/components/list/hooks/use-auto-reorder.ts
- src/components/list/hooks/use-list-sort.ts

Erstelle:
1. src/components/list/hooks/__tests__/use-list-mutations.test.ts
   - Test: addItem fügt Item hinzu und ruft onAdded callback
   - Test: removeItem entfernt Item und reverted bei Fehler (optimistic rollback)
   - Test: checkOff markiert Item und updated checked-Liste
   - Test: updateItem ändert Menge

2. src/components/list/hooks/__tests__/use-auto-reorder.test.ts
   - Test: deferred special wird aktiviert wenn special_start_date erreicht
   - Test: elsewhere-Item wird korrekt als deferred markiert
   - Test: Items ohne auto-reorder-Setting bleiben unverändert

3. src/components/list/hooks/__tests__/use-list-sort.test.ts
   - Test: "my-order" sortiert nach Hinzufüge-Reihenfolge
   - Test: "shopping-order" gruppiert nach demand_group
   - Test: Aktionsartikel-Gruppe erscheint am Ende

Regeln:
- Mocke Supabase-Calls mit vi.mock
- Nutze das Test-Pattern aus src/lib/search/__tests__/search-pipeline.test.ts als Vorlage
- Jeder Test: Arrange → Act → Assert

Akzeptanzkriterien:
- Alle Tests grün: `npx vitest run src/components/list`
- Mindestens 12 Testfälle insgesamt
- Kein Test braucht eine echte Datenbank
```

---

## S5: `shopping-list-content.tsx` aufbrechen

**Ziel:** Die 675-Zeilen-Komponente in fokussierte Sub-Components dekomponieren.

**Modell:** Starkes Modell

### Prompt:

```
Aufgabe: Dekomponiere src/components/list/shopping-list-content.tsx (675 Zeilen, 
16 useState, 6 Modals) in kleinere Komponenten.

Lies die gesamte Datei zuerst.

Ziel-Struktur:
1. src/components/list/hooks/use-list-modals.ts
   — Custom Hook der alle Modal-States (detail, edit, generic-picker, 
   retailer-picker, competitor-form, competitor-detail) als Reducer verwaltet.
   Statt 12 useState → 1 useReducer mit actions: openDetail, openEdit, 
   openGenericPicker, etc.

2. src/components/list/hooks/use-competitor-actions.ts
   — Competitor/Elsewhere-Logik: handleElsewhereCheckoff, handleCompetitorSave, 
   retailer-picking. Extrahiert aus Zeilen ~167-232.

3. src/components/list/list-section.tsx
   — Rendert eine Kategorie-Gruppe (Header + Items). Extrahiert aus dem 
   JSX-Rendering-Block.

4. src/components/list/shopping-list-content.tsx
   — Orchestriert die Hooks und Sub-Components (max 200 Zeilen)

Regeln:
- Alle Props-Interfaces bleiben API-kompatibel
- ShoppingListContentProps ändert sich nicht
- memo() bleibt erhalten
- Keine Funktionalitäts-Änderungen

Akzeptanzkriterien:
- shopping-list-content.tsx < 200 Zeilen
- Kein neuer Hook/Component > 200 Zeilen
- `npx tsc --noEmit` fehlerfrei
- Manueller Test: Liste mit Produkten öffnen, Produkt antippen (Detail-Modal), 
  "Woanders"-Flow testen, Generic-Picker testen
```

---

## S6: `product-search.tsx` aufbrechen + DRY

**Ziel:** Add-to-List-Logik extrahieren, die 4 redundanten add-Funktionen vereinheitlichen.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Extrahiere die Add-to-List-Logik aus src/components/search/product-search.tsx (683 Zeilen).

Lies die Datei und identifiziere die 4 add-Funktionen:
- addGeneric, addSpecific, addCompetitorProduct, addProductFromBarcode

Diese Funktionen teilen ~70% ihrer Logik (getOrCreateActiveList, construct params, 
addListItem, error handling, reset state, onAdded callback).

Ziel-Struktur:
1. src/components/search/hooks/use-add-to-list.ts
   — Custom Hook mit einer generischen addToList(params)-Funktion
   — Übernimmt: activeList holen/erstellen, addListItem aufrufen, 
     error handling, state reset, onAdded callback
   — Exportiert: addGeneric, addSpecific, addCompetitorProduct, addFromBarcode
     als spezialisierte Wrapper

2. src/components/search/product-search.tsx
   — Nutzt useAddToList() statt der 4 inline-Funktionen
   — Ziel: < 400 Zeilen

Akzeptanzkriterien:
- product-search.tsx < 400 Zeilen
- use-add-to-list.ts < 200 Zeilen
- Alle 4 Add-Flows funktionieren: generisches Produkt, spezifisches Produkt, 
  Competitor-Produkt, Barcode-Produkt
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei

Schreibe zusätzlich:
- src/components/search/hooks/__tests__/use-add-to-list.test.ts
  - Test: addGeneric erstellt Liste wenn keine existiert
  - Test: addSpecific fügt Produkt mit product_id hinzu
  - Test: Fehler bei addListItem wird geloggt und state wird zurückgesetzt
```

---

## S7: Tests für API-Routes

**Ziel:** Testabdeckung für die wichtigsten API-Endpoints.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Schreibe Vitest-Tests für die API-Route-Validierung.

Lies die Route-Handler:
- src/app/api/process-photo/route.ts
- src/app/api/products/search/route.ts
- src/app/api/feedback/route.ts

Erstelle:
1. src/app/api/process-photo/__tests__/route.test.ts
   - Test: Gibt 400 bei fehlendem upload_id
   - Test: Gibt 400 bei ungültiger photo_url (keine URL)
   - Test: Gibt 429 bei Rate-Limit-Überschreitung
   - Test: Akzeptiert validen Input (mocke Claude/Gemini-Call)

2. src/app/api/products/search/__tests__/route.test.ts
   - Test: Gibt 400 bei fehlendem query-Parameter
   - Test: Gibt 400 bei leerem query
   - Test: Gibt 200 mit Array bei validem query

3. src/app/api/feedback/__tests__/route.test.ts
   - Test: Gibt 400 bei fehlendem feedback_type
   - Test: Gibt 200 bei validem Feedback

Regeln:
- Mocke externe Services (Supabase, Gemini, Rate-Limiter)
- Nutze Zod-Schemas aus den Route-Dateien als Referenz
- Teste nur Validierung und Error-Handling, nicht die externe API-Integration

Akzeptanzkriterien:
- Mindestens 10 Testfälle
- Alle grün: `npx vitest run src/app/api`
- Kein Test braucht echte API-Keys oder Datenbank
```

---

## S8: Code-Review der Ergebnisse

**Ziel:** Qualitätssicherung nach allen Refactorings.

**Modell:** Starkes Modell, **Ask Mode**

### Prompt:

```
Aufgabe: Code-Review nach dem Refactoring.

Prüfe:
1. Dateigrössen: Hat jede Datei < 300 Zeilen? Liste Verstösse auf.
2. Tests: Führe `npx vitest run` aus. Alle grün?
3. TypeScript: Führe `npx tsc --noEmit` aus. Keine Fehler?
4. Lint: Führe `npx next lint` aus. Keine Fehler?
5. Architektur: Sind die Hook-Abhängigkeiten klar? Gibt es zirkuläre Imports?
6. Code-Duplizierung: Gibt es noch createClientIfConfigured()-Pattern-Wiederholungen?
7. Test-Coverage: Welche kritischen Pfade sind noch nicht getestet?

Erstelle eine Zusammenfassung mit:
- ✅ Was gut ist
- ⚠️ Was verbessert werden sollte (als neue Backlog-Items)
- 🔴 Was gebrochen ist (sofort fixen)
```

---

## Parallelisierungs-Matrix

```
Woche 1:
  S1 (Supabase Types) ──────┐
                              ├── parallel
  S2 (Jahr + ESLint)  ──────┘

Woche 1-2:
  S3 (use-list-data aufbrechen) ─── sequenziell ──→ S4 (Tests dafür)

Woche 2:
  S5 (shopping-list-content aufbrechen)

Woche 2-3:
  S6 (product-search aufbrechen)

Woche 3:
  S7 (API-Route Tests)

Woche 3:
  S8 (Code-Review)
```

---

## Laufender Feedback-Mechanismus

Die Cursor Rule `developer-feedback.mdc` sorgt dafür, dass du nach JEDER Session
automatisch Feedback bekommst zu:
- Prompt-Qualität
- Architektur-Entscheidungen
- Prozess (Scope, Tests, nächste Schritte)

### Zusätzlich: Monatliches Self-Review

Einmal im Monat eine Session im Ask Mode starten:

```
Analysiere meine letzten 20 Chat-Sessions:
1. Wie war meine Prompt-Qualität? (Spezifität, Akzeptanzkriterien, Kontext)
2. Wie oft musste ich korrigieren? Warum?
3. Welche Fehler-Muster wiederholen sich?
4. Was hat sich verbessert seit dem letzten Review?
5. Top 3 Empfehlungen für den nächsten Monat.
```

### Quick-Reference: Prompt-Template

Nutze dieses Template für jede Implementierungs-Session:

```
Aufgabe: [1 Satz was gemacht werden soll]

Kontext:
- Betroffene Dateien: [Liste]
- Zusammenhang: [warum diese Änderung nötig ist]

Schritte:
1. [konkreter Schritt]
2. [konkreter Schritt]

Akzeptanzkriterien:
- [ ] [testbares Kriterium]
- [ ] [testbares Kriterium]
- [ ] `npx tsc --noEmit` fehlerfrei
- [ ] `npx vitest run` fehlerfrei

Nicht anfassen: [explizite Ausschlüsse]
```
