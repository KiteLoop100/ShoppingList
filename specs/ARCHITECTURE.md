# ARCHITECTURE.md – Technische Architektur

> Dieses Dokument richtet sich primär an den AI-Agenten (Cursor) und beschreibt die technischen Leitplanken.
> Es wird vom Produktinhaber gemeinsam mit der AI erarbeitet.
> Für die fachliche Logik siehe die anderen Spec-Dateien.

---

## 1. Architekturprinzipien

| Prinzip | Beschreibung |
|---------|-------------|
| **Modular** | Jede Komponente (Suche, Sortierung, Sync, Datenbank) hat eine klare Schnittstelle und kann unabhängig ersetzt werden |
| **Offline-First** | Die App funktioniert primär mit lokalen Daten. Cloud ist Backup und Sync, nicht Voraussetzung |
| **API-First** | Backend bietet eine saubere REST- oder GraphQL-API. Frontend und Backend sind strikt getrennt |
| **Selbstlernend** | Algorithmen verbessern sich automatisch mit Nutzungsdaten. Minimaler manueller Eingriff |
| **Skalierbar** | Architektur soll von 1 Nutzer bis mehrere tausend Nutzer funktionieren, ohne grundlegend umgebaut zu werden |
| **Einfach starten** | Managed Services bevorzugen. Kein eigener Server, kein DevOps-Aufwand |

---

## 2. Technologie-Stack

### 2.1 Frontend

| Technologie | Rolle | Begründung |
|-------------|-------|-----------|
| **Next.js** | Web-Framework | Riesige AI-Trainingsdaten → AI kann diesen Code am besten generieren. SSR + Static Generation. Große Community |
| **React** | UI-Bibliothek | Komponentenbasiert, ideal für modulare UI. Teil von Next.js |
| **Tailwind CSS** | Styling | Utility-first, AI kann damit präzise Designs umsetzen. Kein separates CSS nötig |
| **PWA (Progressive Web App)** | App-Format | Installierbar auf Smartphone, Offline-fähig via Service Worker, kein App Store nötig |
| **next-pwa** | PWA-Plugin | Einfache PWA-Integration in Next.js (Service Worker, Manifest) |
| **Workbox** | Offline/Caching | Google-Bibliothek für Service Worker und Cache-Strategien. Wird von next-pwa verwendet |
| **IndexedDB (via Dexie.js)** | Lokaler Speicher | Strukturierter lokaler Speicher im Browser. Dexie.js als einfachere API über IndexedDB |
| **next-intl** | Internationalisierung | i18n-Bibliothek für Next.js. Unterstützt Routing, Formatierung, Sprachdateien |

### 2.2 Backend

| Technologie | Rolle | Begründung |
|-------------|-------|-----------|
| **Supabase** | Backend-as-a-Service | PostgreSQL-Datenbank + Auth + Realtime-Sync + REST-API + Edge Functions. Alles in einem, kostenloser Start, kein eigener Server |
| **Supabase Auth** | Authentifizierung | Anonyme Auth (für Anonymous-First-Modell) + E-Mail/Passwort (für spätere Registrierung). Eingebaut in Supabase |
| **Supabase Realtime** | Echtzeit-Sync | Für späteres Familien-Feature. Bereits im Stack, muss im MVP noch nicht aktiv sein |
| **Supabase Edge Functions** | Serverlose Logik | Für Algorithmen, die nicht im Frontend laufen sollen (z.B. Gangfolge-Berechnung, Aggregation). Deno-basiert |
| **PostgreSQL** | Datenbank | Relationale Datenbank mit JSON-Support. Robust, bewährt, Teil von Supabase |

### 2.3 Hosting & Deployment

| Technologie | Rolle | Begründung |
|-------------|-------|-----------|
| **Vercel** | Hosting | Optimiert für Next.js. Automatisches Deployment bei Git-Push. Kostenloser Start. CDN weltweit |
| **GitHub** | Versionskontrolle | Code-Repository. GitHub Desktop als GUI für den Produktinhaber |
| **GitHub Actions** | CI/CD | Automatische Tests und Deployments (später, wenn nötig) |

