# Vercel-Deployment

## 1. Projekt-Konfiguration

- **next.config.js:** Auf Vercel wird automatisch `distDir: ".next"` verwendet (über `process.env.VERCEL`). Lokal bleibt der Build in `node_modules/.cache/next-build` (Dropbox-kompatibel).
- **Build-Befehl:** `npm run build` (Standard für Next.js).
- **Output Directory:** Vercel erkennt Next.js automatisch; kein manuelles Setzen nötig.

## 2. Umgebungsvariablen (in Vercel eintragen)

Im Vercel-Dashboard: **Project → Settings → Environment Variables** eintragen.

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Ja* | Supabase Project URL (z. B. `https://xxxx.supabase.co`) – aus Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ja* | Supabase **anon** / public Key (Project Settings → API) |
| `ADMIN_PASSWORD` | Ja** | Beliebiges Passwort für den Admin-Bereich (`/admin`) |
| `ANTHROPIC_API_KEY` | Ja*** | API-Key für Claude Vision (F13 Foto-Erfassung). Anthropic Dashboard → API Keys. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja*** | Supabase **service_role** Key – für API process-photo (Schreiben in products/photo_uploads). |

\* Ohne Supabase läuft die App mit IndexedDB; Produktsuche und Filialen aus Supabase sind dann nicht verfügbar.  
\** Ohne `ADMIN_PASSWORD` ist der Admin-Login ungeschützt (nur für Tests sinnvoll).  
\*** Für F13 (Produkte erfassen per Foto): Ohne diese Keys funktioniert der Foto-Upload; die Verarbeitung schlägt fehl.

Für alle drei Variablen: **Environment** am besten auf **Production**, **Preview** und **Development** setzen (oder mindestens Production).

## 3. Build lokal prüfen

```bash
npm run build
```

Der Build muss ohne Fehler durchlaufen. Bei Fehlern zuerst lokal beheben, danach erneut deployen.

---

## 4. Deploy auf Vercel – Schritte

### Schritt 1: Vercel-Account

1. Auf [vercel.com](https://vercel.com) gehen.
2. Mit **GitHub**, **GitLab** oder **Bitbucket** anmelden (empfohlen: GitHub).

### Schritt 2: Projekt von GitHub importieren

1. Im Vercel-Dashboard auf **Add New…** → **Project** klicken.
2. **Import Git Repository** wählen und das gewünschte Repo auswählen (z. B. `DigitalShoppingList`).  
   Falls das Repo noch nicht auf GitHub ist: zuerst ein neues Repo anlegen und den lokalen Stand pushen.
3. **Import** klicken.

### Schritt 3: Build-Einstellungen prüfen

- **Framework Preset:** Next.js (wird automatisch erkannt).
- **Build Command:** `npm run build` (Standard).
- **Output Directory:** leer lassen (Next.js-Standard).
- **Install Command:** `npm install` (Standard).

### Schritt 4: Umgebungsvariablen eintragen

1. Beim Import oder unter **Project → Settings → Environment Variables** die Variablen anlegen:
   - `NEXT_PUBLIC_SUPABASE_URL` = deine Supabase-URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = dein Supabase anon Key  
   - `ADMIN_PASSWORD` = gewähltes Admin-Passwort  
   - `ANTHROPIC_API_KEY` = dein Anthropic API-Key (für Foto-Erfassung F13)  
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role Key (für Foto-Verarbeitung)  
2. Für jede Variable optional **Production**, **Preview** und **Development** auswählen.
3. Speichern.

### Schritt 5: Deploy starten

1. **Deploy** klicken (beim ersten Import) oder unter **Deployments** einen neuen **Redeploy** auslösen.
2. Warten, bis der Build durchgelaufen ist (Logs unter **Building** einsehbar).
3. Nach erfolgreichem Build: Link zur Live-App (z. B. `https://digital-shopping-list-xxx.vercel.app`) öffnen.

### Schritt 6: Nach dem ersten Deploy

- **Domain:** Unter **Settings → Domains** eine eigene Domain eintragen (optional).
- **Weitere Deploys:** Bei verbundenem Git-Repo wird bei jedem Push in die gewählte Branch (meist `main`) automatisch neu gebaut und deployed.
