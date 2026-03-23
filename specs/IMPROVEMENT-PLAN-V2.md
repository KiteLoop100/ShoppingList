# Improvement Plan V2 — Post-Refactoring Stabilisierung & Vertiefung

Erstellt: 2026-03-04 · V1 (8 Sessions) ist abgeschlossen → siehe `archive/IMPROVEMENT-PLAN.md`.

---

## Open Items from V1

| Item | Status |
|------|--------|
| `product-search.tsx` noch 526 Zeilen (Ziel <400) | Offen → S12 |
| Supabase typed client nicht global aktiviert (229+ Type-Errors) | Offen — grosses Projekt |
| `createClientIfConfigured()` ~80× in 30+ Dateien | Offen → S11 |

---

## V2 Sessions (10 Sessions)

| Session | Aufgabe | Status | Hebel |
|---------|---------|--------|-------|
| S9 | Quick Fixes: Vitest-Config + ESLint-Error | ✅ | CI-Blocker |
| S10 | Lint-Warnings bereinigen | ✅ | Codequalität |
| S11 | `withSupabase()` Wrapper (DRY für ~80 Guards) | Offen | DRY |
| S12 | `product-search.tsx` aufbrechen (526→<300) | Offen | Dateigrösse |
| S13 | `list-item-row.tsx` aufbrechen (505→<300) | Offen | Dateigrösse |
| S14 | ~~`competitor-product-form-modal.tsx`~~ | ✅ Superseded by BL-64 | — |
| S15 | `process-receipt/route.ts` + `active-list.ts` aufbrechen | Offen | Dateigrösse + Testbarkeit |
| S16 | Tests: Core Business Logic | Offen | Test-Coverage |
| S17 | `<img>` → `<Image />` + ARIA | Offen | Performance + A11y |
| S18 | Code-Review V2 | Offen | Qualitätssicherung |

**S9 + S10 können parallel laufen. S12 + S13 können parallel laufen.**

---

## Session Details

### S11: `withSupabase()` Wrapper

Extract `createClientIfConfigured()` guard pattern into a reusable wrapper. Pilot-Migration in 3 Dateien (`typical-products.ts`, `last-trip.ts`, `recent-list-products.ts`). Ziel: `src/lib/supabase/with-supabase.ts` (<40 Zeilen).

### S12: `product-search.tsx` aufbrechen

Extract search execution into `use-search-execution.ts` (<200 Zeilen). Result: `product-search.tsx` <300 Zeilen.

### S13: `list-item-row.tsx` aufbrechen

Extract `use-swipe-actions.ts`, `item-badges.tsx`, `item-actions.tsx`. Result: `list-item-row.tsx` <250 Zeilen.

### S15: `process-receipt/route.ts` + `active-list.ts`

Split `process-receipt/route.ts` (498→150+300) into route handler + `parse-receipt.ts`. Split `active-list.ts` (414→250+250) into read + write modules. Re-exports keep existing imports stable.

### S16: Tests Core Business Logic

Tests for `active-list.ts`, `archive-trip.ts`, `competitor-product-service.ts`. Target: 15+ test cases. Mock Supabase + Dexie.

### S17: `<img>` → `<Image />` + ARIA

Replace 18 `<img>` tags with `next/image` across 14 files. Fix 2 ARIA `aria-selected` issues.

### S18: Code-Review V2

Full review: file sizes, tests, lint, DRY, bundle size, accessibility. Produce metrics comparison + V3 backlog.

---

## Dateien > 300 Zeilen (aktuell)

| Datei | Zeilen | Session |
|-------|--------|---------|
| `product-search.tsx` | 526 | S12 |
| `list-item-row.tsx` | 505 | S13 |
| `process-receipt/route.ts` | 498 | S15 |
| `competitor-product-service.ts` | 417 | — |
| `active-list.ts` | 414 | S15 |

---

## Metriken

| Metrik | Baseline (V2 Start) | Ziel (V2 Ende) |
|--------|---------------------|----------------|
| TypeScript-Fehler | 0 | 0 |
| Vitest Tests | 97 grün, 2 Failed Suites | 120+ grün, 0 Failed |
| Lint Errors | 1 | 0 |
| Lint Warnings | ~40 | < 5 |
| Dateien > 300 Zeilen | 6 | 0 (excl. generierte) |
| `createClientIfConfigured()` | ~80 in 30+ Dateien | ~70 (Pilot) |
| `<img>`-Tags | 18 | 0 |
| ARIA-Issues | 2 | 0 |

---

*Last updated: 2026-03-22*