### 2.4 Spätere Erweiterungen

| Technologie | Rolle | Wann |
|-------------|-------|------|
| **Capacitor** | Native App Wrapper | Phase 4 – verpackt die PWA als iOS/Android App |
| **Elasticsearch / Algolia** | Externe Suche | Wenn die eingebaute Suche nicht ausreicht |
| **Redis** | Caching-Layer | Wenn Performance bei vielen Nutzern zum Problem wird |
| **PostHog / Plausible** | Analytics | Wenn Nutzungsanalysen benötigt werden |

---

## 3. System-Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    NUTZER-GERÄT                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Next.js PWA (Frontend)                 │ │
│  │                                                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │ │
│  │  │ UI Layer │ │ Search   │ │ Sort Engine        │ │ │
│  │  │ (React + │ │ Module   │ │ (Gangfolge-        │ │ │
│  │  │ Tailwind)│ │          │ │  Berechnung)       │ │ │
│  │  └──────────┘ └──────────┘ └────────────────────┘ │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │         Offline-Layer                         │  │ │
│  │  │  ┌─────────────┐  ┌───────────────────────┐ │  │ │
│  │  │  │ IndexedDB   │  │ Service Worker        │ │  │ │
│  │  │  │ (Dexie.js)  │  │ (Workbox)             │ │  │ │
│  │  │  │             │  │                        │ │  │ │
│  │  │  │ • Liste     │  │ • App-Cache            │ │  │ │
│  │  │  │ • Produkte  │  │ • API-Response-Cache   │ │  │ │
│  │  │  │ • Gangfolge │  │ • Offline-Queue        │ │  │ │
│  │  │  │ • Läden     │  │                        │ │  │ │
│  │  │  └─────────────┘  └───────────────────────┘ │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  │                                                     │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │         Sync-Layer                            │  │ │
│  │  │  • Bidirektionale Synchronisation            │  │ │
│  │  │  • Offline-Queue-Verarbeitung                │  │ │
│  │  │  • Konfliktauflösung (Last-Write-Wins)       │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │ HTTPS / REST API
                           │ (online wenn verfügbar)
                           │
┌──────────────────────────┼───────────────────────────────┐
│                    SUPABASE (Cloud)                       │
│                          │                               │
│  ┌───────────────────────┼────────────────────────────┐ │
│  │              REST API / PostgREST                   │ │
│  └───────────────────────┼────────────────────────────┘ │
│                          │                               │
│  ┌────────────┐  ┌──────┴───────┐  ┌─────────────────┐ │
│  │ Auth       │  │ PostgreSQL   │  │ Edge Functions   │ │
│  │            │  │              │  │                  │ │
│  │ • Anonym   │  │ • Users      │  │ • Gangfolge-     │ │
│  │ • E-Mail   │  │ • Products   │  │   Aggregation    │ │
│  │            │  │ • Lists      │  │ • Sequenz-       │ │
│  │            │  │ • Stores     │  │   Validierung    │ │
│  │            │  │ • Trips      │  │ • Kategorie-     │ │
│  │            │  │ • AisleOrder │  │   Zuordnung      │ │
│  │            │  │ • Sequences  │  │ • Duplikat-      │ │
│  │            │  │ • Errors     │  │   Erkennung      │ │
│  └────────────┘  └──────────────┘  └─────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Realtime (für späteres Familien-Sync) │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Modulare Architektur – Schnittstellen

Jede Kernkomponente hat eine klare Schnittstelle, damit sie unabhängig ausgetauscht werden kann.

### 4.1 Such-Modul

```
Interface: SearchModule
  Input:  query (string), user_id (string), limit (number)
  Output: SearchResult[] = { product_id, name, category, price, score, source }

MVP-Implementierung: Lokale Fuzzy-Suche über IndexedDB (Dexie.js)
Spätere Option:      Elasticsearch, Algolia, oder eigener Suchservice via API
```

