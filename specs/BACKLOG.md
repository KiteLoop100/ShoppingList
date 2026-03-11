# Code Quality Backlog

Generated: 2026-03-01 · Last updated: 2026-03-11 (BL-70 completed, F28 Phase 1+2 audit, BL-74 i18n consolidation)

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-65 | low | feature | **Intelligenter Filter Katalog — Phase 2.** Aktuell implementiert: Präferenz-Ausschlüsse (Glutenfrei, Laktosefrei, Vegan, Bio, Tierwohl) + Bottom-15%-Popularity-Cutoff. Geplante Erweiterungen: (1) Zeitraum-Filter (nur Angebote dieser Woche). (2) Nährwert-Filter (Kalorien, Zucker). (3) Marken-Favoriten-Filter. (4) "Nur mit Bild" Toggle. (5) Persistierung des Filter-Status in localStorage. | `src/lib/catalog/smart-filter.ts`, `src/components/catalog/catalog-client.tsx` | Additive Erweiterung — kein Breaking Change. |
| BL-66 | low | tech-debt | **Reverse Geocoding Rate-Limiting.** `reverseGeocode()` in `store-service.ts` nutzt die kostenlose OpenStreetMap Nominatim API (max 1 req/s). Für Produktionsbetrieb Caching oder einen bezahlten Geocoding-Dienst einsetzen. | `src/lib/store/store-service.ts` | Relevant bei hoher Nutzerzahl |
| BL-68 | low | feature | **ALDI-Kunden-Unterstützung (F30).** Crowdsourced Customer Intelligence: Kunden helfen ALDI über die App, besser zu werden. 10 Bausteine in 4 Phasen: (1) Leeres-Regal-Meldung (OOS-Button im Abhak-Flow), (2) Regalfotos mit automatischem Kontext (Filiale, Gang, Uhrzeit), (3) kontext-getriggerte Micro-Surveys (situative Fragen nach dem Einkauf, Text oder Spracheingabe), (4) Produkt-Tasting-Feedback für Neulistungen, (5) Sortimentswünsche aus Konkurrenzprodukt-Daten, (6) Aktionsware-Tracking (Flyer-Produkt gefunden?), (7) „Wo hast du es gefunden?" für besseres Sortierungslernen, (8) passive Datenerhebung (Suchbegriffe, Zeitpunkte, Planned-vs-Actual), (9) Mystery-Shopping-Light mit Checklisten, (10) Filial-Auslastung & Stoßzeiten. Alles freiwillig, granulares Opt-In, keine Gamification. Preisschilder-Check bewusst ausgeschlossen (ALDI nutzt ESL). | `specs/FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md` | Post-MVP. Abhängig von F17, F25, F06. |
| BL-69 | low | feature | **PWA App Shortcuts.** `shortcuts`-Array in `manifest.json` mit 3-4 Schnellaktionen (Produkt suchen, Kassenzettel scannen, Flyer, Einstellungen). Erscheinen beim Long-Press auf das App-Icon. Funktioniert auf Android Chrome/Edge, nicht auf iOS Safari. | `public/manifest.json` | 30 Min. Aufwand. Kein Backend, keine neuen Routen. |
| BL-71 | low | feature | **Einkaufsnotizen pro Trip.** Freitextfeld auf `shopping_lists`-Tabelle fuer trip-weite Notizen ("Leergut mitbringen", "Parkplatz B3", "Budget: max 80 EUR"). Collapsible Textarea in der Liste. Sync via Supabase Realtime. | `src/components/list/shopping-list-content.tsx`, DB migration | Halber Tag. |
| BL-72 | low | feature | **Retailer Memory (B1).** App merkt sich Haendler-Zuordnung pro Produkt. Wenn Nutzer "Hafermilch" erneut zu Elsewhere hinzufuegt, wird LIDL automatisch vorgeschlagen. Mapping in `localStorage` oder `user_settings`. | `src/components/list/retailer-picker-sheet.tsx`, `src/lib/list/active-list.ts` | 1 Tag. Ref: FEATURES-ELSEWHERE.md B1. |
| BL-67 | medium | feature | **Automatische Laden-Anlage via OpenStreetMap beim Abhaken von Konkurrenzprodukten.** Wenn eine Person mehrere Konkurrenzprodukte innerhalb eines kurzen Zeitfensters abhakt (z. B. ≥3 Items in 5 Minuten), kann man mit hoher Wahrscheinlichkeit annehmen, dass sie sich in einem Laden befindet. Flow: (1) **Trigger-Erkennung**: `in-store-monitor.ts` oder ein neues `competitor-check-monitor.ts` zählt das Abhaken von `buy_elsewhere`-Items. Schwellwert: ≥3 in 5 Minuten → "wahrscheinlich im Laden". (2) **GPS + OSM-Lookup**: Aktuellen Standort via `getCurrentPosition()` ermitteln. Gegen OpenStreetMap Overpass API oder Nominatim abfragen: Gibt es in einem Radius von 100 m einen Supermarkt/Discounter einer bekannten Kette (`KNOWN_RETAILERS`)? Query-Beispiel: `[out:json]; node["shop"~"supermarket|convenience|discount"](around:100,{lat},{lng}); out body;`. (3) **Automatische Anlage**: Wenn OSM-Treffer mit einer bekannten Kette gefunden → Store automatisch im Backend anlegen (`createStore()`), der aktuellen Liste zuweisen (`setListStore()`), keine Nutzerinteraktion nötig. (4) **Fallback-Dialog**: Wenn kein OSM-Treffer oder unbekannte Kette → `CreateStoreDialog` dem Nutzer anzeigen (wie bisher). (5) **Keine doppelten Anlages**: Vor der Anlage prüfen ob bereits ein Store in ≤200 m Radius existiert. Technische Hinweise: Overpass API hat kein Rate-Limit-Problem bei niedriger Nutzerzahl; für hohe Last auf cached Proxy umsteigen (→ BL-66). Die OSM-`name`-Tags enthalten häufig den offiziellen Kettenname (z. B. "ALDI Süd", "Lidl", "Rewe") — Matching gegen `KNOWN_RETAILERS` mit Lowercase-Normalisierung. Datenschutz: GPS-Koordinaten werden nur serverseitig für die Store-Anlage verwendet, nicht gespeichert. | `src/lib/store/in-store-monitor.ts` (neu: competitor-check-monitor.ts), `src/lib/store/store-service.ts`, `src/hooks/use-store-detection.ts`, `src/components/store/create-store-dialog.tsx` | Voraussetzung: BL-66 (Rate-Limiting). OSM Overpass API: https://overpass-api.de/api/interpreter |

