# Digital Shopping List (ALDI Einkaufsliste)

Next.js PWA für eine intelligente Einkaufsliste mit ladenspezifischer Gang-Sortierung.  
Specs: siehe Ordner `specs/` (ARCHITECTURE.md, MVP.md, DATA-MODEL.md).

## Tech-Stack

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Dexie.js** – IndexedDB (Offline-First)
- **next-intl** – i18n (DE/EN)
- **Supabase** – Auth, PostgreSQL, REST

## Setup

```bash
# Dependencies
npm install

# Umgebungsvariablen (Supabase)
cp .env.example .env.local
# .env.local mit NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY füllen
```

## Datenbank (Supabase)

Schema anwenden:

1. Supabase-Projekt anlegen (supabase.com).
2. SQL aus `supabase/migrations/20250216000000_initial_schema.sql` im Supabase SQL Editor ausführen (oder `supabase db push`, falls Supabase CLI genutzt wird).

Anonyme Auth in Supabase aktivieren, wenn du Anonymous-First nutzen willst (MVP).

### Storage (F13: Fotos & PDF-Handzettel)

- Bucket **product-photos** anlegen (Dashboard: Storage → New bucket), öffentlich.
- Damit **PDF-Upload** (Handzettel) funktioniert: Storage → product-photos → Einstellungen → **Allowed MIME types** entweder leer lassen oder u. a. `application/pdf` ergänzen. Ohne PDF erlauben Uploads den Fehler „new row violates row-level security policy“ bzw. „File type not allowed“.

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
    [locale]/           # next-intl: de, en
      page.tsx           # Startseite (S1)
      list/page.tsx      # Liste (S2)
      settings/page.tsx  # Einstellungen (S4)
      admin/page.tsx     # Admin (S5)
  components/           # UI (search, list, store-picker, common)
  lib/
    db/                 # Dexie.js IndexedDB
    supabase/            # Supabase Client (browser + server)
    i18n/                # next-intl Konfiguration
    search/              # Such-Modul (noch nicht implementiert)
    sorting/             # Sortier-Modul (noch nicht implementiert)
    sync/                # Sync-Modul (noch nicht implementiert)
  messages/             # de.json, en.json
  types/                 # TypeScript-Typen (DATA-MODEL)
  styles/                # Tailwind, globals.css
```

## PWA

PWA-Plugin (next-pwa) ist in `next.config.js` vorbereitet, aber auskommentiert. Zum Aktivieren Zeilen auskommentieren und `next-pwa` beim Build nutzen.

## Fehler: „Could not find the module … app-router.js#“ (React Client Manifest)

**Ursache:** Der Projektpfad enthält ein **`#`** (z. B. Ordner `#Peter`). Webpack/Next.js interpretiert `#` als Fragment und zerschneidet Pfade – dadurch entsteht dieser Fehler.

**Lösung (eine davon):**

1. **Ordner umbenennen (empfohlen)**  
   Den übergeordneten Ordner so umbenennen, dass **kein `#`** im Pfad vorkommt, z. B.:
   - `#Peter` → `Peter` oder `_Peter`
   - Neuer Pfad z. B.:  
     `…\Dropbox\OH, PMH\Peter\Arduino, IT\DigitalShoppingList`

2. **Projekt an einen Pfad ohne `#` kopieren/verschieben**  
   Projekt z. B. nach `C:\Dev\DigitalShoppingList` klonen oder kopieren und von dort aus `npm install` und `npm run dev` ausführen.

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

---

## Nächste Schritte

- Supabase Auth (Anonymous Sign-In) einbinden
- Features gemäß MVP.md und FEATURES.md implementieren
- Dexie nur in Client Components oder clientseitig nutzen (IndexedDB ist browser-only)
