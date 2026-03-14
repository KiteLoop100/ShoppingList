# SCAN-AND-GO.md — Scan & Go (F43)

> **Status:** Implemented (Phase 1–5 abgeschlossen)
> **Feature-ID:** F43
> **Phase:** Complete
> **Default:** Aktiviert (kein Toggle nötig — ergibt sich aus der Nutzung)

---

## Overview

Scan & Go verschmilzt die bestehende Einkaufsliste mit einer Warenkorb-Funktion. Kunden scannen Produkte beim Einlegen in den physischen Wagen — das Produkt wird in der App abgehakt und einem digitalen Warenkorb zugeordnet. Es gibt **keinen separaten Warenkorb-Screen**: Die heutige "Abgehakt"-Sektion wird zum "Im Wagen"-Bereich, und ein neuer Sticky Footer zeigt Listenpreis und Warenkorbpreis nebeneinander.

### Core Concept

```
Bestehende Einkaufsliste (3 Ansichtsmodi bleiben erhalten)
    │
    ├── "Noch zu holen" (oben) — Ansicht je nach gewähltem Modus
    │     ☐ Milch                    1,09 €
    │     ☐ Brot                     1,49 €
    │
    ├── "Im Wagen" (unten) — immer flache Liste, chronologisch
    │     ✓ Eier (von Liste)         2,19 €
    │     ✓ Butter (von Liste)       1,69 €
    │     + Chips (extra gescannt)   1,79 €   ← visuell markiert
    │
    └── Sticky Footer
          📋 ~7,35 €    🛒 6,47 €    [📷]
```

**Kein neuer Screen. Kein neuer Modus. Null Lernkurve.** Das bestehende mentale Modell (oben = offen, unten = erledigt) wird beibehalten und erweitert.

---

## Data Model Changes

### Existing table: `list_items` — new column

```sql
ALTER TABLE list_items
  ADD COLUMN is_extra_scan BOOLEAN NOT NULL DEFAULT false;
```

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `is_extra_scan` | `boolean` | `false` | Unterscheidet Items, die ursprünglich auf der Liste standen, von spontan gescannten Extras |

**Auswirkung auf Remove-Logik:**
- `is_extra_scan = false` (Listenprodukt): Entfernen setzt `is_checked = false` → Item wandert zurück nach "Noch zu holen"
- `is_extra_scan = true` (Extra): Entfernen löscht das Item komplett

### TypeScript type update

In `src/types/index.ts`, `ListItem` interface:

```typescript
interface ListItem {
  // ... existing fields ...
  is_extra_scan?: boolean;  // default false
}
```

### No new tables

Phase 1–5 benötigt keine neuen Tabellen. Der bestehende `list_items`-Mechanismus reicht aus.

---

## Scan-to-Cart Flow

```
Nutzer drückt Scan-Button im Footer
         │
         ▼
Kamera-Viewfinder (bestehendes BarcodeScannerModal)
         │
      EAN erkannt
         │
         ▼
Produkt-Lookup (3 Stufen):
  1. ALDI-Produkte (lokaler Cache + Supabase)    → findProductByEan()
  2. Wettbewerber-Produkte                        → findCompetitorProductByEan()
  3. Open Food Facts                              → fetchOpenFoodFacts()
         │
         ├── Produkt gefunden
         │     │
         │     ▼
         │   Match gegen aktive Liste (product_id oder EAN)?
         │     │
         │     ├── JA: is_checked = true (bestehender Check-off-Flow)
         │     │       Toast: "Eier ✓ — von der Liste abgehakt"
         │     │
         │     └── NEIN: Neues list_item erstellen:
         │               is_checked = true, is_extra_scan = true
         │               Toast: "Chips — in den Wagen gelegt"
         │
         ├── Produkt NICHT gefunden
         │     └── Produkt-Erfassungs-Flow öffnen (ProductCaptureModal)
         │         mit "Überspringen"-Option → Item nur mit EAN, ohne Preis
         │
         └── Produkt gefunden, aber KEIN Preis
               └── Kurzer Dialog: "Preis eingeben" mit Nummernfeld
                   oder "Ohne Preis hinzufügen"
```

### Duplicate Scan (gleiches Produkt nochmal gescannt)

```
EAN bereits im Wagen?
  │
  ├── JA → Menge automatisch +1
  │        Toast: "Joghurt — jetzt 2× im Wagen"
  │
  └── NEIN → Normal hinzufügen
```

### Audio/Haptic Feedback

Bei jedem erfolgreichen Scan:
- **Leiser Piepton** via Web Audio API (~100ms Sinuswelle, respektiert Gerätelautstärke und Stumm-Modus)
- **Vibration** 50ms (bestehendes Pattern aus `barcode-scanner-modal.tsx`)
- Beide Feedback-Kanäle gleichzeitig

---

## Cart Management (Aus dem Wagen entfernen)

### Interaktion

Tap auf ein abgehaktes Item → Inline-Controls erscheinen:

```
Normaler Zustand:
┌──────────────────────────────────────────┐
│  ✓  Eier                   2× · 4,38 € │
└──────────────────────────────────────────┘

Nach Tap:
┌──────────────────────────────────────────┐
│  ✓  Eier                                │
│  [🗑]   [−]   2   [+]          4,38 €  │
└──────────────────────────────────────────┘
```

### Remove-Logik

```
[🗑] oder [−] bei Menge 1:
    │
    ├── is_extra_scan = false (war auf der Liste)?
    │     └── is_checked = false → zurück nach "Noch zu holen"
    │         Warenkorb-Summe -= Preis
    │
    └── is_extra_scan = true (Extra)?
          └── Item komplett löschen
              Warenkorb-Summe -= Preis

[−] bei Menge > 1:
    └── Menge -= 1, Preis anpassen

[+]:
    └── Menge += 1, Preis anpassen
```

---

## Sticky Footer

### Layout (drei Zustände)

**Zustand 1: Zu Hause (GPS aktiv, kein Laden in der Nähe)**

```
┌──────────────────────────────────────────┐
│  📋  ~7,35 €                             │
└──────────────────────────────────────────┘
```

**Zustand 2: Im Laden, noch nichts gescannt**

```
┌──────────────────────────────────────────┐
│  📋  ~7,35 €       🛒  —          [📷] │
└──────────────────────────────────────────┘
```

**Zustand 3: Im Laden, Items gescannt**

```
┌──────────────────────────────────────────┐
│  📋  ~7,35 €       🛒  6,47 €     [📷] │
└──────────────────────────────────────────┘
```

### Preisberechnung

| Wert | Berechnung | Bedeutung |
|------|------------|-----------|
| **📋 Listenpreis** | `estimateTotal()` über ALLE Items (checked + unchecked) | "So viel wird der Einkauf wahrscheinlich kosten" |
| **🛒 Warenkorbpreis** | `estimateTotal()` über nur `is_checked = true` Items | "So viel liegt im Wagen" |

Tilde (~) beim Listenpreis signalisiert: Katalogpreise können abweichen. Warenkorbpreis ist exakter (bei gescannten Produkten mit bekanntem Preis).

`withoutPriceCount > 0` wird als Untertitel angezeigt, wie heute schon.

### Scan-Button

- Position: ganz rechts im Footer, optimiert für Daumen-Erreichbarkeit
- Touch Target: mindestens 44×44px
- Icon: Kamera/Barcode-Symbol
- Tap öffnet das bestehende `BarcodeScannerModal`

---

## Scan Button Visibility (GPS-Logik)

```
GPS-Einstellung in der App?
    │
    ├── GPS deaktiviert
    │     └── Scan-Button IMMER sichtbar
    │
    └── GPS aktiviert
          │
          ├── Position + Store in der Nähe (< 200m)
          │     └── SICHTBAR
          │
          ├── Position + kein Store in der Nähe
          │     └── VERSTECKT
          │
          └── Position nicht ermittelbar (Timeout, Fehler)
                └── SICHTBAR (Fallback)

Sonderregel: Mindestens 1 Item gescannt → SICHTBAR (unabhängig von GPS)
```