|| BL-73 | medium | architecture | **F16 Shared Lists: `display_name`-Snapshot-Problem mitdenken.** `list_items.display_name` ist eine Snapshot-Kopie von `products.name` zum Zeitpunkt des Hinzufügens. In der Einzel-Nutzer-App wurde ein Write-Through-Fix implementiert (2026-03-09): nach einem Produkt-Edit wird `display_name` aller verknüpften aktiven Listeneinträge synchron aktualisiert. Bei geteilten Listen (F16) muss dieses Write-Through-Muster auf mehrere Nutzer ausgeweitet werden: Ändert Nutzer A den Produktnamen, müssen alle `list_items`-Zeilen aller Mitglieder der geteilten Liste aktualisiert werden. Optionen: (a) Supabase-seitiger Trigger (`AFTER UPDATE ON products → UPDATE list_items SET display_name WHERE product_id = NEW.product_id AND custom_name IS NULL`), (b) serverseitige Funktion in der API-Route `/api/products/create-manual`, (c) Realtime-Broadcast an alle Listeninstanzen. Option (a) ist die robusteste Lösung und entkoppelt das Problem vollständig vom Client. | `supabase/migrations/`, `src/app/api/products/create-manual/route.ts`, `src/components/list/shopping-list-content.tsx` | Voraussetzung für konsistente Anzeige in F16. Vor Implementierung von F16 entscheiden. |

## Responsive Desktop & Tablet (F28)

### Open Items

| ID | Phase | Effort | Description | Affected files |
|----|-------|--------|-------------|----------------|
| RESP-014 | 2 (Gestures) | M | FlyerPageImage mouse wheel zoom + drag pan | `flyer-page-image.tsx` |
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

### Completed (F28)

