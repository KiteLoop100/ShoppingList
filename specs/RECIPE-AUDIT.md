# RECIPE-AUDIT — Rezept, Kochen, Zutaten, Vorrat (Stand: 2025-03-22)

Übersicht aller im Repo gefundenen Stellen unter `specs/` und `src/`, die **Rezepte**, **Kochen**, **Ingredients/Zutaten**, **„Was kann ich kochen“**, **Pantry** oder **Vorräte** betreffen — plus relevante **Supabase-Migrations**.

**Hinweis zur Suche:** Begriffe wie `ingredients` tauchen sehr oft als **Produktzutatenliste** (Etikett) auf, nicht als Rezeptzutaten. **Haushaltsvorrat** ist als **F42 Inventory** implementiert und ist konzeptionell nah an „Vorratskammer“, aber **kein** Rezept-/Koch-Feature.

---

## 1. Bestehende Dokumentation (`specs/`)

| Dateipfad | Aspekt | Detailgrad | Feature-ID / Verweis |
|-----------|--------|------------|------------------------|
| `specs/FEATURES-PLANNED.md` | **F20 Recipe Import (URL → Einkaufsliste)** — Flow mit AI-Extraktion, Portionen, „Nur ALDI-Zutaten“, Kosten | Ausformulierte geplante Spec (Abschnitt + Tabelle) | **F20** |
| `specs/FEATURES-PLANNED.md` | **F02-SS Semantic Search** — AI interpretiert Absicht; könnte später kulinarische Fragen abdecken („Was kann ich kochen“-artig nur indirekt / nicht spezifiziert) | Ausformulierte geplante Spec | **F02-SS** |
| `specs/FEATURES-CORE.md` | Such-Eingabe-Routing: URL-Muster → Recipe Import (F20); Semantic Query → F02-SS | Tabelle + Kurzbeschreibung | Verweis **F20**, **F02-SS** |
| `specs/UI.md` | **Recipe URL Mode** — Mockup (chefkoch.de-URL, „Rezept wird geladen…“, Modal mit Portionen/ALDI/Toggle) | Ausformulierte UI-Spec | **F20** (Verweis auf FEATURES-CORE) |
| `specs/README.md` | Verweis: geplante Features inkl. „recipe“ | Stichwort / Navigation | — |
| `specs/PRODUCT.md` | Externe Integration: Recipe import | Stichwort | — |
| `specs/archive/MVP.md` | Recipe import als Phase-5 Nice-to-have | Stichwort | — |
| `specs/FEATURES-CAPTURE.md` | **Produktzutaten** aus Fotos (`product_back`, `data_extraction`: Barcode, Nährwerte, **ingredients**) | Ausformulierte Spec (Foto-Pipeline, keine Rezepte) | Foto-Pipeline / F13-Kontext |
| `specs/PHOTO-PIPELINE.md` | Data-Photos: „Zutatenlisten, Nährwerte“ (Etikett) | Ausformuliert | Capture, nicht Kochrezept |
| `specs/DATA-MODEL.md` | Feld `ingredients` (Produkttext); **Pantry** als Farbe/Kategorie-Familie (Demand-Group-Visualisierung); `is_vegan` („no animal ingredients“) | Tabellen + Stichworte | Kern-Datenmodell |
| `specs/DATA-MODEL-EXTENDED.md` | `ingredients` — volle Zutatenliste (Text) | Kurz | Erweiterte Felder |
| `specs/CHANGELOG.md` | Historische Einträge: `ingredients` auf Produkten/Wettbewerbern, Extraktion, UI-Karten | Changelog-Einträge | — |
| `specs/FEATURES-ELSEWHERE.md` | Extraktion von **ingredients** u. a. aus Fotos (Claude) | Ausformuliert | Wettbewerber-/Foto-Kontext |
| `specs/FEATURES-INVENTORY.md` | **Haushaltsvorrat / Tab „Vorrat“** — digitales Inventar, kein Rezeptkochen | Ausformulierte Spec | **F42** |
| `specs/PLAN-INVENTORY-MHD-FREEZER-UI.md` | **Vorrat**-UI, MHD, Gefrierfach, Suche im Vorrat | Ausformulierte Planungs-Spec | F42 / Inventar |
| `specs/UI.md` | **Pantry** als Farbfamilie (Category colour bar) | UI-Detail | Sortierung / Demand Groups |
| `specs/FEATURES-FEEDBACK.md` | „Rezeptur geändert?“ (Feedback-Karte) | Beispiel-Text | Kundenfeedback, nicht Kochrezept |
| `specs/FEATURES-ALDI-KUNDEN-UNTERSTUETZUNG.md` | **Rezepturänderung** beim Produkt (Marketing/Support) | Ausformuliert | ALDI-Kunden-Support |
| `specs/ALDI-DATA-REQUEST.md` | **Ingredients list** als gewünschtes Lieferantenfeld; typische Haltbarkeit → u. a. „meal planning features“ (Ausblick) | Tabelle | Datenanfrage |
| `specs/PRODUKTDATEN-ANFORDERUNGEN.md` | **Zutatenliste** für Detail-Ansicht | Tabelle | Produktdaten |

