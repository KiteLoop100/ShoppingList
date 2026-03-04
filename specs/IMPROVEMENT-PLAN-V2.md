# Improvement Plan V2 — Post-Refactoring Stabilisierung & Vertiefung

Erstellt: 2026-03-04 · Basierend auf Ergebnissen von IMPROVEMENT-PLAN V1 (8 Sessions), Code-Review S8, und aktuellem Codebase-Stand.

---

## Status-Zusammenfassung V1

### Was erfolgreich umgesetzt wurde

| Session | Ziel | Ergebnis |
|---------|------|----------|
| S1 | Supabase Types generieren | ✅ `src/types/supabase.ts` generiert, `rowToProduct` auf 10 Zeilen reduziert |
| S2 | Hardcodiertes Jahr + ESLint | ✅ Jahr dynamisch, ESLint aktiviert, Build grün |
| S3 | `use-list-data.ts` aufbrechen | ✅ 1017 → 6 Dateien, Orchestrator 98 Zeilen |
| S4 | Tests für List-Hooks | ✅ 34 Tests, alle grün |
| S5 | `shopping-list-content.tsx` aufbrechen | ✅ 675 → 5 Dateien, max 197 Zeilen |
| S6 | `product-search.tsx` + DRY | ⚠️ `use-add-to-list.ts` extrahiert (199 Zeilen), aber `product-search.tsx` noch 526 Zeilen (Ziel war <400) |
| S7 | Tests für API-Routes | ✅ 20 Tests, alle grün |
| S8 | Code-Review | ✅ Durchgeführt, Backlog erstellt |

### Was offen geblieben ist

| Item | Quelle | Status |
|------|--------|--------|
| Vitest sammelt Playwright-Tests → 2 Failed Suites | S8 🔴 | **Offen — Quick Fix** |
| ESLint Error `react-hooks/rules-of-hooks` in `use-add-to-list.test.ts` | S8 🔴 | **Offen — Quick Fix** |
| `product-search.tsx` noch 526 Zeilen (Ziel war <400) | S6 Feedback | **Offen** |
| Supabase typed client nicht global aktiviert (229+ Type-Errors) | S1 Feedback | **Offen — grosses Projekt** |
| `createClientIfConfigured()` ~80× wiederholt in 30+ Dateien | S8 B2 | **Offen** |
| 6 Dateien > 300 Zeilen | S8 B3 | **Offen** |
| Lint-Warnings: 8× `no-unused-vars`, 4× `exhaustive-deps`, 15× `<img>` | S8 B4/B6 | **Offen** |
| ARIA `aria-selected` auf `role="option"` fehlt | S8 B7 | **Offen** |
| Test-Coverage für core business logic (`active-list`, `archive-trip`) | S8 B5 | **Offen** |

---

## Aktueller Codebase-Stand (2026-03-04)

### Checks

| Check | Ergebnis |
|-------|----------|
| `npx tsc --noEmit` | ✅ 0 Fehler |
| `npx vitest run` | ⚠️ 97/97 Tests grün, aber 2 Failed Suites (Playwright in Vitest) |
| `npx next lint` | ⚠️ 0 Errors (1 Error in Test-Datei), ~40 Warnings |
| Build | ✅ Grün (laut S2) |

### Dateien > 300 Zeilen

| Datei | Zeilen | Priorität |
|-------|--------|-----------|
| `product-search.tsx` | 526 | Hoch — war schon S6-Ziel |
| `list-item-row.tsx` | 505 | Hoch — komplexe UI-Logik |
| `process-receipt/route.ts` | 498 | Mittel — API-Route |
| `competitor-product-form-modal.tsx` | 494 | Mittel — Modal mit Form-State |
| `competitor-product-service.ts` | 417 | Mittel — Service-Modul |
| `active-list.ts` | 414 | Mittel — Core Business Logic |

### `createClientIfConfigured()` Verteilung

~80 Aufrufe in 30+ Dateien. Die grössten Nutzer:
- `competitor-product-service.ts` (12×)
- `auth-context.tsx` (7×)
- `active-list.ts` (7×)
- `use-product-creation.ts` (4×)

---

## V2: 10 Sessions, priorisiert nach Hebel

