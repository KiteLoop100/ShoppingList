# Vorrats-Erweiterungen: MHD, Gefrierfach, UI-Umbau

> **Status:** Alle 3 Phasen abgeschlossen.
> **798 Tests bestehen**, 0 TypeScript-Errors, 0 Lint-Errors.

## Fortschritt

| Phase | Status | Beschreibung |
|-------|--------|-------------|
| Phase 1 | DONE | DB-Migration, Types, Service-Layer, MHD-Farblogik, Receipt-Integration, Bugfixes |
| Phase 2 | DONE | Gefrierfach UI, Gruppierung, Perishable-Filter Fix, Swipe sealed/opened |
| Phase 3 | DONE | UI-Umbau: Fixierte Action-Bar, neue Action-Seite, kontextabh. "+", Suche |

---

## Phase 1 + 2: Erledigte Aufgaben

### Phase 1: Datenmodell + MHD

- DB-Migration: `supabase/migrations/20260312200000_inventory_mhd_frozen.sql` (5 neue Spalten: best_before, purchase_date, is_frozen, frozen_at, thawed_at)
- Types: `src/lib/inventory/inventory-types.ts` -- InventoryItem + InventoryUpsertInput erweitert
- Supabase-Types: `src/types/supabase.ts` -- manuell aktualisiert
- Service-Layer: `src/lib/inventory/inventory-freeze.ts` -- freeze/thaw/seal/updateBestBefore/findInventoryItemByProductId
- Thaw-Shelf-Life: `src/lib/inventory/thaw-shelf-life.ts` -- kategorieabhaengige Haltbarkeit nach Auftauen
- MHD-Farblogik: `src/lib/inventory/expiry-color.ts` -- getExpiryColor() + formatBestBefore()
- Receipt-Integration: `src/lib/inventory/inventory-receipt.ts` -- purchase_date aus receipts-Table durchgereicht
- Upsert: `src/lib/inventory/inventory-service.ts` -- INSERT-Payload erweitert um purchase_date + best_before
- UI: `src/components/inventory/inventory-item-row.tsx` -- MHD-Anzeige + Frozen-Badge
- Bugfixes in `inventory-list.tsx`: toastTimerRef (useState->useRef), handleQuantityChange (Revert), handleDelete (Revert), handleOpen (try/catch), handleUndo (Fehler-Feedback)
- Tests: expiry-color.test.ts (16), thaw-shelf-life.test.ts (10)
- Translations: 12 neue Keys in de.json + en.json

### Phase 2: Gefrierfach-Funktion

- Perishable-Filter: `src/components/inventory/inventory-perishable-filter.ts` -- is_frozen Items ausgenommen
- Gruppierung: `src/lib/list/recent-purchase-categories.ts` -- getCategoryGroup(code, isFrozen) + isNativelyFrozen()
- Actions-Hook: `src/components/inventory/use-inventory-actions.ts` -- extrahiert (9 Handler)
- inventory-list.tsx: Refactored (371 -> 206 Zeilen), freeze/thaw/seal Handler
- inventory-item-row.tsx: onSeal/onFreeze/onThaw Props, Swipe opened->sealed, Kontextmenu
- Tests: inventory-freeze.test.ts (12)

---

## Phase 3: UI-Umbau der Vorratsansicht (DONE)

### 3a. Fixierte Action-Bar oben

In `src/components/inventory/inventory-list.tsx` (aktuell 206 Zeilen):
- Action-Buttons und Filter-Chips in `sticky top-0` Container
- Neue Button-Anordnung (3 Buttons statt 2):
  1. "Produkt hinzufuegen" -- oeffnet neue Seite
  2. "Produkt ausbuchen" -- oeffnet gleiche Seite im Ausbuchen-Modus
  3. "Geoeffnet" -- oeffnet gleiche Seite im Geoeffnet-Modus

### 3b. Neue "Produkt hinzufuegen"-Seite