**Laden verlassen (Option A):** Wenn Items im Wagen sind (`checked.length > 0` mit `is_extra_scan`-Items oder gescannten Items), bleibt der Scan-Button sichtbar — auch wenn GPS > 350m meldet. Erst nach "Einkauf beenden" oder neuem Tag wird zurückgesetzt.

### Pseudocode (basiert auf bestehendem `useStoreDetection`)

```typescript
function useScanButtonVisible(): boolean {
  const gpsEnabled = useGpsEnabled();
  const { isInStore, gpsError } = useStoreDetection();
  const hasCartItems = checked.some(item => item.is_extra_scan) || hasScannedItems;

  if (hasCartItems) return true;     // Einmal gescannt → bleibt
  if (!gpsEnabled) return true;      // GPS aus → immer zeigen
  if (gpsError) return true;         // GPS-Fehler → Fallback
  if (isInStore) return true;        // Im Laden
  return false;                      // Zu Hause, plant nur
}
```

---

## Auto-Archive Suppression

### Problem

Der aktuelle Trigger in `src/app/[locale]/page.tsx` (Zeile ~188) archiviert die Liste automatisch, sobald `unchecked.length === 0 && checked.length > 0`. Mit Scan & Go würde das mitten im Einkauf passieren (nach dem letzten Listen-Item, bevor Extras gescannt werden).

### Lösung

Wenn der Scan-Button sichtbar ist (Scan & Go aktiv), Auto-Archivierung **unterdrücken**. Stattdessen:

```
Alle Listen-Items abgehakt:
┌──────────────────────────────────────────┐
│  ✅ Alle Artikel von der Liste im Wagen! │
│  Weiter scannen oder Einkauf beenden?    │
│                                          │
│  [ Weiter scannen ]    [ Einkauf ✓ ]    │
└──────────────────────────────────────────┘
```

"Einkauf beenden" löst `archiveListAsTrip()` aus — inklusive der Extra-Items (`is_extra_scan = true`).

---

## View Mode Compatibility

| Sektion | Meine Reihenfolge | Einkaufsreihenfolge (Liste) | Einkaufsreihenfolge (Kacheln) |
|---------|-------------------|-----------------------------|-------------------------------|
| "Noch zu holen" | Flache Liste | Gruppierte Liste | 2-Spalten Grid |
| "Im Wagen" (checked) | Flache Liste, chronologisch | Flache Liste, chronologisch | Flache Liste, chronologisch |
| Sticky Footer | 📋 + 🛒 + [📷] | 📋 + 🛒 + [📷] | 📋 + 🛒 + [📷] |

"Noch zu holen" folgt dem Nutzerwunsch. "Im Wagen" ist **immer** flach und chronologisch sortiert (neueste zuerst) — dort geht es um Überblick und Kostenkontrolle, nicht um Aisle-Sortierung.

---

## Offline Behavior

| Schicht | Offline-fähig? |
|---------|----------------|
| Barcode-Scanner (Kamera) | Ja — läuft lokal |
| Produkt-Lookup (IndexedDB) | Ja — Produkte sind lokal gecacht |
| Preis (aus `products.price`) | Ja — lokal vorhanden |
| Check-off (Supabase Write) | Ja — über bestehende `offline_queue` gepuffert |
| EAN-Lookup bei Open Food Facts | Nein — braucht Netz. Fallback: manuell eingeben |

---

## Shared Lists Compatibility

Shared Lists (F16) sind noch nicht implementiert, aber das Design ist kompatibel: Supabase Realtime synct `list_items` bereits geräteübergreifend. Wenn User A scannt, sieht User B die Änderung. Keine Sonderbehandlung nötig.

---

## Key Files to Modify

| Datei | Änderung |
|-------|----------|
| `src/components/list/shopping-list-content.tsx` | Footer-Redesign (dual price + scan button), `position: sticky` |
| `src/components/search/barcode-scanner-modal.tsx` | Neue Callback-Variante `onCartScan` für Scan & Go Kontext |
| `src/components/list/hooks/use-list-mutations.ts` | "Uncheck" und "Remove Extra" Aktionen |
| `src/hooks/use-store-detection.ts` | `isInStore` und `gpsEnabled` für Scan-Button-Sichtbarkeit exponieren |
| `src/lib/list/list-helpers.ts` | Getrennte `estimateTotal`-Aufrufe für Liste vs. Warenkorb |
| `src/app/[locale]/page.tsx` | Auto-Archive-Guard wenn Scan & Go aktiv |
| `src/types/index.ts` | `is_extra_scan` auf `ListItem` |
| `src/lib/db/indexed-db.ts` | Schema-Version-Bump, `is_extra_scan` Feld |
| Supabase Migration | `ALTER TABLE list_items ADD COLUMN is_extra_scan ...` |
| `src/messages/de.json` / `en.json` | i18n-Strings für Footer, Toasts, Banner |

---

## Implementation Phases

### Phase 1: Dual-Price Sticky Footer (standalone value)

**Scope:** Footer zeigt zwei Preise — Listenpreis und Warenkorbpreis (= Summe der abgehakten Items). Kein Scan-Button, kein `is_extra_scan`. Rein visuell — nutzt bestehende Daten.

**Änderungen:**
- `shopping-list-content.tsx`: Footer-Markup neu (zwei Spalten mit Icons)
- `list-helpers.ts` / `use-list-fetch.ts`: `estimateTotal()` separat für `unchecked + checked` (Liste) und `checked` (Wagen)
- `de.json` / `en.json`: Neue i18n-Keys
- Footer `position: sticky` oder fixed am unteren Rand

**Aufwand:** 1 Session

---

### Phase 2: Scan-to-Cart Flow

**Scope:** Scan-Button im Footer. Scan checkt Listenprodukte ab, legt nicht-gelistete Produkte als Extras an. Piepton + Vibration.

**Änderungen:**
- Supabase-Migration: `is_extra_scan` Spalte
- `types/index.ts`: `is_extra_scan` auf `ListItem`
- `indexed-db.ts`: Schema-Version-Bump
- `shopping-list-content.tsx`: Scan-Button im Footer, öffnet `BarcodeScannerModal`
- `barcode-scanner-modal.tsx` oder neuer Wrapper: Scan-to-Cart-Logik (Match gegen Liste, Extra-Item erstellen)
- Neue Service-Funktion: `matchScanToListItem(ean, activeListItems)`
- Audio-Feedback: Web Audio API Beep-Utility (`src/lib/utils/scan-beep.ts`)
- Visuelle Unterscheidung für `is_extra_scan`-Items in der Checked-Sektion

**Aufwand:** 2–3 Sessions

---

### Phase 3: Cart Management

**Scope:** Inline-Controls auf abgehakten Items (Menge ändern, entfernen). Unterschiedliche Remove-Logik für Listen-Items vs. Extras.

**Änderungen:**
- `list-item-row.tsx` oder `checked-item-row.tsx`: Tap → Inline-Controls (🗑, −, +)
- `use-list-mutations.ts`: `uncheckItem()` (für Listen-Items) und `removeExtraItem()` (für Extras)
- Duplicate-Scan-Handling: Menge +1 statt neues Item

**Aufwand:** 1–2 Sessions

---

### Phase 4: Auto-Archive Suppression

**Scope:** Unterdrückt automatische Archivierung wenn Scan & Go aktiv. "Einkauf beenden"-Flow.

