# Code Quality Backlog

Generated: 2026-03-01 · Last updated: 2026-03-07

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-62 | low | architecture | **Kategorie-System auf ALDI-interne Demand-Groups konsolidieren – Phase 4 Cleanup.** Phasen 1–3 abgeschlossen (DB, Backend, Frontend). Verbleibend: (1) `categories` Supabase-Tabelle droppen. (2) `category_aliases.category_id` Spalte zu `demand_group_code` umbenennen. (3) Alle `category_id` DB-Spalten aus `products`, `list_items`, `trip_items` droppen. (4) `products.demand_group` Text-Spalte entfernen (ersetzt durch `demand_group_code` FK). | `supabase/migrations/` | Rein DB-seitig. Kein Frontend-Code mehr betroffen. |
| BL-63 | medium | data-quality | **Vollständige Überprüfung aller Produktkategorie- und Unterkategorie-Darstellungen.** Hintergrund und bekannte Verdachtspunkte: (1) **Dateninkonsistenz demand_sub_group**: Das DB-Feld `products.demand_sub_group` enthält bei älteren Produkten Legacy-Strings wie `"02-Milch"` (ALDI-Format), bei neuen Produkten soll es strukturierte Codes wie `"56-06"` enthalten (FK-Format aus `demand_sub_groups.code`). Die Detail- und Bearbeiten-Ansicht hat einen Fallback für Legacy-Strings, aber es ist unklar, wie viele Produkte noch Legacy-Werte haben. Alle Produkte sollten einheitlich `demand_sub_groups.code`-Codes verwenden. (2) **demand_sub_groups Vollständigkeit**: Es ist unklar, ob alle 61 Demand-Groups Unterkategorien in der `demand_sub_groups`-Tabelle definiert haben. Demand-Groups ohne Sub-Groups zeigen kein Unterkategorie-Feld im Bearbeiten-Formular. Prüfen: `SELECT demand_group_code, count(*) FROM demand_sub_groups GROUP BY demand_group_code ORDER BY demand_group_code`. (3) **DEMAND_GROUP_ALIASES_DE Aktualität**: Die hardcodierte Map in `category-translations.ts` (6 Einträge: 70, 50, 82, 80, 62, AK) überschreibt DB-Namen. Prüfen ob die DB-Namen inzwischen korrekt sind und ob diese Overrides noch nötig sind. (4) **pairwise_comparisons Scope-Format**: Die Tabelle `pairwise_comparisons` speichert `demand_group` und `demand_sub_group` als Freitext-Scope-Bezeichner. Wenn `demand_sub_group`-Werte migriert werden (Legacy → Code), brechen diese Scope-Verknüpfungen. (5) **category_aliases Tabelle**: Noch in der DB vorhanden (aus altem System). Prüfen ob noch aktiv genutzt oder droppen. (6) **product_detail Darstellung demand_group_code**: Wenn ein Produkt `demand_group_code = ""` hat (leerer String, nicht NULL), wird die Kategorie nicht angezeigt. Prüfen wie viele Produkte betroffen. Empfohlene Aktion: DB-Audit mit gezielten SQL-Abfragen, dann Migrations-Plan für Datenbereinigung. | `supabase/migrations/`, `src/lib/categories/category-service.ts`, `src/lib/i18n/category-translations.ts`, `src/components/list/product-detail-modal.tsx`, `src/components/product-capture/product-capture-fields.tsx` | Vor Public Release prüfen |
| BL-65 | low | feature | **Intelligenter Filter Katalog — Phase 2.** Aktuell implementiert: Präferenz-Ausschlüsse (Glutenfrei, Laktosefrei, Vegan, Bio, Tierwohl) + Bottom-15%-Popularity-Cutoff. Geplante Erweiterungen: (1) Zeitraum-Filter (nur Angebote dieser Woche). (2) Nährwert-Filter (Kalorien, Zucker). (3) Marken-Favoriten-Filter. (4) "Nur mit Bild" Toggle. (5) Persistierung des Filter-Status in localStorage. | `src/lib/catalog/smart-filter.ts`, `src/components/catalog/catalog-client.tsx` | Additive Erweiterung — kein Breaking Change. |
| BL-66 | low | tech-debt | **Reverse Geocoding Rate-Limiting.** `reverseGeocode()` in `store-service.ts` nutzt die kostenlose OpenStreetMap Nominatim API (max 1 req/s). Für Produktionsbetrieb Caching oder einen bezahlten Geocoding-Dienst einsetzen. | `src/lib/store/store-service.ts` | Relevant bei hoher Nutzerzahl |

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
| BL-62 P1–P3 | architecture | Demand-Groups Phase 1–3 abgeschlossen. DB-Schema, Backend und Frontend vollständig auf `demand_group_code` migriert. Deprecated Code entfernt: `SEED_CATEGORIES`, `assignCategory()`, `getCategoryOrderForList()`, `sortAndGroupItemsHierarchical()`, `fetchCategoriesFromSupabase()`, `getCachedCategories()`, `loadCategories()`, `buildCategoryListPrompt()`, `translateCategoryName()`. IndexedDB `categories` Tabelle entfernt (Dexie v11). `category_id` aus allen TS-Interfaces entfernt. |
| BL-64 | architecture | **Einheitliches Produkterfassungs-Modul.** Drei separate Produkterfassungs-Flows (`EditProductModal`, `CompetitorProductFormModal`, `GenericProductPicker` ohne Create-Button) zu einem einzigen `ProductCaptureModal` konsolidiert. Foto-APIs vereinheitlicht zu `/api/analyze-product-photos`. DB-Felder `demand_group_code`, `demand_sub_group`, `assortment_type` auf `competitor_products` ergänzt. 7 Dateien gelöscht, 1 neue Komponente mit 6 Dateien. |

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