Neue Route `src/app/[locale]/receipts/inventory-action/page.tsx`:
- URL-Parameter `mode=add|consume|open`
- Layout: Oben Barcode-Scanner-Button, darunter Suchfeld
- "add": sucht in Produktdatenbank (via `useSearchExecution` aus `src/components/search/hooks/use-search-execution.ts`)
- "consume"/"open": sucht im VORRAT (In-Memory-Filter auf `loadInventory()` per display_name)
- Barcode im consume/open-Modus: `findProductByEan()` -> `findInventoryItemByProductId()` (existiert in `inventory-freeze.ts`)
- Competitor Products im add-Modus anzeigen (`retailerProducts` aus `useSearchExecution`)
- Vorlage: `src/components/inventory/inventory-add-modal.tsx` (136 Zeilen)
- Provider erbt automatisch von `src/app/[locale]/layout.tsx`

### 3c. Kontextabhaengiger "+"-Button

In `src/app/[locale]/receipts/receipts-client.tsx`:
- Tab "Kassenzettel": Receipt-Scanner oeffnen (bisherig)
- Tab "Vorrat": navigiert zu `/receipts/inventory-action?mode=add`

### 3d. Swipe opened->sealed -- BEREITS ERLEDIGT in Phase 2

### 3e. Produkt-Suche in der Vorratsansicht

In `src/components/inventory/inventory-list.tsx`:
- Suchfeld im fixierten Header-Bereich (unterhalb der 3 Buttons, oberhalb der Filter-Chips)
- `useMemo` mit `display_name.toLowerCase().includes(query)`

### Tests Phase 3

- Test: Suche filtert Items korrekt nach display_name

---

## Identifizierte Bug-Risiken (Phase 3 relevant)

### Suche-Modus auf Action-Seite (Critical)

- "consume" und "open" muessen den VORRAT durchsuchen, nicht die Produktdatenbank
- Zwei komplett verschiedene Datenquellen und Suchlogiken je nach Modus
- Barcode im consume/open: BarcodeScannerModal liefert Product/CompetitorProduct, nicht InventoryItem. Bruecken-Logik: Barcode -> findProductByEan() -> product_id -> findInventoryItemByProductId() -> consume/open
- Wenn kein Inventory-Item gefunden: Toast "Produkt nicht im Vorrat"

### Competitor Products im add-Modus (Medium)

- inventory-add-modal.tsx ignoriert aktuell Competitor Products (setzt competitor_product_id: null)
- useSearchExecution liefert Competitor Products in `retailerProducts`, nicht in `results`
- Auf der neuen Action-Seite BEIDE anzeigen und competitor_product_id korrekt mappen

### Daten-Refresh (Low)

- InventoryList refetcht bei Mount via useEffect -> fetchItems()
- Da Tab-Wechsel InventoryList neu mountet, ist Refresh automatisch

---

## Wichtige Dateien fuer Phase 3

| Datei | Zeilen | Zweck |
|-------|--------|-------|
| `src/components/inventory/inventory-list.tsx` | 206 | Hauptkomponente, wird um sticky bar + Suche erweitert |
| `src/components/inventory/use-inventory-actions.ts` | 173 | Extrahierter Hook mit allen Action-Handlern |
| `src/components/inventory/inventory-add-modal.tsx` | 136 | Vorlage fuer die neue Action-Seite |
| `src/app/[locale]/receipts/receipts-client.tsx` | 417 | "+"-Button kontextabhaengig machen |
| `src/lib/inventory/inventory-freeze.ts` | ~150 | findInventoryItemByProductId() fuer Barcode-Consume |
| `src/components/search/barcode-scanner-modal.tsx` | ~120 | Props: onProductAdded, onProductConsumed, onCompetitorProductFound |
| `src/components/search/hooks/use-search-execution.ts` | ~230 | Search-Hook fuer Produktsuche |
| `src/lib/inventory/inventory-service.ts` | ~300 | Re-exports aller Service-Funktionen |
