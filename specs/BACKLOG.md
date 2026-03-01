# Code Quality Backlog

Generated: 2026-03-01 · Last full audit completed: 2026-03-01 (Rounds 6–9)

## Open Items

| ID | Severity | Category | Short description | Affected files | Notes |
|----|----------|----------|-------------------|----------------|-------|
| BL-59 | medium | security | `claudeRateLimit` steht auf 50 req/h (Testphase). Vor Public Release auf 5-10 req/h reduzieren (Zeile 22). Auch Anthropic API Budget-Limit ($50/Monat) in der Anthropic Console überprüfen. | `src/lib/api/rate-limit.ts` | Pre-Release Task |
| BL-60 | medium | data | Handzettel-Daten (flyers, flyer_pages) müssen nach ALDI-Datenimport neu eingelesen werden (PDF-Upload in Admin-Area). Alte Flyer-Produkt-Verknüpfungen sind durch den Clean-Slate-Import verloren gegangen. | `supabase/imports/` | Manueller Task |
| BL-61 | medium | tech-debt | Server-seitige Barcode-Erkennung: ZXing durch ZBar WASM ersetzen. ZXing erkennt Barcodes unzuverlässig. Client-seitig wird bereits ZBar WASM genutzt – Vereinheitlichung auf eine Library reduziert Abhängigkeiten und verbessert die Erkennungsrate. | `src/lib/barcode-from-image.ts`, `package.json` | Dependency `@zxing/library` danach entfernen |

## Completed Backlog

See `specs/archive/BACKLOG-2026-03-01-round6-9.md` for the full history of 40+ resolved items from Rounds 1–9.
