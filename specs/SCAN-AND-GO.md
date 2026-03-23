# SCAN-AND-GO.md — Scan & Go (F43)

> **Status:** Implemented (Phase 1–5 complete)
> **Feature-ID:** F43

---

## Overview

Scan & Go verschmilzt die bestehende Einkaufsliste mit einer Warenkorb-Funktion. Kunden scannen Produkte beim Einlegen in den physischen Wagen — das Produkt wird in der App abgehakt und einem digitalen Warenkorb zugeordnet. **Kein separater Warenkorb-Screen.** Die "Abgehakt"-Sektion wird zum "Im Wagen"-Bereich, ein Sticky Footer zeigt Listenpreis und Warenkorbpreis.

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

---

## Data Model

`list_items.is_extra_scan` (BOOLEAN, default false) — unterscheidet Listen-Items von spontan gescannten Extras.

**Remove-Logik:**
- `is_extra_scan = false`: Uncheck → zurück nach "Noch zu holen"
- `is_extra_scan = true`: Item komplett löschen

---

## Scan-to-Cart Flow

```
Scan-Button (Footer) → Kamera → EAN erkannt
  → Lookup: ALDI-Produkte → Wettbewerber → Open Food Facts
    → Match auf aktiver Liste? JA: Check off. NEIN: Neues Item (is_extra_scan = true)
    → Nicht gefunden: ProductCaptureModal (mit "Überspringen"-Option)
  → Duplicate Scan: Menge +1
  → Audio-Piepton (Web Audio API) + Vibration (50ms)
```

---

## Sticky Footer

Drei Zustände basierend auf Kontext:

| Zustand | Anzeige |
|---------|---------|
| Zu Hause | 📋 Listenpreis |
| Im Laden, nichts gescannt | 📋 Listenpreis + 🛒 — + [📷] |
| Im Laden, Items gescannt | 📋 Listenpreis + 🛒 Warenkorbpreis + [📷] |

**Preise:** Listenpreis = alle Items (mit ~Tilde). Warenkorbpreis = nur checked Items (exakter).

---

## Scan Button Visibility

```
GPS deaktiviert?              → IMMER sichtbar
GPS aktiv + Store in Nähe?    → SICHTBAR
GPS aktiv + kein Store?       → VERSTECKT
GPS-Fehler?                   → SICHTBAR (Fallback)
Mindestens 1 Item gescannt?   → SICHTBAR (überschreibt alle)
```

Implementation: `useScanButtonVisible()` hook.

---

## Auto-Archive Suppression

Wenn Scan & Go aktiv (`checked` enthält `is_extra_scan`-Items), wird Auto-Archivierung unterdrückt. Stattdessen Banner: "Alle Artikel im Wagen — Weiter scannen oder Einkauf beenden?"

---

## Cart Management

Tap auf abgehaktes Item → Inline-Controls erscheinen:

```
┌──────────────────────────────────────────┐
│  ✓  Eier                                │
│  [🗑]   [−]   2   [+]          4,38 €  │
└──────────────────────────────────────────┘
```

**Remove-Logik:**
- `[🗑]` oder `[−]` bei Menge 1: `is_extra_scan=false` → uncheck (zurück zu "Noch zu holen"). `is_extra_scan=true` → Item komplett löschen.
- `[−]` bei Menge > 1: Menge −1, Preis anpassen.
- `[+]`: Menge +1, Preis anpassen.

---

## View Mode Compatibility

"Noch zu holen" folgt dem gewählten Ansichtsmodus. "Im Wagen" ist **immer** flach und chronologisch (neueste zuerst).

---

## Offline Behavior

Barcode-Scanner, Produkt-Lookup (IndexedDB), Preis und Check-off funktionieren offline. EAN-Lookup bei Open Food Facts benötigt Netzwerk.

---

## Key Implementation Files

| Bereich | Dateien |
|---------|---------|
| Cart-Logik | `src/lib/cart/scan-to-cart.ts`, `src/lib/cart/__tests__/` |
| Scanner-Hook | `src/components/list/hooks/use-cart-scanner.ts` |
| Footer | `src/components/list/dual-price-footer.tsx` |
| Visibility | `useScanButtonVisible()` in `src/app/[locale]/page.tsx` |
| Banner | `src/components/list/scan-complete-banner.tsx` |
| Badges | `src/components/list/item-badges.tsx` (Extra-Scan-Markierung) |

---

*Last updated: 2026-03-22*
*See also: [FEATURES-CORE.md](FEATURES-CORE.md) (core features), [FEATURES-PLANNED.md](FEATURES-PLANNED.md) (planned features)*