| Session | Aufgabe | Hebel | Modell | Nachrichten |
|---------|---------|-------|--------|-------------|
| S9 | Quick Fixes: Vitest-Config + ESLint-Error | Sofort — bricht CI | Schnell | 2-3 |
| S10 | Lint-Warnings bereinigen | Codequalität | Schnell | 4-5 |
| S11 | `withSupabase()` Wrapper extrahieren | DRY — eliminiert ~80 Guards | Mittel | 6-8 |
| S12 | `product-search.tsx` weiter aufbrechen | Dateigrösse 526→<300 | Mittel | 6-8 |
| S13 | `list-item-row.tsx` aufbrechen | Dateigrösse 505→<300 | Stark | 8-10 |
| S14 | `competitor-product-form-modal.tsx` aufbrechen | Dateigrösse 494→<300 | Mittel | 6-8 |
| S15 | `process-receipt/route.ts` + `active-list.ts` aufbrechen | Dateigrösse + Testbarkeit | Mittel | 6-8 |
| S16 | Tests: Core Business Logic | Abdeckung für `active-list`, `archive-trip` | Mittel | 6-8 |
| S17 | `<img>` → `<Image />` + ARIA-Accessibility | Performance + A11y | Schnell | 4-5 |
| S18 | Code-Review V2 | Qualitätssicherung | Stark (Ask) | 5-6 |

**S9 und S10 können parallel laufen.**

---

## S9: Quick Fixes — Vitest-Config + ESLint-Error

**Ziel:** Die zwei 🔴-Items aus S8 sofort beheben.

**Modell:** Schnelles Modell

### Prompt:

```
Aufgabe: Zwei Quick Fixes aus dem Code-Review.

Fix 1 — Vitest-Config:
Datei: vitest.config.ts
Problem: Vitest sammelt Playwright-Tests aus tests/*.spec.ts auf, was 2 "Failed Suites" 
bei jedem `npx vitest run` verursacht.
Lösung: Füge `exclude: ["tests/**", "node_modules/**"]` in die test-Config ein.

Fix 2 — ESLint-Error in Test:
Datei: src/components/search/hooks/__tests__/use-add-to-list.test.ts
Problem: `createHook` Funktion ruft `useAddToList` auf — verstösst gegen 
react-hooks/rules-of-hooks.
Lösung: Benenne `createHook` zu `useCreateHook` um, oder verwende `renderHook` 
von @testing-library/react-hooks. Stelle sicher, dass alle Tests weiterhin grün sind.

Akzeptanzkriterien:
- `npx vitest run` zeigt 0 Failed Suites
- `npx next lint` zeigt 0 Errors
- Alle bestehenden Tests bleiben grün
```

---

## S10: Lint-Warnings bereinigen

**Ziel:** Alle ESLint-Warnings systematisch beseitigen.

**Modell:** Schnelles Modell

**Kann parallel zu S9 laufen.**

### Prompt:

```
Aufgabe: ESLint-Warnings bereinigen. Führe zuerst `npx next lint` aus, 
um den aktuellen Stand zu sehen.

Kategorien:

1. no-unused-vars (8 Stellen):
   Entferne oder nutze die Variablen. Bei Destructuring-Patterns wie `const { _, _l, ... }` 
   in archive-trip.ts — verwende `omit`-Helper oder Object.keys-Filter statt Destructuring.

2. react-hooks/exhaustive-deps (4 Stellen):
   Prüfe jeden Fall einzeln:
   - Wenn die Dependency wirklich fehlt → hinzufügen
   - Wenn absichtlich ausgelassen → eslint-disable mit Kommentar warum
   - Wenn Restructuring nötig (z.B. subGroupOptions in useEffect) → useMemo nutzen

3. no-unused-vars in Test-Dateien:
   Entferne unused imports/variables.

Regeln:
- Keine funktionalen Änderungen
- Jede Änderung einzeln committen ist NICHT nötig — ein Gesamt-Commit reicht
- Achtung: `archive-trip.ts` nutzt Destructuring um Properties zu entfernen — 
  das Pattern ist ok, aber die Variablen sollten mit _ prefixed sein 
  (prüfe ob @typescript-eslint/no-unused-vars _ erlaubt)

Akzeptanzkriterien:
- `npx next lint` zeigt 0 Errors und < 5 Warnings (nur <img> Warnings bleiben)
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
```