| ID | Resolution |
|----|------------|
| RESP-001 | Max-width scaling implementiert: `max-w-lg md:max-w-2xl lg:max-w-4xl` auf allen 4 Pages. |
| RESP-002 | Padding scaling implementiert: `px-4 md:px-6 lg:px-8` auf allen Pages. |
| RESP-003 | Header nav icons mit Text-Labels auf `lg:` in `[locale]/page.tsx`. |
| RESP-004 | Onboarding `md:max-w-md`/`md:max-w-sm` auf allen Screens. |
| RESP-005 | Flyer-Übersicht Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. |
| RESP-006 | Modal centering: `sm:items-center` oder `left-1/2 top-1/2` auf allen relevanten Modals. `DataConflictDialog` nachgezogen. |
| RESP-007 | List item spacing: `gap-1.5 md:gap-2 lg:gap-3`, `px-2 md:px-3 lg:px-4` in `list-item-row.tsx`. |
| RESP-010 | `usePointerType()` Hook entfällt — Tailwind `pointer-coarse:`/`pointer-fine:` Varianten ersetzen vollständig. |
| RESP-011 | `pointer-fine:` und `pointer-coarse:` Varianten in `tailwind.config.ts` (Zeile 66-69). |
| RESP-012 | `HoverActionButtons` in `item-actions.tsx` mit `pointer-coarse:hidden`. Defer, Elsewhere, Delete auf Hover. |
| RESP-013 | Right-click rename via `onContextMenu` in `item-name.tsx` für generische Items. |
| RESP-015 | Keyboard shortcuts in `list-item-row.tsx`: Delete, d (defer), e (elsewhere), Space (check). Liste-level Arrow-Navigation → RESP-030. |

## Completed Backlog

| ID | Category | Resolution |
|----|----------|------------|
| BL-60 | data | Flyer-Daten sind aktuell, Handzettel nach ALDI-Import neu eingelesen. |
| BL-61 | tech-debt | ZXing durch ZBar WASM ersetzt. `barcode-from-image.ts` nutzt ZBar WASM, `@zxing/library` aus `package.json` entfernt. |
| BL-62 | architecture | **Demand-Groups Migration vollständig abgeschlossen (Phase 1–4).** Phase 1–3: DB-Schema, Backend und Frontend auf `demand_group_code` migriert. Phase 4: `products.category_id`, `products.demand_group`, `competitor_products.category_id` DB-Spalten gedroppt. `category_aliases` IndexedDB-Tabelle gedroppt (Dexie v15). Admin-Panel Aliases-Tab entfernt. PWA-Precache `categories`-Pattern entfernt. Legacy `demand_group`-Text entfernt aus ~20 Code-Dateien (API-Routes, Services, Scripts). Migration: `20260310200000_bl62_phase4_cleanup.sql`. |
| BL-63 | data-quality | **Produktkategorie-Datenbereinigung abgeschlossen.** DB-Audit: 9.965 von 9.968 Produkten hatten Legacy `demand_sub_group`-Strings statt FK-Codes. 4.702 Produkte auf `demand_sub_groups.code`-Format migriert (158 Mappings). 5.266 Produkte (Demand Groups ohne definierte Sub-Groups) auf NULL gesetzt. Pairwise-Scopes von Legacy-Namen auf Codes konvertiert (4.218 Rows). `demand-group-fallback.ts` KEYWORD_MAP auf Codes umgestellt. Pairwise-Extract/Sort-Logic auf code-basierte Scopes migriert. `demand_groups.name` für Code 70 korrigiert (war abgeschnitten). DEMAND_GROUP_ALIASES_DE: 4 Overrides weiterhin nötig (DB-Namen weichen ab). Migration: `20260310100000_bl63_data_cleanup.sql`. |
| BL-64 | architecture | **Einheitliches Produkterfassungs-Modul.** Drei separate Produkterfassungs-Flows (`EditProductModal`, `CompetitorProductFormModal`, `GenericProductPicker` ohne Create-Button) zu einem einzigen `ProductCaptureModal` konsolidiert. Foto-APIs vereinheitlicht zu `/api/analyze-product-photos`. DB-Felder `demand_group_code`, `demand_sub_group`, `assortment_type` auf `competitor_products` ergänzt. 7 Dateien gelöscht, 1 neue Komponente mit 6 Dateien. |
| BL-70 | feature | **Produktfotos in der Einkaufsliste — bereits implementiert.** 52x52 Thumbnails rechts vom Produktnamen in `list-item-row.tsx`. Datenfluss via `assignThumbnails()` (ALDI-Produkte) und `useListDerived` (Konkurrenzprodukte). `next/image` mit `unoptimized`. Spec hatte 40x40 links vorgesehen, aber 52x52 rechts ist in der Praxis besser erkennbar und konsistent mit dem bestehenden Layout. |
| BL-74 | tech-debt | **i18n Namespace-Konsolidierung abgeschlossen.** `competitorDetail`-Namespace komplett aufgelöst, alle 29 Keys in `productDetail` zusammengeführt. 10 identische Keys entfallen (waren doppelt), 19 Keys verschoben. Neuer Key `eanCrossRefAldi` für den abweichenden Cross-Reference-Text. `tComp` aus `product-detail-view.tsx` entfernt, 11 Ternäre vereinfacht. `competitor-product-detail-modal.tsx` auf `productDetail` umgestellt. |

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
