# Code Quality & Tech-Debt Backlog

Last updated: 2026-03-22

> Technical debt, security, and architecture items only. For feature requests see [FEATURES-PLANNED.md](FEATURES-PLANNED.md).

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-66 | low | tech-debt | **Reverse Geocoding Rate-Limiting.** `reverseGeocode()` in `store-service.ts` nutzt die kostenlose OpenStreetMap Nominatim API (max 1 req/s). Für Produktionsbetrieb Caching oder einen bezahlten Geocoding-Dienst einsetzen. | `src/lib/store/store-service.ts` | Relevant bei hoher Nutzerzahl |
| BL-73 | medium | architecture | **F16 Shared Lists: `display_name`-Snapshot-Problem mitdenken.** Write-Through-Fix für Einzel-Nutzer existiert (2026-03-09). Bei geteilten Listen muss das Muster auf mehrere Nutzer ausgeweitet werden. Robusteste Option: Supabase-Trigger (`AFTER UPDATE ON products → UPDATE list_items`). | `supabase/migrations/`, `src/app/api/products/create-manual/route.ts` | Vor F16-Implementierung entscheiden. |

## Responsive Desktop & Tablet (F28) — Complete

*No open items — F28 is complete.* See completed RESP-items in [archive/BACKLOG-F28-RESP.md](archive/BACKLOG-F28-RESP.md).

## Completed Backlog

| ID | Category | Resolution |
|----|----------|------------|
| BL-60 | data | Flyer-Daten aktuell, Handzettel nach ALDI-Import neu eingelesen. |
| BL-61 | tech-debt | ZXing durch ZBar WASM ersetzt. |
| BL-62 | architecture | Demand-Groups Migration vollständig abgeschlossen (Phase 1–4). |
| BL-63 | data-quality | Produktkategorie-Datenbereinigung abgeschlossen. |
| BL-64 | architecture | Einheitliches Produkterfassungs-Modul (`ProductCaptureModal`). |
| BL-69 | feature | PWA App Shortcuts implementiert. |
| BL-70 | feature | Produktfotos in der Einkaufsliste. |
| BL-71 | feature | Einkaufsnotizen pro Trip. |
| BL-72 | feature | Retailer Memory. |
| BL-74 | tech-debt | i18n Namespace-Konsolidierung (`competitorDetail` → `productDetail`). |

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