---

## S11: `withSupabase()` Wrapper extrahieren

**Ziel:** Das ~80× wiederholte `createClientIfConfigured()` Guard-Pattern durch einen Wrapper ersetzen.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: DRY-Refactoring für das createClientIfConfigured()-Pattern.

Analyse:
In ~30 Dateien gibt es dieses wiederkehrende Pattern:
```typescript
const sb = createClientIfConfigured();
if (!sb) return fallback;
const { data, error } = await sb.from("table").select(...);
if (error) { log.warn(...); return fallback; }
return data;
```

Schritt 1 — Wrapper erstellen:
Erstelle src/lib/supabase/with-supabase.ts mit:

```typescript
export async function withSupabase<T>(
  fn: (client: SupabaseClient) => Promise<{ data: T | null; error: PostgrestError | null }>,
  options: {
    fallback: T;
    context: string;  // für Logging, z.B. "[active-list]"
  }
): Promise<T> {
  const sb = createClientIfConfigured();
  if (!sb) return options.fallback;
  try {
    const { data, error } = await fn(sb);
    if (error) {
      log.warn(`${options.context} Supabase error:`, error.message);
      return options.fallback;
    }
    return data ?? options.fallback;
  } catch (e) {
    log.warn(`${options.context} unexpected error:`, e);
    return options.fallback;
  }
}
```

Schritt 2 — In 3 Dateien anwenden (Pilot):
- src/lib/list/typical-products.ts (3 Stellen)
- src/lib/list/last-trip.ts (2 Stellen)
- src/lib/list/recent-list-products.ts (2 Stellen)

Schritt 3 — Tests:
Erstelle src/lib/supabase/__tests__/with-supabase.test.ts:
- Test: Gibt fallback zurück wenn kein Client
- Test: Gibt data zurück bei Erfolg
- Test: Gibt fallback zurück bei Supabase-Error und loggt Warning
- Test: Gibt fallback zurück bei Exception und loggt Warning

Regeln:
- Nicht alle 80 Stellen auf einmal migrieren — nur die 3 Pilot-Dateien
- Der Wrapper soll flexibel genug sein für verschiedene Return-Types
- Bestehende Funktions-Signaturen der migrierten Dateien ändern sich NICHT

Akzeptanzkriterien:
- with-supabase.ts existiert mit < 40 Zeilen
- 3 Pilot-Dateien nutzen den Wrapper
- Mindestens 4 Tests, alle grün
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
- Dokumentation: Kommentar in with-supabase.ts mit Beispiel-Usage

Nicht anfassen: Dateien die nicht in der Pilot-Liste sind.
```

---

## S12: `product-search.tsx` weiter aufbrechen

**Ziel:** Die Such-Logik extrahieren, `product-search.tsx` von 526 auf <300 Zeilen bringen.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Extrahiere die Such-Logik aus src/components/search/product-search.tsx (526 Zeilen).

Lies die Datei zuerst komplett.

Ziel-Struktur:
1. src/components/search/hooks/use-search-execution.ts
   — runSearch, fetchRecentPurchases, fetchSpecials, runRetailerSearch
   — Debounce-Logik, AbortController-Handling
   — State: results, recentPurchases, specials, retailerProducts, isSearching
   — Ziel: < 200 Zeilen

2. src/components/search/hooks/use-barcode-scanner.ts (nur wenn Barcode-Logik > 30 Zeilen)
   — Barcode-Scan-Flow: Camera-API, Ergebnis-Handling
   — Ziel: < 100 Zeilen

3. src/components/search/product-search.tsx
   — Orchestriert useSearchExecution + useAddToList + UI-Rendering
   — Ziel: < 300 Zeilen

Regeln:
- Alle bestehenden Props und Exports bleiben kompatibel
- Die Such-Panel-Tabs (RecentPurchases, Specials, Retailer) bleiben eigene Komponenten
- Keine Funktionalitäts-Änderungen

Akzeptanzkriterien:
- product-search.tsx < 300 Zeilen
- Kein neuer Hook > 200 Zeilen
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
- Alle bestehenden Tests in use-add-to-list.test.ts bleiben grün
```

