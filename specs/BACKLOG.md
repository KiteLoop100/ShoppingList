# Code Quality Backlog

Generated: 2026-03-01 · Last full audit completed: 2026-03-01 (Rounds 6–9)

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-62 | medium | architecture | **Kategorie-System auf ALDI-interne Demand-Groups konsolidieren.** Aktuell existieren zwei parallele Systeme: ~20 App-Kategorien (`categories`-Tabelle, EN-Namen) und ~61 ALDI Demand-Groups (`products.demand_group`, DE mit Nummernpräfix). Ziel: Ein einheitliches System basierend auf den ALDI Demand-Groups. | `supabase/migrations/`, `src/lib/db/seed-data.ts`, `src/lib/db/indexed-db.ts`, `src/lib/list/list-helpers.ts`, `src/lib/store/aisle-order.ts`, `src/lib/category/assign-category.ts`, `src/lib/categories/category-colors.ts`, `src/lib/i18n/category-translations.ts`, `src/types/index.ts`, `specs/DATA-MODEL.md` | **Scope:** (1) `categories`-Tabelle durch `demand_groups`-Tabelle ersetzen (~61 Einträge, PK = Code z.B. "83", Name, Übersetzungen, Icon, Sort-Position, optionaler parent_group). (2) `demand_sub_groups` als eigene Tabelle mit FK auf demand_groups. (3) `products.category_id` FK migrieren auf `demand_group_code` – betrifft: products, list_items, trip_items, aisle_orders, aggregated_aisle_orders, competitor_products. (4) `category_aliases` auf Demand-Groups mappen statt App-Kategorien. (5) AI-Kategorie-Zuweisung (F09): Claude-Prompt muss ~61 Demand-Groups kennen, `/api/assign-category` gibt demand_group_code zurück. (6) `aisle_orders` und `aggregated_aisle_orders` auf demand_group-Ebene umstellen; bestehende Lerndaten migrieren oder verwerfen. (7) `SEED_CATEGORIES` in seed-data.ts durch `SEED_DEMAND_GROUPS` ersetzen. (8) IndexedDB: Dexie-Tabelle `categories` durch `demand_groups` ersetzen, Schema-Version erhöhen. (9) `sortAndGroupItems()` und `sortAndGroupItemsHierarchical()` zu einer Funktion zusammenführen, da beide auf derselben Kategorie-Ebene arbeiten. (10) `CATEGORY_COLORS`-Fallback-Map in category-colors.ts entfernen (nur noch `DEMAND_GROUP_COLORS`). |

## Responsive Desktop & Tablet (F28)

| ID | Phase | Effort | Description | Affected files |
|----|-------|--------|-------------|----------------|
| RESP-001 | 1 (CSS) | S | Max-width scaling for main pages | `page.tsx`, `flyer-overview-client.tsx`, `receipts-client.tsx`, `settings-client.tsx` |
| RESP-002 | 1 (CSS) | S | Page padding scaling (px-4 → md:px-6 → lg:px-8) | Same as RESP-001 |
| RESP-003 | 1 (CSS) | S | Header nav icons get text labels on md:+ | `page.tsx` |
| RESP-004 | 1 (CSS) | S | Onboarding max-width scaling | `onboarding/screens/*.tsx` |
| RESP-005 | 1 (CSS) | S | Flyer overview grid layout (md:2-col, lg:3-col) | `flyer-overview-client.tsx` |
| RESP-006 | 1 (CSS) | S | Consistent modal centering on sm:+ | All modals (6 files) |
| RESP-007 | 1 (CSS) | S | List item spacing scaling | `list-item-row.tsx` |
| RESP-010 | 2 (Gestures) | S | `usePointerType()` hook | `src/hooks/use-pointer-type.ts` (new) |
| RESP-011 | 2 (Gestures) | S | Tailwind `pointer-fine:` variant | `tailwind.config.ts` |
| RESP-012 | 2 (Gestures) | L | ListItemRow hover actions (delete, defer, elsewhere) | `list-item-row.tsx` |
| RESP-013 | 2 (Gestures) | M | ListItemRow right-click rename for generic items | `list-item-row.tsx` |
| RESP-014 | 2 (Gestures) | M | FlyerPageImage mouse wheel zoom + drag pan | `flyer-page-image.tsx` |
| RESP-015 | 2 (Gestures) | M | Keyboard shortcuts for focused list items | `list-item-row.tsx`, `shopping-list-content.tsx` |
| RESP-020 | 3 (Layout) | L | Shared layout shell with top navigation on lg: | `app-shell.tsx` (new), `layout.tsx`, all pages |
| RESP-021 | 3 (Layout) | S | Main screen: unified layout (search above list) on all breakpoints, no split-view | `page.tsx` |
| RESP-022 | 3 (Layout) | L | Flyer detail split-view | `flyer/[flyerId]/page.tsx` |
| RESP-023 | 3 (Layout) | L | Receipts master-detail | `receipts-client.tsx`, `receipts/[receiptId]/page.tsx` |
| RESP-024 | 3 (Layout) | S | `useBreakpoint()` hook | `src/hooks/use-breakpoint.ts` (new) |
| RESP-030 | 4 (Polish) | M | Keyboard navigation + focus styles | Diverse components, `globals.css` |
| RESP-031 | 4 (Polish) | S | Consistent hover states | Diverse components |
| RESP-032 | 4 (Polish) | M | Tooltip component | `tooltip.tsx` (new), `list-item-row.tsx`, header |
| RESP-033 | 4 (Polish) | S | Desktop-specific empty states | `shopping-list-content.tsx`, `receipts-client.tsx` |
| RESP-034 | 4 (Polish) | S | Code-splitting for desktop panels | `page.tsx`, split-view components |

## Completed Backlog

| ID | Category | Resolution |
|----|----------|------------|
| BL-60 | data | Flyer-Daten sind aktuell, Handzettel nach ALDI-Import neu eingelesen. |
| BL-61 | tech-debt | ZXing durch ZBar WASM ersetzt. `barcode-from-image.ts` nutzt ZBar WASM, `@zxing/library` aus `package.json` entfernt. |

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