### Fehlende / referenzierte Spec-Datei

| Referenz | Befund |
|----------|--------|
| `specs/F-RECIPE-SUGGESTIONS-SPEC.md` | In **`CLAUDE.md`** genannt — **existiert im Repository nicht** (kein Treffer per Dateisuche). Keine dedizierte „Recipe Suggestions“-Spec-Datei vorhanden. |

### Keine Treffer (explizit gesucht)

- **`specs/BACKLOG.md`:** keine Zeilen zu recipe / Vorrat / Zutaten / Kochen (Stand Audit).
- **`specs/ARCHITECTURE.md`**, **`specs/SEARCH-ARCHITECTURE.md`:** keine Treffer zu Rezept/Kochen/Pantry/Vorrat.

---

## 2. Bestehender Code (`src/`)

### 2a. Rezept-Import (F20) & „Was kann ich kochen“

| Dateipfad | Was ist implementiert? | Status |
|-----------|-------------------------|--------|
| — | **Recipe URL Import** (`/api/extract-recipe`, `/api/match-recipe-ingredients`), UI aus `UI.md` | **Nicht implementiert** — keine API-Routen, keine `recipe`-Treffer unter `src/` |
| — | **„Was kann ich kochen“** / Rezeptvorschläge aus Vorrat | **Nicht implementiert** — keine Such- oder UI-Treffer |

**Abgleich Spec vs. Code:** `FEATURES-CORE.md` beschreibt URL-Eingaben → F20; im **Such-Code** wurden keine Handler für `http(s)://` oder Rezept-Import gefunden (F20 derzeit **nur dokumentiert**).

---

### 2b. Haushaltsvorrat („Vorrat“, kein Koch-Rezept)

| Dateipfad | Was ist implementiert? | Status |
|-----------|-------------------------|--------|
| `src/lib/inventory/inventory-service.ts` | CRUD, Receipt-Merge, MHD, Freeze — Kernlogik | **Funktioniert** (mit Tests) |
| `src/lib/inventory/inventory-types.ts`, `inventory-search.ts`, `inventory-receipt.ts`, `inventory-freeze.ts`, `expiry-color.ts` | Hilfslogik Vorrat | **Funktioniert** |
| `src/components/inventory/*.tsx` | Liste, Zeilen, Suche, Aktionen, Filter, Modals | **Funktioniert** |
| `src/app/[locale]/receipts/inventory-action/*` | Seiten für Vorrat hinzufügen / Aktionen | **Funktioniert** |
| `src/messages/de.json` (Keys unter Inventar) | UI-Strings „Vorrat“, „Vorrätig“, … | **Funktioniert** |

---

### 2c. Produktfeld `ingredients` (Etikett / Nährwerte — kein Rezept)

| Dateipfad | Was ist implementiert? | Status |
|-----------|-------------------------|--------|
| `src/types/index.ts`, `src/types/supabase.ts` | Typen inkl. `ingredients` | **Funktioniert** |
| `src/components/product-detail/nutrition-section.tsx`, `product-detail-view.tsx` | Anzeige Zutaten/Allergene | **Funktioniert** |
| `src/lib/products/upsert-product.ts`, `open-food-facts.ts` | Speichern / OFF-Import `ingredients_text` | **Funktioniert** |
| `src/lib/competitor-products/competitor-product-service.ts` | Wettbewerber-Produkte inkl. `ingredients` | **Funktioniert** |
| `src/app/api/products/create-manual/route.ts`, `src/app/api/confirm-photo/route.ts` | API setzt `ingredients` | **Funktioniert** |
| `src/lib/api/photo-processing/process-data-extraction.ts` | Extraktion Zutaten vom Etikett (BL-31) | **Funktioniert** |
| `src/lib/api/photo-processing/prompts.ts`, `src/lib/product-photo-studio/*` | JSON-Schema / Parsing `ingredients` | **Funktioniert** |
| `src/app/[locale]/capture/use-product-creation.ts`, `product-fields-section.tsx` | Formularfelder Zutaten | **Funktioniert** |
| `src/components/product-capture/extracted-info-cards.tsx`, `product-capture-save.ts` | Anzeige/Speichern extrahierter Zutaten | **Funktioniert** |
| `src/lib/api/schemas.ts` | Zod: `ingredients` optional | **Funktioniert** |
| `src/lib/process-receipt` (in grep: `src/lib/api/photo-processing/process-receipt.ts`) | Receipt-Flow kann `ingredients` setzen | **Funktioniert** |
| `src/messages/de.json`, `en.json` | „Zutaten“, `exclusionsHint` (Inhaltsstoffe) | **Funktioniert** |

**Tests:** Zahlreiche `__tests__`-Dateien mit `ingredients: null` oder Fixture-Strings — **Regressionstests für Datenmapping**, keine Rezept-Logik.

---

### 2d. „Pantry“ als Kategorie / Suche (Wortwahl, keine Vorratskammer-App)

