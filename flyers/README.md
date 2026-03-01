# Handzettel (Flyer) für automatischen Import

Kopiere PDF-Handzettel in den jeweiligen Länder-Ordner:

- **`DE/`** – ALDI SÜD Handzettel (Deutschland)
- **`AT/`** – Hofer Handzettel (Österreich)

Die Software erkennt automatisch anhand des Logos, ob es ein ALDI- oder Hofer-Handzettel ist. Die Ordner-Trennung dient der Übersichtlichkeit.

## Unterstützte Formate

`.pdf`

## Verarbeitung

Handzettel werden über das Batch-Script verarbeitet:

```bash
npx tsx scripts/batch-process-flyers.ts --country AT
npx tsx scripts/batch-process-flyers.ts --country DE
```