---

## S13: `list-item-row.tsx` aufbrechen

**Ziel:** Die 505-Zeilen-Komponente in fokussierte Sub-Components dekomponieren.

**Modell:** Starkes Modell

### Prompt:

```
Aufgabe: Dekomponiere src/components/list/list-item-row.tsx (505 Zeilen) in kleinere Komponenten.

Lies die Datei zuerst komplett und identifiziere die logischen Blöcke.

Erwartete Struktur:
1. src/components/list/hooks/use-swipe-actions.ts
   — Touch/Swipe-Handling: onTouchStart, onTouchMove, onTouchEnd, Animation
   — Ziel: < 120 Zeilen

2. src/components/list/item-badges.tsx
   — Badge-Rendering: Deferred-Badge, Elsewhere-Badge, Quantity-Badge, 
     Aktionsartikel-Badge
   — Ziel: < 80 Zeilen

3. src/components/list/item-actions.tsx
   — Action-Buttons nach Swipe: Delete, Defer, Edit
   — Ziel: < 80 Zeilen

4. src/components/list/list-item-row.tsx
   — Orchestriert Swipe-Hook, Badges, Actions
   — Ziel: < 250 Zeilen

Regeln:
- memo() bleibt erhalten auf list-item-row
- Alle Props-Interfaces bleiben kompatibel
- Performance: Keine unnötigen Re-Renders durch die Dekomposition
- Die <img>-Tags NICHT zu <Image /> ändern (das ist S17)

Akzeptanzkriterien:
- list-item-row.tsx < 250 Zeilen
- Kein neuer Hook/Component > 150 Zeilen
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
- Manueller Test: Item swipen, Badges prüfen, Actions testen
```

---

## S14: `competitor-product-form-modal.tsx` aufbrechen

**Ziel:** Form-State-Logik in einen Hook extrahieren.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Extrahiere Form-State aus src/components/list/competitor-product-form-modal.tsx 
(494 Zeilen).

Lies die Datei zuerst komplett.

Ziel-Struktur:
1. src/components/list/hooks/use-competitor-form.ts
   — Form-State (alle useState), Validierung, Submit-Logik, Photo-Upload
   — Ziel: < 200 Zeilen

2. src/components/list/competitor-product-form-modal.tsx
   — Reines UI: Formular-Layout, Input-Fields, Buttons
   — Nutzt useCompetitorForm() für State und Handlers
   — Ziel: < 300 Zeilen

Regeln:
- Props-Interface ändert sich nicht
- Die Photo-Upload-Logik bleibt im Hook (nicht in der UI-Komponente)
- Keine Funktionalitäts-Änderungen

Akzeptanzkriterien:
- competitor-product-form-modal.tsx < 300 Zeilen
- use-competitor-form.ts < 200 Zeilen
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
```

---

## S15: `process-receipt/route.ts` + `active-list.ts` aufbrechen

**Ziel:** Zwei mittelgrosse Dateien unter 300 Zeilen bringen.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Zwei Dateien aufbrechen.

Datei 1: src/app/api/process-receipt/route.ts (498 Zeilen)
Ziel-Struktur:
- src/lib/receipts/parse-receipt.ts — Receipt-Parsing-Logik (AI-Prompt, Response-Parsing)
- src/app/api/process-receipt/route.ts — Route-Handler (Validierung, Auth, Delegation)
- Route-Handler < 150 Zeilen, Parsing-Modul < 300 Zeilen

Datei 2: src/lib/list/active-list.ts (414 Zeilen)
Ziel-Struktur:
- src/lib/list/active-list.ts — Read-Operationen (getActiveList, getListItems, etc.)
- src/lib/list/active-list-write.ts — Write-Operationen (addListItem, updateListItem, 
  removeListItem, createList)
- Beide Dateien < 250 Zeilen

Regeln:
- Alle bestehenden Exports bleiben aus active-list.ts erreichbar (Re-Export wenn nötig)
- Keine Funktionalitäts-Änderungen
- Wenn active-list.ts den withSupabase()-Wrapper aus S11 nutzen kann, gerne anwenden

Akzeptanzkriterien:
- Alle 4 resultierenden Dateien < 300 Zeilen
- `npx tsc --noEmit` fehlerfrei
- `npx vitest run` fehlerfrei
- Bestehende Imports von active-list.ts funktionieren unverändert
```

