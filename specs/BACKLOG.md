# Code Quality Backlog

Generated: 2026-03-01 · Last full audit completed: 2026-03-01 (Rounds 6–9)

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-60 | medium | data | Handzettel-Daten (flyers, flyer_pages) müssen nach ALDI-Datenimport neu eingelesen werden (PDF-Upload in Admin-Area). Alte Flyer-Produkt-Verknüpfungen sind durch den Clean-Slate-Import verloren gegangen. | `supabase/imports/` | Manueller Task |
| BL-61 | medium | tech-debt | Server-seitige Barcode-Erkennung: ZXing durch ZBar WASM ersetzen. ZXing erkennt Barcodes unzuverlässig. Client-seitig wird bereits ZBar WASM genutzt – Vereinheitlichung auf eine Library reduziert Abhängigkeiten und verbessert die Erkennungsrate. | `src/lib/barcode-from-image.ts`, `package.json` | Dependency `@zxing/library` danach entfernen |
| BL-62 | medium | architecture | **Kategorie-System auf ALDI-interne Demand-Groups konsolidieren.** Aktuell existieren zwei parallele Systeme: ~20 App-Kategorien (`categories`-Tabelle, EN-Namen) und ~61 ALDI Demand-Groups (`products.demand_group`, DE mit Nummernpräfix). Ziel: Ein einheitliches System basierend auf den ALDI Demand-Groups. | `supabase/migrations/`, `src/lib/db/seed-data.ts`, `src/lib/db/indexed-db.ts`, `src/lib/list/list-helpers.ts`, `src/lib/store/aisle-order.ts`, `src/lib/category/assign-category.ts`, `src/lib/categories/category-colors.ts`, `src/lib/i18n/category-translations.ts`, `src/types/index.ts`, `specs/DATA-MODEL.md` | **Scope:** (1) `categories`-Tabelle durch `demand_groups`-Tabelle ersetzen (~61 Einträge, PK = Code z.B. "83", Name, Übersetzungen, Icon, Sort-Position, optionaler parent_group). (2) `demand_sub_groups` als eigene Tabelle mit FK auf demand_groups. (3) `products.category_id` FK migrieren auf `demand_group_code` – betrifft: products, list_items, trip_items, aisle_orders, aggregated_aisle_orders, competitor_products. (4) `category_aliases` auf Demand-Groups mappen statt App-Kategorien. (5) AI-Kategorie-Zuweisung (F09): Claude-Prompt muss ~61 Demand-Groups kennen, `/api/assign-category` gibt demand_group_code zurück. (6) `aisle_orders` und `aggregated_aisle_orders` auf demand_group-Ebene umstellen; bestehende Lerndaten migrieren oder verwerfen. (7) `SEED_CATEGORIES` in seed-data.ts durch `SEED_DEMAND_GROUPS` ersetzen. (8) IndexedDB: Dexie-Tabelle `categories` durch `demand_groups` ersetzen, Schema-Version erhöhen. (9) `sortAndGroupItems()` und `sortAndGroupItemsHierarchical()` zu einer Funktion zusammenführen, da beide auf derselben Kategorie-Ebene arbeiten. (10) `CATEGORY_COLORS`-Fallback-Map in category-colors.ts entfernen (nur noch `DEMAND_GROUP_COLORS`). |

## Completed Backlog

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
