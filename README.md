# Digital Shopping List (ALDI Einkaufsliste)

Next.js PWA für eine intelligente Einkaufsliste mit ladenspezifischer Gang-Sortierung, KI-gestützter Produkterkennung und Multi-Retailer-Unterstützung.
Specs: siehe Ordner `specs/` (ARCHITECTURE.md, MVP.md, DATA-MODEL.md).

## Tech-Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Supabase** – Auth (Anonymous-First + Email), PostgreSQL, Storage, Realtime
- **Dexie.js** – IndexedDB (Offline-Cache für Produkte, Stores, Sortierung)
- **Gemini AI** (`@google/genai`) – Produktfotos, Kassenbons, Handzettel-Verarbeitung
- **next-intl** – i18n (DE/EN)
- **next-pwa** – Service Worker, installierbare PWA
- **Zod** – API-Eingabevalidierung
- **Upstash Redis** – API Rate-Limiting
- **sharp** – Bildverarbeitung (Thumbnails, Rotation)

## Setup

```bash
# Dependencies
npm install

# Umgebungsvariablen
cp .env.example .env.local
# .env.local mit Supabase, Gemini, Upstash etc. füllen (siehe .env.example)
```

## Datenbank (Supabase)

Schema anwenden:

1. Supabase-Projekt anlegen (supabase.com).
2. SQL aus `supabase/migrations/20250216000000_initial_schema.sql` im Supabase SQL Editor ausführen (oder `supabase db push`, falls Supabase CLI genutzt wird).

Anonyme Auth in Supabase aktivieren (Anonymous-First-Modell).

### Storage (F13: Fotos & PDF-Handzettel)

- Bucket **product-photos** anlegen (Dashboard: Storage → New bucket), öffentlich.
- **PDF erlauben:** Storage → product-photos → Einstellungen → **Allowed MIME types** leer lassen oder u. a. `application/pdf` eintragen.
- **Große PDFs (bis 100 MB):** Migration `20250223000000_product_photos_100mb_limit.sql` setzt das Bucket-Limit auf 100 MB. **Free Plan:** Supabase erlaubt global nur 50 MB pro Datei – für 100 MB ist Pro/Team nötig; dann in Project Settings → Storage das globale Limit prüfen.

## Entwicklung

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000).
Deutsche Startseite: `/`, englisch: `/en`.

## Projektstruktur (Auszug)

```
src/
  app/
    [locale]/              # next-intl: de, en
      page.tsx             # Startseite (Suche + Einkaufsliste)
      list/page.tsx        # Einkaufsliste (Vollansicht)
      catalog/page.tsx     # Produktkatalog (visuelles Browsen)
      capture/page.tsx     # Kassenbons scannen
      flyer/page.tsx       # Handzettel-Browser
      receipts/page.tsx    # Kassenbon-Verlauf
      feedback/page.tsx    # Kundenfeedback
      settings/page.tsx    # Einstellungen
      login/page.tsx       # Login / Registrierung
      privacy/page.tsx     # Datenschutzerklärung
      admin/page.tsx       # Admin (Produktverwaltung)
    api/                   # 17 Serverless Functions (siehe ARCHITECTURE.md §6.1)
  components/
    search/                # Suchfeld, Ergebnisse, Panels
    list/                  # Einkaufsliste, Produktdetails, Swipe-Aktionen
    catalog/               # Produktkatalog (Grid, Tiles, Navigation)
    product-capture/       # Produkterfassung (Fotos, Formular)
    store/                 # Store-Dialog
    feedback/              # Feedback-Formulare
    onboarding/            # Onboarding-Screens (7 Schritte)
    layout/                # App-Shell, Navigation
    common/                # Buttons, Icons, UI-Bausteine
    ui/                    # Basis-Komponenten
  lib/
    search/                # Such-Pipeline (4 Stufen, < 50ms lokal)
    list/                  # Liste: CRUD, Archiv, Pairwise, Auto-Reorder
    store/                 # Store-Erkennung, Hierarchische Sortierung
    products/              # Produkt-Normalisierung, Duplikat-Erkennung
    categories/            # Demand-Group-Service, Farben
    api/photo-processing/  # Gemini/AI Bild-Pipeline
    product-photo-studio/  # Hintergrundentfernung, Thumbnail-Erzeugung
    auth/                  # Auth-Context, Anonymous-First
    receipts/              # Kassenbon-Parsing, Merge
    flyers/                # Handzettel-Service
    competitor-products/   # Fremdprodukte (Buy Elsewhere)
    retailers/             # Retailer-Registry (DACH + NZ)
    supabase/              # Supabase Client (Browser + Server)
    db/                    # Dexie.js IndexedDB (lokaler Cache)
    i18n/                  # next-intl Konfiguration
    settings/              # Einstellungen-Sync (Supabase + localStorage)
    sync/                  # Sync-Modul (Delta-Sync für Produkte)
    sorting/               # Sortier-Modul (siehe lib/store/)
    utils/                 # Logger, Formatierung, ID-Generierung
  messages/                # de.json, en.json
  types/                   # TypeScript-Typen (Supabase-generiert)
  styles/                  # Tailwind, globals.css
```

## PWA

PWA-Plugin (next-pwa) ist aktiv und erzeugt Service Worker + Manifest beim Build. In der Entwicklung ist der SW deaktiviert. Runtime-Caching für Supabase-API und statische Assets konfiguriert in `next.config.js`.

## Fehler: „Could not find the module … app-router.js#" (React Client Manifest)

**Ursache:** Der Projektpfad enthält ein **`#`** (z. B. Ordner `#Peter`). Webpack/Next.js interpretiert `#` als Fragment und zerschneidet Pfade – dadurch entsteht dieser Fehler.

**Lösung (eine davon):**

1. **Ordner umbenennen (empfohlen)**
   Den übergeordneten Ordner so umbenennen, dass **kein `#`** im Pfad vorkommt, z. B.:
   - `#Peter` → `Peter` oder `_Peter`
   - Neuer Pfad z. B.:
     `…\Dropbox\OH, PMH\Peter\Arduino, IT\DigitalShoppingList`

2. **Projekt an einen Pfad ohne `#` kopieren/verschieben**
   Projekt z. B. nach `C:\Dev\DigitalShoppingList` klonen oder kopieren und von dort aus `npm install` und `npm run dev` ausführen.

3. **Junction unter einem Pfad ohne `#` (Windows)**
   Als Administrator in CMD ausführen (ersetze den zweiten Pfad durch deinen echten Projektpfad):
   ```cmd
   mklink /J "C:\Dev\DigitalShoppingList" "C:\Users\Peter\Dropbox\OH, PMH\#Peter\Arduino, IT\DigitalShoppingList"
   cd /d C:\Dev\DigitalShoppingList
   npm run dev
   ```
   Ob der Fehler damit weggeht, hängt davon ab, ob Next.js den Junction-Pfad oder den Zielpfad nutzt – einen Versuch wert.

Nach einer Änderung am Pfad ggf. **Cache löschen**:
`npx rimraf .next` und danach erneut `npm run dev`.