---

## S16: Tests für Core Business Logic

**Ziel:** Testabdeckung für die kritischsten, noch ungetesteten Module.

**Modell:** Mittleres Modell

### Prompt:

```
Aufgabe: Tests für Core Business Logic schreiben.

Lies die Dateien:
- src/lib/list/active-list.ts (bzw. active-list-write.ts nach S15)
- src/lib/list/archive-trip.ts
- src/lib/competitor-products/competitor-product-service.ts

Erstelle:

1. src/lib/list/__tests__/active-list.test.ts
   - Test: getActiveList gibt null zurück wenn keine Liste existiert
   - Test: getActiveList gibt Liste mit Items zurück
   - Test: addListItem fügt Item hinzu und gibt aktualisierte Liste zurück
   - Test: addListItem erstellt neue Liste wenn keine existiert
   - Test: updateListItem ändert Quantity
   - Test: removeListItem entfernt Item und reverted bei Fehler
   - Test: Optimistic Update funktioniert (lokale DB wird zuerst aktualisiert)

2. src/lib/list/__tests__/archive-trip.test.ts
   - Test: archiveTrip verschiebt alle checked Items in Trip-Tabelle
   - Test: archiveTrip leert die aktive Liste
   - Test: archiveTrip gibt Fehler zurück wenn keine Items checked sind

3. src/lib/competitor-products/__tests__/competitor-product-service.test.ts
   - Test: findCompetitorProduct findet Produkt nach Name und Retailer
   - Test: upsertCompetitorProduct erstellt neues Produkt
   - Test: upsertCompetitorProduct aktualisiert bestehendes Produkt
   - Test: Fehler bei Supabase-Call wird geloggt und fallback zurückgegeben

Regeln:
- Mocke Supabase und Dexie mit vi.mock
- Nutze withSupabase()-Wrapper-Mocks wenn S11 abgeschlossen ist
- Jeder Test: Arrange → Act → Assert
- Keine echte Datenbank nötig

Akzeptanzkriterien:
- Mindestens 15 Testfälle insgesamt
- Alle grün: `npx vitest run src/lib/list src/lib/competitor-products`
- `npx tsc --noEmit` fehlerfrei
```

---

## S17: `<img>` → `<Image />` + ARIA-Accessibility

**Ziel:** Performance und Accessibility verbessern.

**Modell:** Schnelles Modell

### Prompt:

```
Aufgabe: Zwei Verbesserungen.

Teil 1 — <img> → <Image />:
Ersetze alle <img>-Tags durch next/image <Image /> in folgenden Dateien:
- src/app/[locale]/capture/product-photo-section.tsx (2 Stellen)
- src/app/[locale]/capture/receipt-camera-phase.tsx (1)
- src/app/[locale]/capture/receipt-fallback-phase.tsx (1)
- src/app/[locale]/capture/receipt-result-phase.tsx (1)
- src/app/[locale]/capture/review-card.tsx (1)
- src/app/[locale]/flyer/flyer-page-image.tsx (1)
- src/app/[locale]/receipts/[receiptId]/page.tsx (1)
- src/components/list/competitor-product-detail-modal.tsx (2)
- src/components/list/competitor-product-form-modal.tsx (2)
- src/components/list/generic-product-picker.tsx (1)
- src/components/list/list-item-row.tsx (1)
- src/components/list/product-detail-modal.tsx (2)
- src/components/search/recent-purchases-panel.tsx (1)
- src/components/search/specials-panel.tsx (1)

Regeln für Image-Migration:
- Setze width/height oder fill={true} je nach Kontext
- Externe URLs (Supabase Storage) brauchen remotePatterns in next.config.js
- Bei dynamischen URLs: unoptimized={true} als Fallback
- alt-Text muss sinnvoll sein (nicht leer)

Teil 2 — ARIA-Accessibility:
- src/components/search/recent-purchases-panel.tsx: Füge aria-selected={false} 
  zu allen role="option" Elementen hinzu
- src/components/search/specials-panel.tsx: Gleiche Änderung

Akzeptanzkriterien:
- `npx next lint` zeigt 0 `no-img-element` Warnings
- `npx next lint` zeigt 0 `role-has-required-aria-props` Warnings
- `npx tsc --noEmit` fehlerfrei
- `npx next build` fehlerfrei
- Bilder werden korrekt angezeigt (manueller Test)
```

