# Produkt-Fotos für Batch-Import

Lege Fotos in den jeweiligen Länder-Ordner:

- **`DE/`** – Fotos aus deutschen ALDI SÜD Filialen
- **`AT/`** – Fotos aus österreichischen Hofer Filialen

## Unterstützte Formate

`.jpg`, `.jpeg`, `.png`, `.webp`

## Verwendung

```bash
# Erst testen (Dry Run – nur Erkennung, kein DB-Schreiben):
npx tsx scripts/batch-process-photos.ts --country AT --limit 3 --dry-run

# Wenige Fotos verarbeiten und in DB schreiben:
npx tsx scripts/batch-process-photos.ts --country AT --limit 5

# Alle Fotos verarbeiten:
npx tsx scripts/batch-process-photos.ts --country AT

# Deutsche Fotos:
npx tsx scripts/batch-process-photos.ts --country DE
```

## Optionen

| Option | Beschreibung |
|--------|-------------|
| `--country DE\|AT` | Pflicht: Welcher Ordner verarbeitet wird |
| `--limit N` | Nur die ersten N Fotos verarbeiten |
| `--dry-run` | Nur Erkennung, nichts in DB schreiben |
| `--concurrency N` | Parallele Claude-Aufrufe (Standard: 3) |
| `--skip-thumbnails` | Keine Thumbnails generieren |

## Foto-Typen

Das Script erkennt automatisch:

- **Regalfotos** (shelf) – Digitale Preisschilder → mehrere Produkte pro Foto
- **Produktfotos** (product_front) – Einzelnes Produkt von vorne
- **Preisschilder** (price_tag) – Nahaufnahme eines digitalen Preisschilds
- **Rückseite** (product_back) – Barcode/Nährwerte

## Ergebnisse

Nach dem Lauf wird eine `batch-results-XX-YYYY-MM-DD.json` erstellt mit allen extrahierten Daten.
