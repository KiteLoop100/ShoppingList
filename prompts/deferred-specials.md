# Prompt: Deferred Section (Specials + Auto-Reorder)

Die vollständige Spezifikation steht in `specs/FEATURES-CORE.md` unter **F03 → "Deferred Section (Upcoming Items)"**.

## Zusammenfassung

Die Einkaufsliste hat eine **Deferred Section** zwischen aktiven und abgehakten Produkten. Sie enthält:

1. **Deferred Specials:** Aktionsartikel aus dem Flyer, deren `special_start_date` in der Zukunft liegt. Aktivierung **zwei Werktage** (Mo–Sa, Sonntag zählt nicht) vor dem Verkaufsstart um **12:00** Landeszeit (`src/lib/list/special-activation.ts`).
2. **Auto-Reorder:** Produkte mit konfiguriertem Nachkauf-Intervall, die nach dem Abhaken automatisch nach X Tagen/Wochen/Monaten wieder erscheinen.

Beide Typen teilen sich die gleiche visuelle Darstellung (abgedunkelt, nicht abhakbar, nach Datum gruppiert) mit einem Badge zur Unterscheidung: "(Aktion)" bzw. "(Nachkauf)".

## Implementierte Dateien

- `src/lib/list/special-activation.ts` – Kalenderdatum + UTC-Zeitpunkt für Aktivierung von Aktionsartikeln
- `supabase/migrations/20260224000000_auto_reorder_settings.sql` – Neue Tabelle
- `src/lib/list/list-helpers.ts` – `deferred_reason` auf `ListItemWithMeta`
- `src/components/list/use-list-data.ts` – Lade-Logik, Deferred-Berechnung, Timer, Check-off Handler
- `src/components/list/list-item-row.tsx` – Reason Badges
- `src/components/list/product-detail-modal.tsx` – Auto-Reorder Toggle + Intervall-Picker
- `src/components/list/shopping-list-content.tsx` – Deferred-Sektion mit Datums-Clustering
- `src/messages/de.json` + `en.json` – Übersetzungen

## Wichtige Details

- **Keine manuelle Überschreibung** – Deferred-Status ist automatisch
- **Zeitzone:** Basiert auf `product.country` (DE → `Europe/Berlin`, AT → `Europe/Vienna`)
- **Duplikat-Vermeidung:** Auto-Reorder prüft ob Produkt bereits auf der Liste ist
- **Check-off aktualisiert `last_checked_at`** in `auto_reorder_settings`
- **Produkte ohne `special_start_date`** sind sofort aktiv (nicht deferred)
- **`daily_range` Produkte** sind NIE als Special deferred