**Änderungen:**
- `page.tsx`: Guard im `useEffect` der Auto-Archivierung
- Banner-Komponente: "Alle Artikel im Wagen — weiter scannen oder beenden?"
- `archiveListAsTrip()`: Extra-Items korrekt als `trip_items` einschließen

**Aufwand:** 1 Session

---

### Phase 5: GPS-basierte Scan-Button-Sichtbarkeit

**Scope:** Scan-Button nur im Laden anzeigen (oder wenn GPS deaktiviert / Items gescannt).

**Änderungen:**
- Neuer Hook: `useScanButtonVisible()` basierend auf `useStoreDetection`
- `shopping-list-content.tsx`: Conditional Rendering des Scan-Buttons
- Option A: Button bleibt sichtbar solange Items im Wagen

**Aufwand:** 1 Session

---

## Implementation Prompts

> **Anleitung:** Jede Phase hat einen eigenen, selbstständigen Prompt.
> Kopiere den Prompt in einen neuen Agent-Mode-Chat. Nach Abschluss einer Phase, trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase N" ein, damit die nächste Phase den vollen Kontext hat.

---

### Prompt: Phase 1 — Dual-Price Sticky Footer

<details>
<summary>Zusammenfassung Phase 1 (implementiert)</summary>

> **Status:** Abgeschlossen
>
> **Geaenderte Dateien:**
> - `src/components/list/dual-price-footer.tsx` — Neue Komponente: Dual-Price Sticky Footer mit SVG-Icons
> - `src/components/list/shopping-list-content.tsx` — Alter Footer ersetzt durch `DualPriceFooter`, neue Props `cartTotal`/`cartWithoutPriceCount` destructured
> - `src/components/list/hooks/use-list-fetch.ts` — `cartTotal` und `cartWithoutPriceCount` State + Berechnung via `estimateTotal(checked)`
> - `src/components/list/hooks/use-list-sort.ts` — `resortItems` gibt jetzt auch `cartTotal`/`cartWithoutPriceCount` zurueck
> - `src/components/list/use-list-data.ts` — Interface `UseListDataResult` um `cartTotal`/`cartWithoutPriceCount` erweitert
> - `src/app/[locale]/page.tsx` — `stableListData` useMemo um neue Felder erweitert
> - `src/messages/de.json` — 7 neue i18n-Keys im `list`-Namespace
> - `src/messages/en.json` — 7 neue i18n-Keys im `list`-Namespace
> - `src/lib/list/__tests__/estimate-total.test.ts` — 8 neue Unit-Tests
>
> **Neue i18n-Keys:**
> - `list.footerListPrice` — "~{price}" (Listenpreis mit Tilde)
> - `list.footerCartPrice` — "{price}" (Warenkorbpreis ohne Tilde)
> - `list.footerCartEmpty` — "—" (Strich bei leerem Warenkorb)
> - `list.footerItemCount` — "{count} Artikel / items"
> - `list.footerWithoutPrice` — "{count} ohne Preis / without price"
> - `list.footerListLabel` — "Liste / List" (aria-label)
> - `list.footerCartLabel` — "Wagen / Cart" (aria-label)
>
> **Architektur-Entscheidungen:**
> - Footer als eigene Komponente `DualPriceFooter` extrahiert (< 120 Zeilen), um `shopping-list-content.tsx` unter 300 Zeilen zu halten
> - `estimateTotal()` wird zweimal aufgerufen (alle Items fuer Listenpreis, nur checked Items fuer Warenkorbpreis) — kein neuer Code in `list-helpers.ts` noetig
> - Listenpreis schliesst jetzt auch deferred Items ein (`[...u, ...c, ...d]` statt vorher `[...u, ...c]`) — korrekter, da die Gesamtkosten des Einkaufs abgebildet werden
> - Footer nutzt `sticky bottom-0` mit `backdrop-blur-sm` und `z-10` fuer echtes Sticky-Verhalten
> - SVG-Icons inline statt externe Icon-Library (ListIcon = Aufzaehlungssymbol, CartIcon = Einkaufswagen)
> - ALDI-Farben: Blau (#001E5E) fuer Listensymbol, Orange (#F37D1E) fuer Wagensymbol
>
> **Offene Punkte / Tech Debt:**
> - Alte i18n-Keys `estimatedTotal` und `productsWithoutPrice` bleiben vorerst bestehen (werden ggf. noch von `home`-Screen referenziert)
> - `withoutPriceCount` wird jetzt als Gesamtzahl (list + cart) im Footer angezeigt statt getrennt — kann in Phase 2 feiner aufgeschluesselt werden
>
> **Test-Ergebnisse:**
> - 8 neue Tests in `estimate-total.test.ts`, alle bestehen
> - Alle 58 bestehenden List-Tests weiterhin gruen
> - `npx tsc --noEmit` fehlerfrei

</details>

````
Implementiere Phase 1 des Scan & Go Features (F43) fuer die ALDI Einkaufsliste.

## Kontext

Die vollstaendige Feature-Spec liegt in specs/SCAN-AND-GO.md -- lies sie zuerst.
Das Projekt ist eine Next.js 14 PWA (App Router, TypeScript strict, Tailwind CSS, Supabase, Dexie.js).
Coding-Standards: max 300 Zeilen pro Datei, @/-Imports, keine leeren Catch-Bloecke.
Testing-Standards: Vitest, min. 1 Happy-Path + 1 Edge-Case Test pro Funktion.

## Phase 1: Dual-Price Sticky Footer

### Was zu tun ist

Der bestehende Footer in `src/components/list/shopping-list-content.tsx` (aktuell ab Zeile ~186) zeigt einen einzigen geschaetzten Gesamtpreis. Ersetze ihn durch einen Dual-Price Footer:

1. **Linke Haelfte -- Listenpreis:**
   - Icon: Listensymbol (SVG, kein Emoji)
   - Berechnung: `estimateTotal()` ueber ALLE Items (unchecked + checked + deferred)
   - Zeigt "~X,XX EUR" mit Tilde (Schaetzung)
   - Darunter Artikelanzahl

2. **Rechte Haelfte -- Warenkorbpreis:**
   - Icon: Einkaufswagen-Symbol (SVG, kein Emoji)
   - Berechnung: `estimateTotal()` ueber nur `checked` Items
   - Zeigt "X,XX EUR" ohne Tilde (exakter, weil bereits eingelegt)
   - Wenn keine Items abgehakt: Strich anzeigen
   - Darunter Artikelanzahl

3. **Layout:**
   - Einzeilig, zwei Bereiche mit Icons statt Text-Labels
   - `withoutPriceCount` als Subtitle wenn > 0
   - Footer muss wirklich sticky/fixed am unteren Rand sein (aktuell ist er am Ende des Flex-Layouts, aber nicht CSS-sticky)

### Schluesseldateien

- `src/components/list/shopping-list-content.tsx` -- Footer-Markup (ab Zeile ~186)
- `src/lib/list/list-helpers.ts` -- `estimateTotal()` Funktion (ab Zeile ~286)
- `src/components/list/hooks/use-list-fetch.ts` -- Hier werden `total` und `withoutPriceCount` berechnet; muss um Cart-Total erweitert werden
- `src/messages/de.json` und `src/messages/en.json` -- i18n-Keys

### Bestehender Footer-Code (zum Ersetzen)

Der aktuelle Footer in `shopping-list-content.tsx`:

```tsx
{hasAnyItems && (
  <footer className="border-t border-aldi-muted-light bg-gray-50/50 px-4 py-4" role="region" ...>
    <p className="text-base font-semibold text-aldi-text">{t("estimatedTotal", { price: priceFormatted })}</p>
    {withoutPriceCount > 0 && (
      <p className="mt-0.5 text-sm text-aldi-muted">{t("productsWithoutPrice", { count: withoutPriceCount })}</p>
    )}
  </footer>
)}
```

### Bestehende Preisberechnung

In `list-helpers.ts`:

```typescript
export function estimateTotal(items: ListItemWithMeta[]): {
  total: number;
  withoutPriceCount: number;
}
```

Diese Funktion kann wiederverwendet werden -- einmal mit allen Items aufgerufen (Listenpreis), einmal nur mit checked Items (Warenkorbpreis).

### Design-Vorgaben

- ALDI-Farben: Blue #001E5E, Orange #F37D1E
- Touch Target: mind. 44px
- Mobile-first, 375px Mindestbreite
- Icons (SVG) statt Text-Labels "Liste"/"Wagen"
- Tailwind CSS, konsistent mit bestehendem Design

### Akzeptanzkriterien

- [ ] Footer zeigt zwei Preisbereiche (Liste und Wagen) nebeneinander
- [ ] Listenpreis = Summe aller Items (checked + unchecked)
- [ ] Warenkorbpreis = Summe nur der checked Items
- [ ] Wenn keine Items abgehakt: Warenkorbpreis zeigt Strich
- [ ] Footer ist sticky (bleibt am unteren Rand beim Scrollen)
- [ ] Funktioniert in allen drei Ansichtsmodi (my-order, shopping-order, shopping-order-tiles)
- [ ] i18n-Strings fuer DE und EN vorhanden
- [ ] `withoutPriceCount` wird weiterhin angezeigt
- [ ] Tests: Unit-Tests fuer die getrennte Preisberechnung
- [ ] TypeScript: `npx tsc --noEmit` fehlerfrei

### Nach Abschluss

Trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase 1" in specs/SCAN-AND-GO.md ein.
````

---

### Prompt: Phase 2 — Scan-to-Cart Flow

<details>
<summary>Zusammenfassung Phase 2 (implementiert)</summary>

> **Status:** Abgeschlossen
>
> **Geaenderte Dateien:**
> - `src/types/index.ts` — `is_extra_scan?: boolean` auf `ListItem` hinzugefuegt
> - `src/lib/db/indexed-db.ts` — Schema-Version 17: `is_extra_scan` Index auf `list_items`
> - `src/lib/list/active-list-write.ts` — `AddItemParams` um `is_extra_scan` und `is_checked` erweitert; `addListItem()` setzt beide Felder im Insert; `updateListItem()` akzeptiert `is_extra_scan`
> - `src/components/list/dual-price-footer.tsx` — Scan-Button (ScanIcon SVG, 44x44px orange Touch Target) rechts neben Warenkorbpreis; neues Prop `onScanPress`
> - `src/components/list/shopping-list-content.tsx` — Scanner-Integration via `useCartScanner` Hook; Toast-Anzeige; BarcodeScannerModal + CartScanPricePrompt eingebunden
> - `src/components/list/item-badges.tsx` — "Extra"-Badge (orange Akzent) fuer `is_extra_scan`-Items in der Checked-Sektion
> - `src/components/list/list-item-row.tsx` — Orangefarbener linker Rand (`border-l-[#F37D1E]`) fuer gescannte Extra-Items
> - `src/messages/de.json` — 9 neue i18n-Keys im `list`-Namespace (scanBarcode, scanCheckedOff, scanExtraAdded, scanDuplicateIncremented, scanProductNotFound, scanSkip, scanEnterPrice, scanAddWithoutPrice, scanPricePlaceholder, extraBadge)
> - `src/messages/en.json` — 9 neue i18n-Keys im `list`-Namespace (Englisch)
>
> **Neue Dateien:**
> - `src/lib/cart/scan-to-cart.ts` — Scan-to-Cart Service: `handleCartScan()`, `matchProductToListItem()`, `matchEanToListItem()` mit 5 Result-Typen (checked_off, extra_added, duplicate_incremented, product_not_found, needs_price)
> - `src/lib/utils/scan-beep.ts` — Audio-Feedback via Web Audio API: `playScanBeep()` (880Hz Sinuswelle, 100ms, leise) + `playScanFeedback()` (Beep + Vibration 50ms)
> - `src/components/list/hooks/use-cart-scanner.ts` — React-Hook: orchestriert Scanner-Oeffnen, Scan-Result-Handling, Toast-State, Preis-Prompt-State, Capture-Modal-Integration
> - `src/components/list/cart-scan-price-prompt.tsx` — Dialog fuer "Preis eingeben" oder "Ohne Preis hinzufuegen" bei Produkten ohne Preis
> - `src/lib/cart/__tests__/scan-to-cart.test.ts` — 11 Unit-Tests fuer Scan-Matching-Logik
> - `src/lib/utils/__tests__/scan-beep.test.ts` — 6 Unit-Tests fuer Audio-Feedback
> - `supabase/migrations/20260314100000_list_items_is_extra_scan.sql` — Supabase-Migration
>
> **Migration:**
> - `ALTER TABLE list_items ADD COLUMN is_extra_scan BOOLEAN NOT NULL DEFAULT false`
>
> **Architektur-Entscheidungen:**
> - Scan-to-Cart-Logik als reiner Service (`src/lib/cart/scan-to-cart.ts`) ohne UI-Abhaengigkeiten — testbar und wiederverwendbar
> - `useCartScanner` Hook kapselt die gesamte Orchestrierung (Scanner-State, Result-Handling, Toast, Preis-Prompt, Capture-Modal) — haelt `shopping-list-content.tsx` unter 300 Zeilen
> - Bestehendes `BarcodeScannerModal` wird 1:1 wiederverwendet, nur mit anderen Callbacks (check-off statt add-to-list)
> - `is_extra_scan` propagiert automatisch ueber `LocalListItem extends ListItem` → `ListItemWithMeta extends LocalListItem` — kein separates Feld auf `ListItemWithMeta` noetig
> - Audio-Feedback ueber Web Audio API statt Audio-Datei — keine zusaetzlichen Assets, respektiert System-Lautstaerke
> - Scan-Button vorerst immer sichtbar (GPS-Logik kommt in Phase 5)
> - Duplicate-Scan: Quantity +1 auf bestehendem Item statt neues Item erstellen
>
> **Offene Punkte / Tech Debt:**
> - GPS-basierte Scan-Button-Sichtbarkeit (Phase 5)
> - Cart Management Inline-Controls (Phase 3) — Menge aendern, entfernen mit is_extra_scan-aware Remove-Logik
> - Auto-Archive Suppression (Phase 4) — Archivierung unterdruecken wenn Scan & Go aktiv
> - Preis-Prompt speichert aktuell keinen Preis auf dem Produkt (nur Item-Erstellung) — TODO fuer spaeter
>
> **Test-Ergebnisse:**
> - 17 neue Tests (11 scan-to-cart + 6 scan-beep), alle bestehen
> - Alle 993 bestehenden Tests weiterhin gruen (93 Dateien)
> - `npx tsc --noEmit` fehlerfrei

</details>

````
Implementiere Phase 2 des Scan & Go Features (F43) fuer die ALDI Einkaufsliste.

## Kontext

Lies zuerst specs/SCAN-AND-GO.md -- die vollstaendige Feature-Spec.
Phase 1 (Dual-Price Sticky Footer) ist bereits implementiert. Lies den Abschnitt
"Zusammenfassung Phase 1" in der Spec fuer den aktuellen Stand.

Das Projekt ist eine Next.js 14 PWA (App Router, TypeScript strict, Tailwind CSS, Supabase, Dexie.js).
Coding-Standards: max 300 Zeilen pro Datei, @/-Imports, keine leeren Catch-Bloecke.
Testing-Standards: Vitest, min. 1 Happy-Path + 1 Edge-Case Test pro Funktion.

## Phase 2: Scan-to-Cart Flow

### Was zu tun ist

1. **Supabase-Migration:** Neue Spalte `is_extra_scan BOOLEAN NOT NULL DEFAULT false` auf `list_items`.

2. **TypeScript-Types:** `is_extra_scan?: boolean` auf `ListItem` in `src/types/index.ts` und auf `LocalListItem` in `src/lib/db/indexed-db.ts` (Schema-Version-Bump).

3. **Scan-Button im Footer:** Rechts neben dem Warenkorbpreis (siehe Phase-1-Footer). 44px+ Touch Target, Barcode/Kamera-Icon. Oeffnet das bestehende `BarcodeScannerModal` aus `src/components/search/barcode-scanner-modal.tsx`.

4. **Scan-to-Cart Service:** Neue Datei `src/lib/cart/scan-to-cart.ts`:
   ```typescript
   async function handleCartScan(
     ean: string,
     activeListItems: ListItem[],
     products: Product[],
     competitorProducts: CompetitorProduct[]
   ): Promise<CartScanResult>
   ```
   - Produkt ueber EAN finden (3-Stufen-Lookup wie in `barcode-scanner-modal.tsx`)
   - Gegen aktive Liste matchen (ueber `product_id`)
   - Match gefunden: `setItemChecked(itemId, true)` -- bestehender Check-off-Flow
   - Kein Match: Neues `list_item` erstellen mit `is_checked: true, is_extra_scan: true`
   - Produkt nicht in DB: `ProductCaptureModal` oeffnen mit "Ueberspringen"-Option (nur EAN, kein Preis)
   - Produkt ohne Preis: Dialog "Preis eingeben" oder "Ohne Preis hinzufuegen"

5. **Duplicate-Scan:** Wenn EAN bereits im Wagen (checked item mit passendem product_id):
   Menge +1 statt neues Item. Toast: "Joghurt -- jetzt 2x im Wagen"

6. **Audio-Feedback:** Neue Utility `src/lib/utils/scan-beep.ts`:
   - Web Audio API: kurze Sinuswelle (~100ms, ~880Hz), leise
   - Respektiert Geraetelauststaerke und Stumm-Modus
   - Aufrufen zusammen mit bestehender Vibration (50ms) bei erfolgreichem Scan

7. **Visuelle Unterscheidung:** Items mit `is_extra_scan = true` in der Checked-Sektion
   mit einem "+"-Badge oder leicht orangefarbenem Akzent markieren.

### Schluesseldateien

- `src/components/list/shopping-list-content.tsx` -- Scan-Button im Footer, Scanner-Integration
- `src/components/search/barcode-scanner-modal.tsx` -- Bestehende Scanner-Logik (wiederverwenden, nicht duplizieren)
- `src/lib/products/ean-utils.ts` -- `findProductByEan()`, `eanVariants()`
- `src/lib/competitor-products/competitor-product-service.ts` -- `findCompetitorProductByEan()`
- `src/components/list/hooks/use-list-mutations.ts` -- `setItemChecked()`
- `src/lib/list/active-list-write.ts` -- `addListItem()` fuer Extra-Items
- `src/types/index.ts` -- `ListItem` erweitern
- `src/lib/db/indexed-db.ts` -- Schema-Version-Bump
- `src/components/list/list-item-row.tsx` -- Visuelle Unterscheidung fuer Extras

### Bestehender Scanner-Code (als Referenz)

Der Scanner in `barcode-scanner-modal.tsx` hat bereits:
- `handleDetected(ean)` -- 3-Stufen-Lookup
- `onProductAdded`, `onProductNotFound`, `onCreateProduct` Callbacks
- Vibration bei Erkennung
- "Produkt nicht gefunden" UI mit "Produkt erfassen" Button

Die neue Scan-to-Cart-Logik sollte die gleichen Lookup-Funktionen wiederverwenden,
aber andere Callbacks haben (check-off statt add-to-list).

### Akzeptanzkriterien

- [ ] Scan-Button erscheint im Footer (vorerst immer sichtbar -- GPS-Logik kommt in Phase 5)
- [ ] Scan oeffnet Kamera-Viewfinder
- [ ] EAN-Scan eines Listenprodukts hakt es ab (is_checked = true)
- [ ] EAN-Scan eines Nicht-Listenprodukts legt es als Extra an (is_extra_scan = true, is_checked = true)
- [ ] Doppel-Scan erhoeht Menge statt Duplikat
- [ ] Leiser Piepton + Vibration bei erfolgreichem Scan
- [ ] Unbekanntes Produkt oeffnet Erfassungs-Flow mit Ueberspringen-Option
- [ ] Extra-Items sind visuell unterscheidbar in der Checked-Sektion
- [ ] Supabase-Migration erstellt und getestet
- [ ] Tests: Scan-Matching-Logik, Duplikat-Erkennung, Beep-Utility
- [ ] TypeScript: `npx tsc --noEmit` fehlerfrei

### Nach Abschluss

Trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase 2" in specs/SCAN-AND-GO.md ein.
````

---

### Prompt: Phase 3 — Cart Management

<details>
<summary>Zusammenfassung Phase 3 (implementiert)</summary>

> **Status:** Abgeschlossen
>
> **Geaenderte Dateien:**
> - `src/components/list/cart-item-controls.tsx` — Neue Komponente: Inline-Controls fuer abgehakte Items (Loeschen, Minus, Menge, Plus, Preis) mit Slide-in-Animation
> - `src/components/list/list-section.tsx` — `CheckedSection` erweitert: `expandedId` State (nur ein Item gleichzeitig), Tap-Handler fuer Expand/Collapse, `onUncheckItem` Prop, `CartItemControls` Integration
> - `src/components/list/hooks/use-list-mutations.ts` — Neue `uncheckItem()` Mutation: prueft `is_extra_scan` — regulaere Items werden unchecked (zurueck auf Liste), Extra-Items werden komplett geloescht
> - `src/components/list/use-list-data.ts` — `UseListDataResult` Interface um `uncheckItem` erweitert; `uncheckItem` in Return-Objekt aufgenommen
> - `src/components/list/shopping-list-content.tsx` — `uncheckItem` destructured und als `onUncheckItem` an `CheckedSection` weitergereicht
> - `src/app/[locale]/page.tsx` — `stableListData` useMemo um `uncheckItem` erweitert
> - `src/styles/globals.css` — Neue Animation `@keyframes cart-controls-in` (Slide-in, 0.2s ease-out)
> - `src/messages/de.json` — 5 neue i18n-Keys: `cartControlsLabel`, `cartRemoveItem`, `cartQuantityMinus`, `cartQuantityPlus`, `cartQuantityValue`
> - `src/messages/en.json` — 5 neue i18n-Keys (Englisch)
>
> **Neue Dateien:**
> - `src/components/list/cart-item-controls.tsx` — Inline-Controls-Komponente (< 140 Zeilen)
> - `src/lib/cart/__tests__/cart-management.test.ts` — 11 Unit-Tests fuer Cart-Management-Logik
>
> **Architektur-Entscheidungen:**
> - `CartItemControls` als eigene Komponente extrahiert — haelt `list-section.tsx` und `list-item-row.tsx` unter 300 Zeilen
> - Expand/Collapse-State lebt in `CheckedSection` (nicht global) — nur ein Item kann gleichzeitig geoeffnet sein, zweiter Tap oder Tap auf anderes Item schliesst das vorherige
> - `uncheckItem` in `use-list-mutations.ts` behandelt beide Faelle in einer Funktion: `is_extra_scan=true` → `deleteListItem()`, `is_extra_scan=false` → `updateListItem({ is_checked: false })`
> - Optimistic Updates: UI aktualisiert sofort, Rollback bei DB-Fehler
> - Animation ueber CSS `@keyframes` statt JS-Animation — performant, GPU-beschleunigt
> - Quantity-Controls wiederverwenden die bestehende `setItemQuantity`-Mutation
>
> **Offene Punkte / Tech Debt:**
> - Auto-Archive Suppression (Phase 4) — Archivierung unterdruecken wenn Scan & Go aktiv
> - GPS-basierte Scan-Button-Sichtbarkeit (Phase 5) — aktuell immer sichtbar
> - Click-outside-to-close fuer die Inline-Controls koennte noch verfeinert werden (aktuell schliesst Tap auf anderes Item oder erneuter Tap)
>
> **Test-Ergebnisse:**
> - 11 neue Tests in `cart-management.test.ts`, alle bestehen
> - Alle 22 Cart-Tests (11 scan-to-cart + 11 cart-management) bestehen
> - Alle 58 bestehenden List-Tests weiterhin gruen
> - `npx tsc --noEmit` fehlerfrei

</details>

````
Implementiere Phase 3 des Scan & Go Features (F43) fuer die ALDI Einkaufsliste.

## Kontext

Lies zuerst specs/SCAN-AND-GO.md -- die vollstaendige Feature-Spec.
Phase 1 und 2 sind bereits implementiert. Lies die Abschnitte "Zusammenfassung Phase 1"
und "Zusammenfassung Phase 2" in der Spec fuer den aktuellen Stand.

Das Projekt ist eine Next.js 14 PWA (App Router, TypeScript strict, Tailwind CSS, Supabase, Dexie.js).
Coding-Standards: max 300 Zeilen pro Datei, @/-Imports, keine leeren Catch-Bloecke.
Testing-Standards: Vitest, min. 1 Happy-Path + 1 Edge-Case Test pro Funktion.

## Phase 3: Cart Management (Aus dem Wagen entfernen)

### Was zu tun ist

1. **Inline-Controls auf abgehakten Items:**
   - Tap auf ein Item in der "Im Wagen"-Sektion (checked items) oeffnet Inline-Controls
   - Controls: [Loeschen-Icon] [Minus] Menge [Plus] Preis
   - Erneuter Tap oder Tap woanders klappt die Controls wieder zu
   - Nur EIN Item kann gleichzeitig geoeffnet sein

2. **Remove-Logik (zwei Faelle):**
   - `is_extra_scan = false` (war auf der Einkaufsliste):
     Loeschen/Minus-bei-1 setzt `is_checked = false` -> Item wandert zurueck nach "Noch zu holen"
     Neue Mutation: `uncheckItem(itemId)` in `use-list-mutations.ts`
   - `is_extra_scan = true` (Extra, nicht auf der Liste):
     Loeschen/Minus-bei-1 entfernt das Item komplett aus der Liste
     Bestehende Mutation: `removeItem(itemId)`

3. **Menge aendern:**
   - [Plus]: Menge += 1
   - [Minus] bei Menge > 1: Menge -= 1
   - [Minus] bei Menge = 1: Wie Loeschen (siehe oben)

4. **Animations:**
   - Controls ein-/ausklappen mit sanfter Animation (slide-down / slide-up)
   - Beim Entfernen: bestehende `animate-check-exit` Animation wiederverwenden

### Schluesseldateien

- `src/components/list/list-item-row.tsx` -- Item-Komponente, muss um Inline-Controls erweitert werden (oder neue Sub-Komponente `cart-item-controls.tsx`)
- `src/components/list/list-section.tsx` -- `CheckedSection` rendert die abgehakten Items
- `src/components/list/hooks/use-list-mutations.ts` -- Neue `uncheckItem()` Mutation
- `src/lib/list/active-list-write.ts` -- `updateListItem()` fuer Uncheck

### Bestehende Menge-Steuerung (als Referenz)

Die bestehende Quantity-Aenderung in `use-list-mutations.ts` (`setItemQuantity`) kann als
Vorlage dienen. Die Remove-Logik muss aber `is_extra_scan` pruefen.

### Akzeptanzkriterien

- [ ] Tap auf checked Item zeigt Inline-Controls (Loeschen, Minus, Menge, Plus)
- [ ] Erneuter Tap oder Tap woanders schliesst die Controls
- [ ] Loeschen eines Listen-Items (is_extra_scan=false) setzt is_checked=false (zurueck auf die Liste)
- [ ] Loeschen eines Extra-Items (is_extra_scan=true) entfernt es komplett
- [ ] Menge kann erhoet und verringert werden
- [ ] Minus bei Menge 1 verhaelt sich wie Loeschen
- [ ] Warenkorbpreis im Footer aktualisiert sich sofort (optimistic update)
- [ ] Funktioniert in allen drei Ansichtsmodi
- [ ] Tests: uncheckItem, removeExtraItem, Mengen-Aenderung
- [ ] TypeScript: `npx tsc --noEmit` fehlerfrei

### Nach Abschluss

Trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase 3" in specs/SCAN-AND-GO.md ein.
````

---

### Prompt: Phase 4 — Auto-Archive Suppression

<details>
<summary>Zusammenfassung Phase 4 (implementiert)</summary>

> **Status:** Abgeschlossen
>
> **Geaenderte Dateien:**
> - `src/app/[locale]/page.tsx` — Auto-Archive Guard: `isScanAndGoActive` (useMemo auf `checked.some(i => i.is_extra_scan)`), `showScanCompleteBanner` State, `handleFinishScanAndGo` Callback; Completion-Screen erweitert um `tripCompleteSummary` mit Extra-Scan-Zaehler
> - `src/components/list/scan-complete-banner.tsx` — Neue Komponente: Bottom-Sheet-Banner mit "Weiter scannen" und "Einkauf beenden" Buttons, Slide-up-Animation
> - `src/styles/globals.css` — Neue Animation `@keyframes slide-up` (0.3s ease-out) fuer das Banner
> - `src/messages/de.json` — 5 neue i18n-Keys: `scanCompleteBannerTitle`, `scanCompleteBannerSubtitle`, `scanCompleteContinue`, `scanCompleteFinish`, `tripCompleteSummary`
> - `src/messages/en.json` — 5 neue i18n-Keys (Englisch)
>
> **Neue Dateien:**
> - `src/components/list/scan-complete-banner.tsx` — Banner-Komponente (< 70 Zeilen)
> - `src/lib/cart/__tests__/auto-archive-guard.test.ts` — 14 Unit-Tests fuer Guard-Logik, Banner-Anzeige, Archive mit Extra-Items
>
> **Architektur-Entscheidungen:**
> - Auto-Archive-Guard als `useMemo`-basierter Boolean `isScanAndGoActive` direkt in `page.tsx` — keine neue Hook-Datei noetig, da die Logik trivial ist (`checked.some(i => i.is_extra_scan)`)
> - Banner als Bottom-Sheet (nicht Modal) implementiert — Nutzer sieht die Liste dahinter, fühlt sich weniger blockierend an
> - `handleFinishScanAndGo` delegiert an `handleLastItemChecked` — gleicher Archivierungs-Flow wie ohne Scan & Go, inkl. Konfetti und Feedback-Prompt
> - `archiveListAsTrip()` wurde verifiziert: `tripItems = allItems.filter(i => !deferredSet.has(i.item_id))` schliesst Extra-Scan-Items automatisch ein — kein Code-Change noetig
> - Extra-Scan-Count (`extraScanCount`) wird im Completion-Screen als Summary angezeigt ("7 Artikel, davon 3 extra gescannt")
> - Vorerst (bis Phase 5): `isScanAndGoActive` basiert nur auf `checked.some(i => i.is_extra_scan)` — GPS-Logik kommt in Phase 5
>
> **Offene Punkte / Tech Debt:**
> - GPS-basierte Scan-Button-Sichtbarkeit (Phase 5) — aktuell immer sichtbar, Guard nutzt nur `is_extra_scan`-Praesenz
> - Banner koennte in Zukunft animiert ausgeblendet werden (aktuell sofortiges Unmount bei "Weiter scannen")
> - `empty catch` in `archive-trip.ts` Zeile 152 (vorbestehend, nicht Teil dieser Phase)
>
> **Test-Ergebnisse:**
> - 14 neue Tests in `auto-archive-guard.test.ts`, alle bestehen
> - Alle 1018 bestehenden Tests weiterhin gruen (95 Dateien)
> - `npx tsc --noEmit` fehlerfrei

</details>

````
Implementiere Phase 4 des Scan & Go Features (F43) fuer die ALDI Einkaufsliste.

## Kontext

Lies zuerst specs/SCAN-AND-GO.md -- die vollstaendige Feature-Spec.
Phase 1, 2 und 3 sind bereits implementiert. Lies die Abschnitte "Zusammenfassung Phase 1/2/3"
in der Spec fuer den aktuellen Stand.

Das Projekt ist eine Next.js 14 PWA (App Router, TypeScript strict, Tailwind CSS, Supabase, Dexie.js).
Coding-Standards: max 300 Zeilen pro Datei, @/-Imports, keine leeren Catch-Bloecke.
Testing-Standards: Vitest, min. 1 Happy-Path + 1 Edge-Case Test pro Funktion.

## Phase 4: Auto-Archive Suppression und "Einkauf beenden"

### Problem

Der aktuelle Trigger in `src/app/[locale]/page.tsx` (Zeile ~188) archiviert die Liste
automatisch, sobald `unchecked.length === 0 && checked.length > 0`. Mit Scan & Go
wuerde das mitten im Einkauf passieren -- nach dem letzten Listen-Item, bevor der
Nutzer Extras scannen kann.

### Was zu tun ist

1. **Auto-Archive Guard:**
   - Im `useEffect` in `page.tsx` (Zeile ~179-194): Wenn der Scan-Button sichtbar ist
     (= Scan & Go aktiv), die Auto-Archivierung unterdruecken
   - Der Scan-Button ist sichtbar wenn: (a) Items mit `is_extra_scan` existieren,
     oder (b) GPS erkennt Laden, oder (c) GPS ist deaktiviert
   - Vorerst (bis Phase 5): immer unterdruecken wenn `checked.some(i => i.is_extra_scan)`

2. **"Einkauf beenden"-Banner:**
   - Wenn alle regulaeren Items abgehakt sind UND Scan & Go aktiv:
     Banner anzeigen (nicht die automatische Archivierung)
   - Banner-Text: "Alle Artikel von der Liste im Wagen! Weiter scannen oder Einkauf beenden?"
   - Zwei Buttons: "Weiter scannen" (schliesst Banner) und "Einkauf beenden" (archiviert)
   - Banner-Position: oberhalb des Footers oder als Modal/Sheet

3. **"Einkauf beenden"-Aktion:**
   - Ruft `archiveListAsTrip()` auf (bestehendes `src/lib/list/archive-trip.ts`)
   - Extra-Items (`is_extra_scan = true`) muessen als `trip_items` eingeschlossen werden
   - Pruefen: Werden checked items mit `is_extra_scan = true` korrekt in `trip_items` uebernommen?
     (Die bestehende Logik in `archive-trip.ts` nimmt alle checked items -- das sollte passen,
      aber verifizieren.)

4. **Completion-Flow:**
   - Nach "Einkauf beenden": bestehender Completion-Screen (Konfetti, Zusammenfassung)
   - Extra-Items in der Zusammenfassung anzeigen (z.B. "7 Artikel, davon 3 extra gescannt")

### Schluesseldateien

- `src/app/[locale]/page.tsx` -- Auto-Archive `useEffect` (Zeile ~179-194), `handleLastItemChecked`
- `src/lib/list/archive-trip.ts` -- `archiveListAsTrip()` -- pruefen ob Extra-Items korrekt behandelt werden
- Neue Komponente: `src/components/list/scan-complete-banner.tsx` -- Banner-UI
- `src/messages/de.json` / `en.json` -- i18n-Strings fuer Banner

### Bestehender Auto-Archive Code (als Referenz)

In `page.tsx`:

```typescript
useEffect(() => {
  const uncheckedCount = stableListData.unchecked.length;
  const checkedCount = stableListData.checked.length;
  // ...
  const hadUnchecked = prevVal !== null && prevVal > 0;
  const nowAllChecked = uncheckedCount === 0 && checkedCount > 0;
  // ...
  if (hadUnchecked && nowAllChecked && listIdArg) {
    handleLastItemChecked(listIdArg, deferredIds);
  }
}, [...]);
```

Der Guard muss in die Bedingung `hadUnchecked && nowAllChecked` eingreifen.

### Akzeptanzkriterien

- [ ] Auto-Archivierung wird unterdrueckt wenn Scan & Go aktiv ist
- [ ] Banner erscheint stattdessen mit "Weiter scannen" / "Einkauf beenden"
- [ ] "Einkauf beenden" archiviert korrekt (inkl. Extra-Items als trip_items)
- [ ] "Weiter scannen" schliesst Banner, Nutzer kann weiter scannen
- [ ] Bestehender Completion-Screen funktioniert nach "Einkauf beenden"
- [ ] Ohne Scan & Go (keine Extra-Items, nicht im Laden): Auto-Archivierung funktioniert wie bisher
- [ ] i18n-Strings fuer DE und EN
- [ ] Tests: Guard-Logik, Banner-Anzeige, Archive mit Extra-Items
- [ ] TypeScript: `npx tsc --noEmit` fehlerfrei

### Nach Abschluss

Trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase 4" in specs/SCAN-AND-GO.md ein.
````

---

### Prompt: Phase 5 — GPS-basierte Scan-Button-Sichtbarkeit

<details>
<summary>Zusammenfassung Phase 5 (implementiert)</summary>

> **Status:** Abgeschlossen
>
> **Geaenderte Dateien:**
> - `src/hooks/use-scan-button-visible.ts` — Neuer Hook: pure Funktion mit 5 Parametern (gpsEnabled, isInStore, gpsError, hasCartItems, hasDefaultStore), gibt boolean zurueck
> - `src/hooks/use-store-detection.ts` — `StoreDetectionState` Interface um `gpsEnabled: boolean` und `gpsError: boolean` erweitert; neue State-Variablen in Hook-Logik gesetzt (gpsEnabled bei checkGpsAllowed, gpsError bei Retry-Exhaustion)
> - `src/app/[locale]/page.tsx` — `isInStore`, `gpsEnabled`, `gpsError` aus `useStoreDetection` destructured; `useScanButtonVisible` importiert und mit `hasDefaultStore` (store !== null) aufgerufen; `scanButtonVisible` als neues Prop an `ShoppingListContent` weitergereicht
> - `src/components/list/shopping-list-content.tsx` — `ShoppingListContentProps` um `scanButtonVisible: boolean` erweitert; `onScanPress` und `showCartColumn` an `DualPriceFooter` conditional weitergereicht
> - `src/components/list/dual-price-footer.tsx` — `DualPriceFooterProps` um `showCartColumn?: boolean` erweitert; Cart-Spalte + Divider + Scan-Button werden conditional gerendert; `animate-scan-fade-in` Klasse fuer sanften Uebergang
> - `src/styles/globals.css` — Neue Animation `@keyframes scan-fade-in` (0.3s ease-out, opacity + scale) fuer Footer-Elemente
>
> **Neue Dateien:**
> - `src/hooks/use-scan-button-visible.ts` — Pure Visibility-Hook (< 25 Zeilen)
> - `src/hooks/__tests__/use-scan-button-visible.test.ts` — 8 Unit-Tests mit exhaustiver Kombinationsabdeckung
>
> **Architektur-Entscheidungen:**
> - `useScanButtonVisible` als pure Funktion (kein React-Hook-State) — maximale Testbarkeit, kein Re-Render-Overhead, kann ohne renderHook getestet werden
> - GPS-State (`gpsEnabled`, `gpsError`) lebt in `useStoreDetection` statt in eigenem Hook — vermeidet doppelte checkGpsAllowed()-Aufrufe und haelt die GPS-Logik zentralisiert
> - `hasCartItems` wird mit `isScanAndGoActive` gleichgesetzt (checked.some(i => i.is_extra_scan)) — konsistent mit Phase 4 Auto-Archive-Guard
> - `hasDefaultStore` (store !== null) stellt sicher, dass der Scan-Button auch sichtbar ist, wenn ein Standardladen in den Einstellungen gewaehlt wurde — unabhaengig von GPS-Erkennung
> - Footer-Layout mit zwei Zustaenden: 1-Spalte (nur Listenpreis) vs. 3-Spalten (Listenpreis + Warenkorbpreis + Scan-Button), gesteuert ueber `showCartColumn` Prop
> - Cart-Spalte bleibt sichtbar wenn `scanButtonVisible || checked.length > 0` — Warenkorbpreis verschwindet nicht bei manuell abgehakten Items ohne GPS
> - Animation ueber CSS `@keyframes scan-fade-in` (opacity + scale) statt JS — performant, GPU-beschleunigt, kein Layout-Sprung
>
> **Offene Punkte / Tech Debt:**
> - `hasCartItems` basiert aktuell nur auf `is_extra_scan`-Items — regulaere Items, die per Scan abgehakt wurden (ohne Extras), loesen das "Option A: Laden verlassen" Verhalten nicht aus. Ein kuenftiges `scanned_at`-Feld auf `list_items` koennte das praeziser abbilden.
> - `gpsEnabled` wird beim Mount einmalig gesetzt (via checkGpsAllowed in useStoreDetection). Wenn der Nutzer GPS in den Settings deaktiviert waehrend die App laeuft, wird das erst beim naechsten Mount reflektiert.
>
> **Test-Ergebnisse:**
> - 10 neue Tests in `use-scan-button-visible.test.ts`, alle bestehen
> - Exhaustiver Kombinationstest bestaetigt: nur 1 von 32 moeglichen Kombinationen versteckt den Button (gpsEnabled=true, isInStore=false, gpsError=false, hasCartItems=false, hasDefaultStore=false)
> - Alle 1026 bestehenden Tests weiterhin gruen (96 Dateien)
> - `npx tsc --noEmit` fehlerfrei

</details>

````
Implementiere Phase 5 des Scan & Go Features (F43) fuer die ALDI Einkaufsliste.

## Kontext

Lies zuerst specs/SCAN-AND-GO.md -- die vollstaendige Feature-Spec.
Phase 1-4 sind bereits implementiert. Lies die Abschnitte "Zusammenfassung Phase 1/2/3/4"
in der Spec fuer den aktuellen Stand.

Das Projekt ist eine Next.js 14 PWA (App Router, TypeScript strict, Tailwind CSS, Supabase, Dexie.js).
Coding-Standards: max 300 Zeilen pro Datei, @/-Imports, keine leeren Catch-Bloecke.
Testing-Standards: Vitest, min. 1 Happy-Path + 1 Edge-Case Test pro Funktion.

## Phase 5: GPS-basierte Scan-Button-Sichtbarkeit

### Was zu tun ist

Aktuell (nach Phase 2) ist der Scan-Button immer sichtbar. Jetzt soll er nur
unter bestimmten Bedingungen erscheinen.

1. **Neuer Hook: `useScanButtonVisible()`**
   Datei: `src/hooks/use-scan-button-visible.ts`

   Logik:
   ```typescript
   function useScanButtonVisible(
     gpsEnabled: boolean,
     isInStore: boolean,
     gpsError: boolean,
     hasCartItems: boolean  // checked items mit is_extra_scan oder gescannte Items
   ): boolean {
     if (hasCartItems) return true;     // Einmal gescannt -> bleibt
     if (!gpsEnabled) return true;      // GPS aus -> immer zeigen
     if (gpsError) return true;         // GPS-Fehler -> Fallback
     if (isInStore) return true;        // Im Laden (< 200m)
     return false;                      // Zu Hause, plant nur
   }
   ```

2. **Integration in den Footer:**
   - `shopping-list-content.tsx` bekommt `scanButtonVisible` als Prop oder ueber Context
   - Scan-Button wird conditional gerendert
   - Warenkorbpreis-Spalte wird ebenfalls conditional (nur wenn Scan-Button sichtbar ODER checked items vorhanden)

3. **Option A -- Laden verlassen:**
   - Wenn Items im Wagen sind (`hasCartItems = true`), bleibt der Scan-Button sichtbar
   - Auch wenn GPS > 350m meldet (InStoreMonitor wuerde normalerweise `isInStore = false` setzen)
   - Erst nach "Einkauf beenden" (Phase 4) oder nach Session-Reset wird `hasCartItems` zurueckgesetzt

4. **Footer-Zustaende:**
   - Kein Scan & Go: `[Listenpreis]` (nur eine Spalte, volle Breite)
   - Scan & Go aktiv: `[Listenpreis | Warenkorbpreis | Scan-Button]` (drei Spalten)
   - Uebergang: animiert (z.B. Scan-Button faded ein)

### Schluesseldateien

- `src/hooks/use-store-detection.ts` -- liefert `isInStore`, wird bereits in `page.tsx` verwendet
- `src/hooks/use-scan-button-visible.ts` -- Neuer Hook (zu erstellen)
- `src/lib/geo/gps-permission.ts` -- `checkGpsAllowed()` fuer GPS-Status
- `src/components/list/shopping-list-content.tsx` -- Conditional Rendering des Scan-Buttons
- `src/app/[locale]/page.tsx` -- `useStoreDetection` Ergebnis an `ShoppingListContent` durchreichen

### Bestehende GPS-Infrastruktur (als Referenz)

In `use-store-detection.ts`:
- `isInStore: boolean` -- GPS-bestaetigt im Laden (< 200m)
- `detectedStoreName: string | null` -- Name des erkannten Ladens
- Polling alle 90s, Hysterese: Betreten < 200m, Verlassen > 350m

In `gps-permission.ts`:
- `checkGpsAllowed()` -- prueft App-Setting `gps_enabled` UND Browser-Permission
- Gibt `{ allowed: boolean, reason: string }` zurueck

### Akzeptanzkriterien

- [ ] Scan-Button versteckt wenn GPS aktiv und kein Laden in der Naehe
- [ ] Scan-Button sichtbar wenn GPS deaktiviert
- [ ] Scan-Button sichtbar wenn im Laden (< 200m)
- [ ] Scan-Button sichtbar bei GPS-Fehler (Fallback)
- [ ] Scan-Button bleibt sichtbar sobald Items gescannt wurden (Option A)
- [ ] Footer passt Layout an (1 Spalte vs. 3 Spalten) je nach Sichtbarkeit
- [ ] Uebergang ist visuell sanft (kein Layout-Sprung)
- [ ] Tests: useScanButtonVisible Hook mit allen Kombinationen
- [ ] TypeScript: `npx tsc --noEmit` fehlerfrei

### Nach Abschluss

Trage die Ergebnisse in den Abschnitt "Zusammenfassung Phase 5" in specs/SCAN-AND-GO.md ein.
Aktualisiere den Status am Anfang der Spec von "Planned" auf "Implemented".
````

---

*Last updated: 2026-03-14*
*See also: [FEATURES-CORE.md](FEATURES-CORE.md) (F08 Price Estimation), [FEATURES-PLANNED.md](FEATURES-PLANNED.md) (Feature Backlog)*
