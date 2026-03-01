# Prompt: Produktpräferenzen, Produkt-Flags & Suchsortierung

## Status: IMPLEMENTIERT (2026-02-25)

## Überblick

Drei zusammenhängende Änderungen:
1. Neue Produkt-Flags auf der `products`-Tabelle (DB-Migration + TypeScript-Typen)
2. Neue Settings-Sektion "Produktpräferenzen" mit Ausschlüssen und Sortier-Präferenzen
3. Score-Boost in `src/lib/search/local-search.ts` basierend auf den Präferenzen

---

## 1. Neue Produkt-Flags (DB-Migration)

**Migration:** `supabase/migrations/20260225000000_product_dietary_flags.sql`

Neue Spalten auf `products`:
- `is_bio` BOOLEAN DEFAULT false
- `is_vegan` BOOLEAN DEFAULT false
- `is_gluten_free` BOOLEAN DEFAULT false
- `is_lactose_free` BOOLEAN DEFAULT false
- `animal_welfare_level` INTEGER DEFAULT NULL (1–4 = Haltungsform)

**TypeScript:** `src/types/index.ts` – Product Interface erweitert

---

## 2. Settings UI

**Datei:** `src/app/[locale]/settings/settings-client.tsx`

### Sektion "Unverträglichkeiten" (Ausschlüsse)
Drei Toggles: Glutenfrei, Laktosefrei, Nussfrei.
Produkte mit diesen Inhaltsstoffen werden aus Suchergebnissen gefiltert.

### Sektion "Produktpräferenzen" (Boost)
- Toggle: Günstigste Produkte bevorzugen
- Toggle: Bio-Produkte bevorzugen
- Toggle: Vegane Produkte bevorzugen
- Toggle: Tierwohlprodukte bevorzugen
- Slider (-2 bis +2): Eigenmarke ↔ Marke

### Persistenz
`localStorage` via `src/lib/settings/product-preferences.ts`

---

## 3. Suchsortierung

**Datei:** `src/lib/search/local-search.ts`

### Allergen-Filter (`shouldExclude`)
- Prüft `is_gluten_free`, `is_lactose_free` Flags + `allergens` Freitext
- Gefilterte Produkte tauchen nicht in Suchergebnissen auf

### Score-Boost (`computeScore`)
- Basiswert: 100
- Günstigste: +50 – Preis (gedeckelt bei 50)
- Bio: +25
- Vegan: +25
- Tierwohl: +level × 8
- Marke/Eigenmarke: ±15 pro Slider-Stufe
- Ergebnisse sortiert nach Score desc, dann alphabetisch

---

## 4. Future Feature: Aktionspreise hervorheben (F22)

Dokumentiert in `specs/FEATURES-CORE.md` unter Future Features.
Benötigt `product_prices`-Tabelle mit Preisverlauf und `is_promotional`-Flag.

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `supabase/migrations/20260225000000_product_dietary_flags.sql` | Neue Spalten |
| `src/types/index.ts` | Product Interface |
| `src/lib/settings/product-preferences.ts` | Neues Utility |
| `src/lib/search/local-search.ts` | Filter + Score-Boost |
| `src/app/[locale]/settings/settings-client.tsx` | UI-Sektionen |
| `src/messages/de.json` | 14 neue Keys |
| `src/messages/en.json` | 14 neue Keys |
| `specs/DATA-MODEL.md` | 5 Spalten dokumentiert |
| `specs/FEATURES-CORE.md` | F12 erweitert, F22 hinzugefügt |
| `specs/CHANGELOG.md` | Changelog-Eintrag |
