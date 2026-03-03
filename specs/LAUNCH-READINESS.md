# LAUNCH-READINESS.md – Friendly User Test (100–1.000 Nutzer)

> Checkliste und Umsetzungsplan für den erweiterten Friendly User Test.
> Jeder Block hat einen zugehörigen Prompt unter `prompts/launch-readiness/`.

---

## Voraussetzungen (vor dem Coding)

- [x] **Vercel Pro Plan** ($20/Monat) — bereits vorhanden
- [x] **Supabase Pro Plan** ($25/Monat) — wegen Bandwidth-Limits bei 100+ Nutzern
- [x] **Anthropic API Budget-Limit** — deutlich höher als $50/Monat gesetzt
- [x] **Supabase Anonymous Auth aktivieren** — Dashboard → Authentication → Settings
- [x] **Supabase Email Provider aktivieren** — Dashboard → Authentication → Providers → Email
- [x] **Email-Bestätigung deaktivieren** — Dashboard → Authentication → Settings → Confirm email: OFF (für Test)

---

## Umsetzungsreihenfolge

```
Block 0: Account & Multi-Device [DONE] ──────────────────────────
  │  Auth, IndexedDB → Supabase, Realtime Sync
  │  Prompt: prompts/launch-readiness/00-account.md
  │
  ▼
Block 1: Row-Level Security [DONE] ──────────────────────────────
  │  RLS-Policies auf auth.uid() umstellen
  │  Prompt: prompts/launch-readiness/01-rls.md
  │
  ▼
Block 2: Storage-Sicherheit [DONE] ──────────────────────────────
  │  Private Bucket für Kassenzettel, Signed URLs
  │  Prompt: prompts/launch-readiness/02-storage-security.md
  │
  ▼
Block 3: Rate-Limiting & API-Validierung [DONE] ─────────────────
  │  Upstash Rate-Limit, Zod-Validierung
  │  Prompt: prompts/launch-readiness/03-rate-limiting.md
  │
  ▼
Block 4: Error Tracking [DONE] ──────────────────────────────────
  │  Sentry eingebunden (client, server, edge config)
  │  Prompt: prompts/launch-readiness/04-error-tracking.md
  │
  ▼
Block 5: Produkt-Sync optimieren [DONE] ─────────────────────────
  │  Delta-Sync mit IndexedDB-Cache statt Full-Reload
  │  Prompt: prompts/launch-readiness/05-product-sync.md
  │
  ▼
Block 6: Datenschutzerklärung [DONE] ────────────────────────────
  │  DSGVO-konforme Datenschutzseite unter /privacy
  │  Prompt: prompts/launch-readiness/06-privacy-page.md
  │
  ▼
Block 7: Onboarding [DONE] ──────────────────────────────────────
  │  First-Start-Flow für neue Nutzer (7 Screens implementiert)
  │  Prompt: prompts/launch-readiness/07-onboarding.md
  │
  ▼
Block 8: PWA aktivieren [DONE] ──────────────────────────────────
  │  Service Worker, Manifest, App-Icon (aktiv in next.config.js + manifest.json)
  │  Prompt: prompts/launch-readiness/08-pwa.md
  │
  ▼
🚀 LAUNCH – Friendly User Test (deployed to Vercel Production)
```

---

## Abhängigkeitsdiagramm

```
Block 0 (Account) ──┬──→ Block 1 (RLS)
                     ├──→ Block 2 (Storage)
                     ├──→ Block 3 (Rate-Limiting)
                     ├──→ Block 6 (Datenschutz)
                     └──→ Block 7 (Onboarding)

Block 4 (Sentry)     ──→ unabhängig, jederzeit
Block 5 (Sync)       ──→ unabhängig, jederzeit
Block 8 (PWA)        ──→ unabhängig, jederzeit
```

Blöcke 4, 5, 8 können parallel zu den anderen umgesetzt werden.

---

## Deployment-Strategie

### Preview → Production

```
feature/account  ──push──→  Vercel Preview URL  ──test──→  PR → merge → Production
feature/rls      ──push──→  Vercel Preview URL  ──test──→  PR → merge → Production
...
```

- Jeder Block bekommt einen eigenen Feature-Branch
- Vercel erstellt automatisch eine Preview-URL pro Branch
- Auf der Preview-URL testen (Handy, Desktop, verschiedene Browser)
- Wenn alles funktioniert: Pull Request → Merge in `main` → Production

### Pre-Launch Smoke Test

Vor der Freigabe an Nutzer auf Production prüfen:

- [x] Build & Compile check (npm run build)
- [x] Alle Seiten erreichbar (HTTP 200), /api/feedback 401 (korrekt ohne Auth)
- [x] Unit Tests bestanden (14/14)
- [x] DB-Migrationen angewendet (Feedback, BL-62)
- [x] HTML-Content aller Seiten verifiziert
- [x] Keine Server-Errors in Logs
- [x] Production-Deployment auf Vercel live
- [ ] Neuer Nutzer: App öffnen → anonymer Account → Liste anlegen → Produkte suchen → abhaken
- [ ] Konto erstellen → auf zweitem Gerät einloggen → gleiche Liste sichtbar
- [ ] Kassenzettel scannen → Daten korrekt → nur eigene Kassenzettel sichtbar
- [ ] Auto-Reorder → funktioniert nach Login auf anderem Gerät
- [ ] Rate-Limiting → 6. Scan in einer Stunde wird blockiert
- [ ] Datenschutzerklärung → erreichbar
- [ ] PWA → "Zum Startbildschirm hinzufügen" funktioniert

---

## Kosten-Übersicht (monatlich)

| Posten | Kosten | Anmerkung |
|--------|--------|-----------|
| Vercel Pro | $20 | Bereits vorhanden |
| Supabase Pro | $25 | Empfohlen ab 100+ Nutzer |
| Anthropic API | $10–50 | Je nach Scan-Nutzung; Budget-Limit setzen |
| Sentry | $0 | Free Plan: 5.000 Events/Monat |
| Upstash (Rate-Limiting) | $0 | Free Plan: 10.000 Requests/Tag |
| **Gesamt** | **$55–95** | |

---

## Geschätzter Aufwand

| Block | Aufwand | Modell |
|-------|---------|--------|
| Block 0: Account & Multi-Device | 3–4 Tage | Max Mode |
| Block 1: RLS | 0,5 Tage | Normal |
| Block 2: Storage-Sicherheit | 0,5 Tage | Normal |
| Block 3: Rate-Limiting | 1 Tag | Normal |
| Block 4: Error Tracking | 0,5 Tage | Normal |
| Block 5: Produkt-Sync | 1–2 Tage | Max Mode |
| Block 6: Datenschutz | 0,5 Tage | Normal |
| Block 7: Onboarding | 1 Tag | Normal |
| Block 8: PWA | 0,5 Tage | Normal |
| **Gesamt** | **~8–10 Tage** | |

---

## Referenzen

| Dokument | Inhalt |
|----------|--------|
| `specs/FEATURES-ACCOUNT.md` | Account-Feature-Spezifikation |
| `specs/SECURITY-BACKLOG.md` | Offene Sicherheitsthemen (S1–S6) |
| `specs/OFFLINE-STRATEGY.md` | Offline-Strategie (deferred, aber relevant für Sync) |
| `specs/ARCHITECTURE.md` | Technische Architektur |
| `specs/DATA-MODEL.md` | Datenbankschema |

---

*Created: 2026-02-25*
*Last updated: 2026-03-03*
*Status: All blocks DONE. Deployed to Vercel Production.*