### 4.2 Sortier-Modul (Gang-Sortierung)

```
Interface: SortModule
  Input:  items (ListItem[]), store_id (string | null)
  Output: SortedListItem[] = items mit berechneter sort_position

MVP-Implementierung: Lokale Berechnung basierend auf gecachten AisleOrder-Daten
Spätere Option:      Serverseitige Berechnung für komplexere Algorithmen
```

### 4.3 Kategoriezuordnungs-Modul

```
Interface: CategoryAssigner
  Input:  product_name (string)
  Output: { category_id, confidence }

MVP-Implementierung: Regelbasiertes Keyword-Mapping
Spätere Option:      ML-basierte Klassifizierung oder Sprachmodell-API
```

### 4.4 Validierungs-Modul (Abhak-Sequenzen)

```
Interface: SequenceValidator
  Input:  CheckoffSequence
  Output: { is_valid: boolean, confidence: number, reason: string }

MVP-Implementierung: Regelbasiert (Zeitabstände, Gesamtdauer)
Spätere Option:      ML-Modell, das Muster erkennt
```

### 4.5 Sync-Modul

```
Interface: SyncManager
  Input:  local_changes (ChangeQueue[]), last_sync_timestamp
  Output: { uploaded: number, downloaded: number, conflicts: ConflictResolution[] }

MVP-Implementierung: Bidirektionaler Sync mit Supabase REST API
Spätere Option:      Supabase Realtime für Echtzeit-Sync (Familien-Feature)
```

---

## 5. Datenbank-Schema (Richtlinien)

> Das exakte Schema soll die AI basierend auf DATA-MODEL.md erstellen. Hier nur Leitplanken:

### 5.1 Allgemein
- Alle Tabellen haben `id` (UUID), `created_at`, `updated_at`
- Soft-Delete wo sinnvoll (Status active/inactive statt echtes Löschen)
- Indizes auf alle Felder, die in WHERE-Klauseln oder JOINs verwendet werden
- Row-Level-Security (RLS) in Supabase: Nutzer sehen nur eigene Daten

### 5.2 Performance
- Produktkatalog: Index auf `name_normalized` für Suche
- Einkaufshistorie: Index auf `user_id` + `created_at` für chronologische Abfragen
- AisleOrder: Composite Index auf `store_id` + `category_id`
- Aggregationen (Gangfolge-Durchschnitte, globale Produktbeliebtheit) werden vorberechnet und gecacht, nicht bei jeder Anfrage neu berechnet

### 5.3 Datenbank-Migrationen
- Schema-Änderungen als versionierte Migrationsskripte
- Supabase bietet integrierte Migrations-Unterstützung

---

## 6. API-Design (Richtlinien)

### 6.1 Endpunkte (grob)

```
Produkte:
  GET    /api/products?search={query}&limit={n}     Produktsuche
  GET    /api/products/{id}                          Einzelnes Produkt
  POST   /api/products                               Produkt hinzufügen (Admin/Crowdsource)
  PATCH  /api/products/{id}                          Produkt bearbeiten (Admin)

Liste:
  GET    /api/lists/active                           Aktive Liste laden
  POST   /api/lists/active/items                     Produkt zur Liste hinzufügen
  PATCH  /api/lists/active/items/{id}                Eintrag ändern (Menge, Abhaken)
  DELETE /api/lists/active/items/{id}                Eintrag löschen

Läden:
  GET    /api/stores?lat={lat}&lng={lng}&limit={n}   Läden in der Nähe
  GET    /api/stores/{id}/aisle-order                Gangfolge für einen Laden

Einkäufe:
  POST   /api/trips                                  Einkauf archivieren
  POST   /api/trips/{id}/checkoff-sequence           Abhak-Sequenz speichern

Fehler:
  POST   /api/sorting-errors                         Fehler melden

Sync:
  POST   /api/sync                                   Bidirektionaler Sync-Endpunkt
```

