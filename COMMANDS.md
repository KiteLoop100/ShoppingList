# Terminal-Befehle – ALDI Einkaufsliste

Alle Befehle werden im Projektordner ausgeführt (dort wo `package.json` liegt).

---

## Entwicklung

```bash
# Dev-Server starten (erreichbar im LAN über IP:3000)
npm run dev

# Produktions-Build lokal testen
npm run build
npm run start

# TypeScript-Fehler prüfen (vor jedem Deployment!)
npx tsc --noEmit

# Linter
npm run lint

# Code formatieren
npm run format
```

---

## Tests

```bash
# Alle Tests einmalig ausführen
npx vitest run

# Einen bestimmten Testordner ausführen
npx vitest run src/lib/search
npx vitest run scripts/lib

# Tests im Watch-Modus (bei Dateiänderungen automatisch neu)
npx vitest

# Tests mit UI im Browser
npx vitest --ui
```

---

## Deployment (Vercel)

```bash
# Vor dem Push: TypeScript prüfen
npx tsc --noEmit

# Zu Git hinzufügen und pushen (löst Vercel-Deployment aus)
git add .
git commit -m "Beschreibung der Änderung"
git push

# Vercel CLI (falls installiert): manuell deployen
npx vercel --prod
```

> **Hinweis:** Vercel deployed automatisch bei jedem Push auf `main`.
> Ein fehlgeschlagener Build durch TypeScript-Fehler wird so vermieden:
> immer zuerst `npx tsc --noEmit` ausführen.

---

## Supabase Datenbank

```bash
# Neue Migration anwenden (lokale Supabase-Instanz)
npx supabase db push

# TypeScript-Typen aus Supabase-Schema neu generieren
npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/supabase/database.types.ts

# Supabase Studio lokal öffnen
npx supabase studio
```

---

## Handzettel (Flyer) importieren

PDFs zuerst in den richtigen Ordner legen:
- `flyers/DE/` → ALDI SÜD (Deutschland)
- `flyers/AT/` → Hofer (Österreich)

```bash
# Nur neue PDFs verarbeiten (Standard-Workflow)
npx tsx scripts/batch-process-flyers.ts --country DE
npx tsx scripts/batch-process-flyers.ts --country AT

# Vor dem echten Import testen (kein DB-Schreiben)
npx tsx scripts/batch-process-flyers.ts --country DE --dry-run
npx tsx scripts/batch-process-flyers.ts --country AT --dry-run

# Nur die erste PDF verarbeiten (schneller Test)
npx tsx scripts/batch-process-flyers.ts --country DE --limit 1

# Alle PDFs erneut verarbeiten (auch bereits importierte)
npx tsx scripts/batch-process-flyers.ts --country DE --force
npx tsx scripts/batch-process-flyers.ts --country AT --force

# Alle bestehenden Handzettel löschen und neu importieren
npx tsx scripts/batch-process-flyers.ts --country DE --delete-existing
npx tsx scripts/batch-process-flyers.ts --country AT --delete-existing

# Langsamere Verarbeitung (weniger API-Druck, Standard: 5000ms)
npx tsx scripts/batch-process-flyers.ts --country DE --delay 8000
```

> **Tracking:** Bereits verarbeitete PDFs werden in `flyers/{country}/.processed.json` gespeichert.
> Das Script überspringt sie beim nächsten Aufruf automatisch.

---

## Produktfotos importieren

Fotos in `photos/DE/` oder `photos/AT/` ablegen (`.jpg`, `.jpeg`, `.png`, `.webp`):

```bash
# Alle neuen Fotos verarbeiten
npx tsx scripts/batch-process-photos.ts --country DE
npx tsx scripts/batch-process-photos.ts --country AT

# Trockenauf (ohne DB-Schreiben)
npx tsx scripts/batch-process-photos.ts --country DE --dry-run

# Limit + parallele Verarbeitung
npx tsx scripts/batch-process-photos.ts --country DE --limit 5 --concurrency 2

# Ohne Thumbnail-Generierung
npx tsx scripts/batch-process-photos.ts --country DE --skip-thumbnails
```

---

## Filialen importieren

```bash
# ALDI SÜD Filialen (DE) aus OpenStreetMap importieren
npm run import-stores-DE

# Hofer Filialen (AT) aus OpenStreetMap importieren
npm run import-stores-AT
```

---

## Sonstige Scripts

```bash
# Testprodukte importieren (Entwicklungsumgebung)
npm run import-test-products

# Store-Layout für München Richard-Strauss-Str. setzen
npm run set-store-layout-munich-richard-strauss

# PWA-Icons neu generieren
npx tsx scripts/generate-pwa-icons.ts

# Bestehende Handzettelseiten über lokalen Dev-Server neu verarbeiten
# (Dev-Server muss laufen, Flyer-IDs in der Datei anpassen!)
node scripts/reprocess-all-flyers.mjs
```

---

## Voraussetzungen (`.env.local`)

Alle Scripts benötigen diese Variablen:

```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...          # Claude (Flyer- und Foto-Analyse)
GOOGLE_GEMINI_API_KEY=...      # Gemini (Bounding-Box-Erkennung)
```