---

## S18: Code-Review V2

**Ziel:** Qualitätssicherung nach der zweiten Runde.

**Modell:** Starkes Modell, **Ask Mode**

### Prompt:

```
Aufgabe: Code-Review nach IMPROVEMENT-PLAN V2.

Prüfe:
1. Dateigrössen: Hat JEDE Datei in src/ < 300 Zeilen? 
   (Ausnahme: src/types/supabase.ts = generiert)
2. Tests: `npx vitest run` — alle grün, 0 Failed Suites?
3. TypeScript: `npx tsc --noEmit` — 0 Fehler?
4. Lint: `npx next lint` — 0 Errors, < 5 Warnings?
5. DRY: Wie viele createClientIfConfigured()-Aufrufe sind noch übrig? 
   Wurden die Pilot-Dateien auf withSupabase() migriert?
6. Test-Coverage: Welche kritischen Pfade sind noch nicht getestet?
   Priorisiere nach Business-Impact.
7. Bundle-Size: Gibt es offensichtliche Bundle-Bloater?
8. Accessibility: Laufe die Komponenten in src/components/ durch — 
   fehlen ARIA-Attribute, Keyboard-Navigation, Focus-Management?

Erstelle eine Zusammenfassung mit:
- ✅ Was jetzt gut ist (Vergleich zu V1)
- ⚠️ Verbleibendes Tech-Debt (als Backlog für V3)
- 📊 Metriken-Vergleich: Dateigrössen, Test-Count, Lint-Warnings vorher/nachher
- 🎯 Top 3 Empfehlungen für den nächsten Monat
```

---

## Parallelisierungs-Matrix

```
Woche 1 (Sofort):
  S9 (Quick Fixes)  ──────────┐
                                ├── parallel
  S10 (Lint-Warnings) ────────┘

Woche 1:
  S11 (withSupabase Wrapper)

Woche 1-2:
  S12 (product-search aufbrechen) ─── nach S11 (kann Wrapper nutzen)

Woche 2:
  S13 (list-item-row aufbrechen)
  S14 (competitor-form aufbrechen) ─── parallel zu S13 (verschiedene Dateien)

Woche 2-3:
  S15 (route + active-list) ─── nach S11 (nutzt Wrapper)

Woche 3:
  S16 (Tests Business Logic) ─── nach S15 (testet aufgebrochene Dateien)

Woche 3:
  S17 (<img> → <Image /> + ARIA)

Woche 3-4:
  S18 (Code-Review V2)
```

---

## Metriken-Tracking

### Baseline (Start V2, 2026-03-04)

| Metrik | Wert |
|--------|------|
| TypeScript-Fehler | 0 |
| Vitest Tests | 97 grün, 2 Failed Suites (Playwright) |
| Lint Errors | 1 (react-hooks in Test) |
| Lint Warnings | ~40 |
| Dateien > 300 Zeilen | 6 (+ 1 generierte) |
| `createClientIfConfigured()` Aufrufe | ~80 in 30+ Dateien |
| `<img>`-Tags | 18 Stellen |
| ARIA-Issues | 2 Stellen |

### Ziel (Ende V2)

| Metrik | Ziel |
|--------|------|
| TypeScript-Fehler | 0 |
| Vitest Tests | 120+ grün, 0 Failed Suites |
| Lint Errors | 0 |
| Lint Warnings | < 5 |
| Dateien > 300 Zeilen | 0 (excl. generierte) |
| `createClientIfConfigured()` Aufrufe | ~70 (Pilot-Migration, Rest in V3) |
| `<img>`-Tags | 0 |
| ARIA-Issues | 0 |