> Die AI soll entscheiden, ob REST oder Supabase's eingebaute PostgREST-API besser geeignet ist. Supabase bietet automatische REST-Endpunkte für alle Tabellen – das könnte im MVP ausreichen.

### 6.2 Authentifizierung
- Supabase Auth mit Anonymous Sign-In (automatisch beim ersten App-Start)
- Alle API-Aufrufe mit Supabase Auth Token
- Row-Level-Security stellt sicher, dass Nutzer nur eigene Daten sehen

---

## 7. Frontend-Architektur

### 7.1 Ordnerstruktur (Vorschlag)

```
/src
  /app                    ← Next.js App Router (Pages)
    /[locale]             ← Sprachpräfix (de, en)
      /page.tsx           ← Startseite (S1)
      /list/page.tsx      ← Liste (S2)
      /settings/page.tsx  ← Einstellungen (S4)
      /admin/page.tsx     ← Admin (S5)

  /components             ← Wiederverwendbare UI-Komponenten
    /search               ← Such-Modul
    /list                 ← Listenansicht, Listeneinträge
    /store-picker         ← Ladenauswahl (S3)
    /common               ← Buttons, Icons, Layout

  /lib                    ← Geschäftslogik & Services
    /search               ← Such-Modul (Interface + Implementierung)
    /sorting              ← Sortier-Modul
    /category             ← Kategoriezuordnungs-Modul
    /validation           ← Sequenz-Validierung
    /sync                 ← Sync-Modul
    /db                   ← IndexedDB / Dexie.js Setup
    /supabase             ← Supabase Client Setup
    /i18n                 ← Internationalisierung

  /messages               ← Sprachdateien
    /de.json
    /en.json

  /types                  ← TypeScript Type-Definitionen
  /styles                 ← Globale Styles (Tailwind Config, ALDI-Farben)
```

### 7.2 State Management
- **Lokaler State (React):** Für UI-Zustand (Suchmodus aktiv, Picker offen, etc.)
- **IndexedDB (Dexie.js):** Für persistente Daten (Liste, Produkte, Gangfolgen)
- **Kein globaler State Manager (Redux etc.)** im MVP – die App ist einfach genug, um ohne auszukommen
- Die AI soll einschätzen, ob React Context für geteilten State zwischen Komponenten ausreicht

---

## 8. Offline-Architektur

> Details in OFFLINE-STRATEGY.md. Hier nur die technische Umsetzung:

### 8.1 Service Worker Strategie

```
App-Shell (HTML, CSS, JS):     Cache-First
  → Sofort aus Cache laden, im Hintergrund aktualisieren

API-Responses (Produktdaten):  Stale-While-Revalidate
  → Cache-Version sofort anzeigen, neue Version im Hintergrund laden

Nutzer-Aktionen (Schreiben):   Network-First mit Offline-Queue
  → Versuche sofort zu senden, bei Fehler in Queue speichern
```

### 8.2 IndexedDB-Tabellen

```
Dexie.js Schema:

products:       ++id, name_normalized, category_id
categories:     ++id, default_sort_position
stores:         ++id, country, [latitude+longitude]
list_items:     ++id, list_id, product_id, category_id, is_checked
aisle_orders:   ++id, store_id, category_id
aggregated:     ++id, category_id
preferences:    ++id, user_id, product_id, generic_name
offline_queue:  ++id, action, timestamp
```

---

## 9. Sicherheit & Datenschutz (technisch)

### 9.1 MVP
- HTTPS überall (Vercel + Supabase Standard)
- Supabase Row-Level-Security: Nutzer sehen nur eigene Daten
- Admin-Bereich: Einfaches Passwort (nicht produktionsreif, aber ausreichend für Prototyp)
- Keine sensiblen Daten im LocalStorage/IndexedDB (keine Passwörter, keine Tokens mit langer Laufzeit)