| Dateipfad | Was ist implementiert? | Status |
|-----------|-------------------------|--------|
| `src/lib/categories/category-colors.ts` | Farbfamilie **Pantry / dry goods** für Demand-Groups | **Funktioniert** |
| `src/lib/search/product-aliases.ts`, `synonym-map.ts` | Alias-Bereiche „Pantry / dry goods“ | **Funktioniert** |
| `src/lib/db/seed-data.ts` | Kommentar „Pantry / dry goods“ | Seed / Kommentar |
| `src/lib/list/__tests__/recent-purchase-categories.test.ts` | Test erwähnt „pantry“-artige Codes | **Test** |

---

### 2e. Nur indirekt / Sprache (kein Feature)

| Dateipfad | Was ist implementiert? | Status |
|-----------|-------------------------|--------|
| `src/lib/products/demand-group-fallback.ts` | Regex u. a. `wasserkocher`, Küchengeräte → Demand Group | **Funktioniert** (Wort „koch…“ in Gerätenamen) |
| `src/lib/search/product-aliases.ts` | Alias `kochschinken` | **Funktioniert** |
| `src/lib/search/__tests__/search-pipeline.test.ts` | Produktname „festkochend“ (Kartoffeln) | **Test-Fixture** |

---

## 3. Supabase-Tabellen & Spalten (`supabase/migrations/`)

### Tabellen mit Namen wie `recipe*` oder dediziertes Koch-Feature

| Befund |
|--------|
| **Keine** Tabelle `recipe`, `recipes`, `recipe_*` o. ä. in den geprüften `CREATE TABLE`-Migrationen. |

### Tabellen / Spalten mit Bezug zu „Vorrat“ / `re…` (z. B. Receipts)

| Migration / Objekt | Inhalt |
|---------------------|--------|
| `20260223000000_receipts.sql` | `receipts`, `receipt_items` — **Kassenzettel**, nicht Food-Recipe |
| `20260314200000_receipt_scans.sql` | `receipt_scans` |
| `20260311200000_inventory_items.sql` | **`inventory_items`** — Haushaltsvorrat (**F42**) |
| `20260312200000_inventory_mhd_frozen.sql`, `20260313100000_product_shelf_life.sql` | MHD/Gefrierfach-Bezug für **inventory** |

### Spalte `ingredients` (Produkt / Wettbewerber)

| Migration | Inhalt |
|-----------|--------|
| `20250221000000_photo_uploads_f13.sql` | `ALTER TABLE products ADD COLUMN … ingredients TEXT` |
| `20260305000000_competitor_product_details.sql` | `competitor_products.ingredients TEXT` |

### „Pantry“ als Kategorie-Name (SQL)

| Migration | Inhalt |
|-----------|--------|
| `20260303120000_demand_groups_schema.sql` | Kommentar „Pantry / dry goods“ |
| `20260303130000_bl62_demand_group_code_on_items.sql` | `categories.name = 'Pantry'` für Demand-Group-Mapping |

---

## 4. Kurzfassung

| Thema | Dokumentation | Code / DB |
|-------|----------------|-----------|
| **Rezept per URL (F20)** | Ausführlich in FEATURES-PLANNED, FEATURES-CORE, UI.md | **Nicht umgesetzt** |
| **„Was kann ich kochen“ / Rezeptvorschläge** | Keine eigene Spec-Datei; F-RECIPE-SUGGESTIONS-SPEC in CLAUDE.md **fehlt** | **Nicht umgesetzt** |
| **Produktzutaten (Etikett)** | DATA-MODEL, Capture, CHANGELOG | **Umgesetzt** (`ingredients`-Spalten, UI, Extraktion) |
| **Vorrat / Vorratskammer** | F42, PLAN-INVENTORY, de.json | **Umgesetzt** (`inventory_items`, `src/lib/inventory`, UI) |
| **Pantry (Kategorie/Farbe)** | UI.md, DATA-MODEL | **Umgesetzt** (Farben, Aliases, SQL-Kategorie) |

---

**Feedback (Developer):**

- **Prompt:** Die Anfrage war klar; der letzte Punkt zur Supabase-Prüfung endete im Original bei „…Tabellen mit ‚re‘“ — hier wurden **`recipe*`**, **`receipt*`**, **`inventory*`** und **`ingredients`** abgedeckt.
- **Architektur:** Rezept-Features sind ** dokumentiert, aber nicht im Code verdrahtet**; Risiko von Spec-Drift bei F20 — bei Implementierung Search-Routing und API explizit anbinden.
- **Prozess:** Keine Tests für Rezept-Import (noch kein Code). Bestehende Tests zu `ingredients` betreffen **Produktdaten**, nicht Rezepte.

---

## Konsolidierung (erledigt)

- `specs/F-RECIPE-FEATURES-SPEC.md` angelegt als zentrale Rezept-Spec
- Querverweise in FEATURES-PLANNED.md und FEATURES-CORE.md aktualisiert
- Ersetzt die fehlende F-RECIPE-SUGGESTIONS-SPEC.md (war in CLAUDE.md referenziert, Referenz bereits entfernt)
- F20 (Recipe Import) bleibt als Feature-ID bestehen; die Spec erweitert den Scope um "Was kann ich kochen?" (F-RECIPE-COOK)
