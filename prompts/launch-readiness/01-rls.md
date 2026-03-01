# Prompt: Block 1 – Row-Level Security (RLS)

## Empfohlenes Modell: Opus 4.6 (normal)

## Abhängigkeit: Block 0 (Account) muss abgeschlossen sein

---

## Kontext

Supabase Auth ist jetzt aktiv (Block 0). Jeder Nutzer hat eine `auth.uid()`. Die folgenden Tabellen haben noch offene RLS-Policies (`USING (true)`) — jeder kann alle Daten sehen und ändern:

| Tabelle | Migration | Problem |
|---------|-----------|---------|
| `receipts` | `20260223000000_receipts.sql` | `USING (true)` für alle Operationen |
| `receipt_items` | `20260223000000_receipts.sql` | `USING (true)` für alle Operationen |
| `auto_reorder_settings` | `20260224000000_auto_reorder_settings.sql` | `USING (true)` für alle Operationen |
| `photo_uploads` | `20250221000000_photo_uploads_f13.sql` | `USING (true)` für SELECT |
| `shopping_lists` | Block 0 Migration | Bereits `auth.uid()`-Policy aus Initial-Schema, aber prüfen ob nach Block 0 korrekt |
| `list_items` | Block 0 Migration | Über JOIN auf `shopping_lists` |

**Wichtig:** Die API-Routes nutzen den Admin-Client (`SUPABASE_SERVICE_ROLE_KEY`), der RLS umgeht. RLS betrifft nur Client-seitige Queries mit dem Anon-Key.

---

## Aufgabe

### 1. Neue Migration erstellen: `supabase/migrations/YYYYMMDD_rls_user_filtering.sql`

```sql
-- =============================================
-- receipts: nur eigene Kassenzettel
-- =============================================
DROP POLICY IF EXISTS "Allow select receipts" ON receipts;
DROP POLICY IF EXISTS "Allow insert receipts" ON receipts;
DROP POLICY IF EXISTS "Allow update receipts" ON receipts;
DROP POLICY IF EXISTS "Allow delete receipts" ON receipts;

CREATE POLICY "Users read own receipts" ON receipts
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users insert own receipts" ON receipts
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users update own receipts" ON receipts
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users delete own receipts" ON receipts
  FOR DELETE USING (user_id = auth.uid()::text);

-- =============================================
-- receipt_items: über JOIN auf receipts
-- =============================================
DROP POLICY IF EXISTS "Allow select receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow insert receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow update receipt_items" ON receipt_items;
DROP POLICY IF EXISTS "Allow delete receipt_items" ON receipt_items;

CREATE POLICY "Users read own receipt_items" ON receipt_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

CREATE POLICY "Users insert own receipt_items" ON receipt_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

-- receipt_items UPDATE/DELETE: same pattern
CREATE POLICY "Users update own receipt_items" ON receipt_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

CREATE POLICY "Users delete own receipt_items" ON receipt_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM receipts r WHERE r.receipt_id = receipt_items.receipt_id AND r.user_id = auth.uid()::text)
  );

-- =============================================
-- auto_reorder_settings: nur eigene Settings
-- =============================================
DROP POLICY IF EXISTS "Users can read own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can insert own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can update own reorder settings" ON auto_reorder_settings;
DROP POLICY IF EXISTS "Users can delete own reorder settings" ON auto_reorder_settings;

CREATE POLICY "Users read own reorder settings" ON auto_reorder_settings
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users insert own reorder settings" ON auto_reorder_settings
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users update own reorder settings" ON auto_reorder_settings
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users delete own reorder settings" ON auto_reorder_settings
  FOR DELETE USING (user_id = auth.uid()::text);

-- =============================================
-- photo_uploads: nur eigene Uploads
-- =============================================
DROP POLICY IF EXISTS "Allow select own photo_uploads" ON photo_uploads;

CREATE POLICY "Users read own photo_uploads" ON photo_uploads
  FOR SELECT USING (user_id = auth.uid()::text);

-- INSERT/UPDATE for photo_uploads is done via Admin Client (API routes),
-- so no user-facing INSERT/UPDATE policies needed.
```

### 2. Prüfe die RLS-Policies der Tabellen aus Block 0

Die `shopping_lists` und `list_items` Tabellen haben Policies aus der Initial-Migration, die `auth.uid()` verwenden. Prüfe ob diese nach der Block-0-Migration (user_id auf TEXT geändert) noch funktionieren. Falls nicht: anpassen auf `auth.uid()::text`.

### 3. Supabase Realtime + RLS

Supabase Realtime respektiert RLS. Nach dem Setzen der Policies: testen ob die Realtime-Subscription in `use-list-data.ts` noch funktioniert. Der eingeloggte User muss die Rows per RLS sehen dürfen.

---

## Fallstricke

1. **`auth.uid()` gibt UUID zurück, `user_id` ist TEXT:** Daher `auth.uid()::text` in den Policies verwenden.

2. **Admin-Client umgeht RLS:** Die API-Routes (`process-receipt`, `upload-receipt-photo`, `process-photo`) nutzen `createAdminClient()` mit Service Role Key. Diese sind von RLS nicht betroffen. Nur Client-seitige Queries (Browser → Supabase direkt) werden durch RLS gefiltert.

3. **Bestehende Daten:** Nach Block 0 sollten alle `user_id`-Werte auf `auth.uid()` aktualisiert sein. Falls alte Device-IDs noch existieren, werden sie durch RLS unsichtbar (gewollt).

---

## Testplan

- [ ] Als User A einloggen → nur eigene Kassenzettel in `/receipts` sichtbar
- [ ] Als User A: Supabase-Client direkt querien (`supabase.from('receipts').select('*')`) → nur eigene Daten
- [ ] Als User B: keine Daten von User A sichtbar
- [ ] Auto-Reorder: nur eigene Settings laden
- [ ] Realtime-Subscription: funktioniert weiterhin nach RLS-Update
- [ ] API-Routes (Admin-Client): funktionieren weiterhin (RLS umgangen)

---

## Specs aktualisieren

- `specs/SECURITY-BACKLOG.md` → S2 (RLS Receipts) und S3 (RLS Photo Uploads) auf 🟢 Erledigt setzen
- `specs/CHANGELOG.md` → Eintrag hinzufügen