### 9.2 Vor Veröffentlichung (spätere Phase)
- DSGVO: Einwilligungsbanner, Datenschutzerklärung, Lösch-Funktion
- Admin-Bereich: Vollwertige Authentifizierung
- Rate Limiting auf API-Endpunkte
- Input-Validierung und Sanitization
- Content Security Policy Headers

---

## 10. Deployment & Betrieb

### 10.1 Deployment-Pipeline

```
Entwickler (Cursor) → Git Push → GitHub → Vercel (automatisches Deployment)
                                           ↓
                                    Produktions-URL: https://[app-name].vercel.app
```

### 10.2 Environments
- **Development:** Lokale Entwicklung mit `next dev`
- **Preview:** Automatisch für jeden Git Branch (Vercel)
- **Production:** Main Branch → Produktions-Deployment (Vercel)

### 10.3 Supabase-Projekt
- Ein Supabase-Projekt für Produktion
- Optional: Separates Projekt für Development/Testing
- Datenbank-Backups: Supabase bietet tägliche automatische Backups

### 10.4 Monitoring (MVP: minimal)
- Vercel: Eingebaute Analytics (Ladezeiten, Fehler)
- Supabase: Eingebautes Dashboard (Datenbankgröße, API-Aufrufe, Auth-Nutzung)
- Kein separates Monitoring-Tool im MVP

---

## 11. Performance-Budget

| Metrik | Ziel |
|--------|------|
| First Contentful Paint | < 1,5 Sekunden |
| Time to Interactive | < 2 Sekunden |
| Lighthouse Performance Score | > 90 |
| Bundle-Größe (JS) | < 200 KB (gzipped) |
| Initaler Daten-Download | < 1 MB |
| Suchlatenz (lokal) | < 100ms |
| Liste rendern (100 Produkte) | < 50ms |

---

## 12. Technische Risiken

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|--------|-------------------|------------|------------|
| IndexedDB-Speicherlimit auf iOS Safari | Niedrig | Hoch | Daten unter 50 MB halten, regelmäßig alte Cache-Daten bereinigen |
| Service Worker Kompatibilität | Niedrig | Hoch | Testen auf iOS Safari (strengste Einschränkungen) |
| Supabase Free Tier Limits | Mittel | Mittel | Monitoring, bei Bedarf auf Pro-Plan upgraden (~25$/Monat) |
| GPS-Genauigkeit in Innenstädten | Mittel | Niedrig | Manuelle Ladenauswahl als zuverlässiger Fallback |
| PWA Install-Prompt auf iOS | Hoch | Niedrig | Anleitung für manuelles "Zum Home-Screen hinzufügen" |

---

## 13. Konventionen für die AI

> Anweisungen an den AI-Agent (Cursor), die bei der Code-Generierung zu beachten sind:

### 13.1 Code-Qualität
- TypeScript (strict mode) für alles
- ESLint + Prettier für Code-Formatierung
- Kommentare auf Englisch
- Funktionale React-Komponenten (keine Klassen)
- Keine `any` Types – immer typisieren

### 13.2 Benennung
- Dateien und Ordner: kebab-case (z.B. `store-picker.tsx`)
- React-Komponenten: PascalCase (z.B. `StorePicker`)
- Funktionen und Variablen: camelCase (z.B. `getStoreById`)
- Datenbank-Tabellen und -Spalten: snake_case (z.B. `aisle_order`)
- Konstanten: UPPER_SNAKE_CASE (z.B. `MAX_SEARCH_RESULTS`)

### 13.3 Commits
- Klare, beschreibende Commit-Messages auf Englisch
- Ein Commit pro logischer Änderung
- Format: `feat: add product search module` / `fix: correct aisle sort order`

### 13.4 Testing
- Kernlogik (Sortierung, Validierung, Kategoriezuordnung) soll Unit-Tests haben
- UI-Tests sind im MVP nicht erforderlich
- Test-Framework: Vitest (schnell, Next.js-kompatibel)

---

*Letzte Aktualisierung: 2025-02-16*
*Status: Entwurf v1 – Review durch Produktinhaber ausstehend*
