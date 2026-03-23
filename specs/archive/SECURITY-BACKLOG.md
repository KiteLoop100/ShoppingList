# Security Backlog

Zentrale Sammelstelle für alle Sicherheitsthemen, die nach MVP-Stabilisierung umgesetzt werden sollen.

**Status-Legende:** 🔴 Offen | 🟡 In Arbeit | 🟢 Erledigt

---

## S1 – Storage: Kassenzettel-Fotos öffentlich zugänglich

| Feld | Wert |
|------|------|
| **Priorität** | Hoch |
| **Status** | 🟢 Erledigt (2026-02-26, Block 2: Storage Security) |
| **Betrifft** | `receipt-photos` Bucket (Supabase Storage) |
| **Lösung** | Migration `20260226200000_receipt_photos_bucket.sql` erstellt privaten Bucket `receipt-photos` (`public: false`) mit RLS-Policies (SELECT/INSERT auf `auth.uid()`-basiertem Pfad). Upload-Route nutzt Signed URLs (10 Min Gültigkeit) statt Public URLs. `receipts.photo_urls` speichert Storage-Pfade statt URLs. Detailseite generiert Signed URLs on-demand (5 Min). Backward-compatible mit bestehenden Public URLs. |

---

## S2 – RLS: Kassenzettel-Tabellen ohne User-Filterung

| Feld | Wert |
|------|------|
| **Priorität** | Hoch |
| **Status** | 🟢 Erledigt (2026-02-26, Block 1: RLS) |
| **Betrifft** | `receipts`, `receipt_items` Tabellen |
| **Lösung** | Migration `20260226100000_rls_user_filtering.sql` ersetzt alle `USING (true)` Policies durch `auth.uid()::text`-basierte Policies. `receipts`: SELECT/INSERT/UPDATE/DELETE auf `user_id = auth.uid()::text`. `receipt_items`: alle Operationen über JOIN auf `receipts.user_id`. |

---

## S3 – RLS: photo_uploads ohne User-Filterung

| Feld | Wert |
|------|------|
| **Priorität** | Mittel |
| **Status** | 🟢 Erledigt (2026-02-26, Block 1: RLS) |
| **Betrifft** | `photo_uploads` Tabelle |
| **Lösung** | Migration `20260226100000_rls_user_filtering.sql` ersetzt die offenen SELECT/INSERT/UPDATE Policies. Neue SELECT Policy: `user_id = auth.uid()::text`. INSERT/UPDATE erfolgen über Admin-Client (API-Routes), daher keine User-Policies nötig. |

---

## S4 – Authentifizierung: Device-ID statt echtem Auth

| Feld | Wert |
|------|------|
| **Priorität** | Mittel |
| **Status** | 🟢 Erledigt (2026-02-26, Block 0: Account & Auth) |
| **Betrifft** | Gesamte App |
| **Lösung** | Supabase Auth (anonymous-first + email/password). `getDeviceUserId()` durch `getCurrentUserId()` (auth.uid()) ersetzt. Einkaufsliste in Supabase statt IndexedDB. Multi-Device über Login. |

**Ist-Zustand:**
- User-ID wird in `localStorage` als zufällige UUID erzeugt.
- Server vertraut dem `user_id`-Feld im Request Body ohne Verifizierung.
- RLS-Policies können nicht sinnvoll greifen, da kein `auth.uid()` existiert.

**Soll-Zustand:**
1. Supabase Anonymous Auth aktivieren (`signInAnonymously()`).
2. Echtes `auth.uid()` in RLS-Policies verwenden.
3. Optional: E-Mail/Passwort-Login für Gerätewechsel und Datenmigration.
4. Server validiert Auth-Token statt Client-übergebener `user_id`.

**Betroffene Dateien:**
- `src/lib/user/device-user-id.ts`
- Alle API-Routes die `user_id` aus dem Body lesen
- Alle Supabase-Client-Initialisierungen
- Alle RLS-Policies (Migrations)

---

## S5 – API-Routes: Keine Eingabevalidierung

| Feld | Wert |
|------|------|
| **Priorität** | Mittel |
| **Status** | 🟢 Erledigt (2026-02-26, Block 3: Rate-Limiting & Validation) |
| **Betrifft** | `/api/process-receipt`, `/api/process-photo`, `/api/process-flyer-page`, `/api/assign-category`, `/api/upload-receipt-photo` |
| **Lösung** | Zod-Schema-Validierung für alle 5 API-Routes. `photo_urls` max 5 Bilder, `base64` max 5 MB. Ungültige Payloads → HTTP 400 mit Zod-Fehlerdetails. |

---

## S6 – Anthropic API Key: Kein Schutz vor Missbrauch

| Feld | Wert |
|------|------|
| **Priorität** | Mittel |
| **Status** | 🟢 Erledigt (2026-02-26, Block 3: Rate-Limiting & Validation) |
| **Betrifft** | `ANTHROPIC_API_KEY` in `.env.local` / Vercel Environment |
| **Lösung** | Upstash Redis Rate-Limiting: Claude-Endpoints (process-receipt, process-photo, assign-category) auf 5 Requests/Stunde/User begrenzt. Nicht-Claude-Endpoints (upload-receipt-photo, process-flyer-page) auf 20 Requests/Minute/User. Graceful degradation: ohne Upstash-Config (lokal) kein Rate-Limiting. Client zeigt benutzerfreundliche 429-Meldung. Anthropic API Budget-Limit ($50/Monat) manuell im Dashboard setzen. |

---

## S7 – Zusätzliche Security-Härtung

| Feld | Wert |
|------|------|
| **Priorität** | Mittel |
| **Status** | 🟢 Erledigt (2026-03-03) |
| **Betrifft** | `next.config.js`, Admin-API-Routes, `flyer-processing-status`, `reprocess-all-flyers.mjs` |
| **Lösung** | (1) Security Headers in `next.config.js`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection`, restriktive `Permissions-Policy`. (2) TLS-Bypass (`NODE_TLS_REJECT_UNAUTHORIZED = "0"`) aus `reprocess-all-flyers.mjs` entfernt. (3) Zod-Validierung für Admin-API-Routes (`reclassify-products`, `assign-demand-groups`, `batch-jobs`). (4) Auth-Check und Rate-Limiting für `/api/flyer-processing-status`. (5) Debug-Logging (`console.table`) aus `local-search.ts` entfernt. |

---

## Umsetzungsreihenfolge (Empfehlung)

| Schritt | Item | Status | Begründung |
|---------|------|--------|------------|
| 1 | **S4** Auth | 🟢 | Grundlage für alle anderen Sicherheitsmaßnahmen |
| 2 | **S2 + S3** RLS | 🟢 | Mit echtem Auth können RLS-Policies korrekt greifen |
| 3 | **S1** Storage | 🟢 | Private Buckets + Signed URLs |
| 4 | **S5** Validation | 🟢 | Zod-Schema-Validierung für alle API-Routes |
| 5 | **S6** API-Schutz | 🟢 | Upstash Rate-Limiting + Anthropic Budget-Limit |
| 6 | **S7** Härtung | 🟢 | Security Headers, TLS-Fix, Admin Validation, flyer-status Auth |

---

*Erstellt: 2026-02-23*
*Zuletzt aktualisiert: 2026-03-03 (S7 erledigt – alle Items abgeschlossen)*
