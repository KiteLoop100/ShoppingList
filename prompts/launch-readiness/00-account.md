# Prompt: Block 0 – Account, Auth & Multi-Device

## Empfohlenes Modell: Opus 4.6 Max Mode

## Abhängigkeiten: Keine (muss als erstes umgesetzt werden)

## Voraussetzungen (manuell, vor dem Coding)
1. Supabase Dashboard → Authentication → Settings → "Enable anonymous sign-ins": ON
2. Supabase Dashboard → Authentication → Providers → Email: Enabled
3. Supabase Dashboard → Authentication → Settings → "Confirm email": OFF (für den Test)

---

## Kontext

Die App nutzt aktuell `getDeviceUserId()` aus `src/lib/list/device-id.ts` — eine zufällige ID in `localStorage`. Die Einkaufsliste (`lists`, `list_items`, `trips`, `trip_items`) lebt nur in IndexedDB (Dexie.js, `src/lib/db/indexed-db.ts`). Kasszettel und Auto-Reorder liegen bereits in Supabase, aber mit `user_id: TEXT` (Device-ID).

**Ziel:** Supabase Auth (anonymous-first + E-Mail/Passwort), Einkaufsliste in Supabase, Realtime-Sync für Multi-Device.

---

## Aufgabe (in dieser Reihenfolge)

### Schritt 1: Auth-Infrastruktur

1. **Neues Modul `src/lib/auth/auth-context.tsx`** erstellen:
   - `AuthProvider` (React Context) mit `supabase.auth.onAuthStateChange()`
   - States: `user` (Supabase User | null), `loading`, `isAnonymous`
   - Funktionen: `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `linkEmail(email, password)` (für anonymous → registered upgrade)
   - Beim App-Start: Prüfe ob Session existiert. Falls nicht: `supabase.auth.signInAnonymously()`
   - Exportiere `useAuth()` Hook und `getCurrentUserId(): string` Helper

2. **`src/lib/list/device-id.ts`** als deprecated markieren:
   - `getDeviceUserId()` bleibt temporär erhalten (für Migration), wird aber nicht mehr für neue Queries genutzt
   - Neuer Code nutzt `getCurrentUserId()` aus `auth-context.tsx`

3. **`src/lib/supabase/client.ts`** anpassen:
   - Der Browser-Client muss die Auth-Session mitführen. `createBrowserClient` aus `@supabase/ssr` macht das bereits automatisch, prüfe ob `persistSession: true` (default) aktiv ist.

4. **`src/app/[locale]/layout.tsx`** um `<AuthProvider>` wrappen (muss um alles andere herum liegen)

### Schritt 2: Login / Registration UI

1. **Neue Seite `src/app/[locale]/login/page.tsx`**:
   - E-Mail + Passwort Felder
   - Buttons: "Anmelden", "Konto erstellen", "Ohne Konto fortfahren"
   - "Passwort vergessen?" Link (nutzt `supabase.auth.resetPasswordForEmail()`)
   - Nach Login/Registrierung: Redirect zu `/`
   - Design: Clean, ALDI-Farben, wie bestehende App

2. **Settings-Seite (`src/app/[locale]/settings/settings-client.tsx`)** erweitern:
   - Neue Sektion ganz oben: "Konto"
   - Angemeldet → E-Mail anzeigen + "Abmelden" Button
   - Anonym → Hinweis + "Konto erstellen" Button (öffnet Modal oder navigiert zu `/login`)
   - Translation-Keys in `de.json` und `en.json` ergänzen

### Schritt 3: Einkaufsliste von IndexedDB nach Supabase migrieren

**Wichtig:** Die Supabase-Tabellen `shopping_lists`, `list_items`, `shopping_trips`, `trip_items`, `user_product_preferences` existieren bereits (Migration `20250216000000_initial_schema.sql`). Sie haben `user_id UUID` mit FK auf `users(user_id)`. Die `users`-Tabelle wird von Supabase Auth befüllt (bei `signInAnonymously()` wird ein Eintrag in `auth.users` erstellt, aber NICHT in der custom `users`-Tabelle).

**Option A (empfohlen):** Die FK-Constraints auf `users(user_id)` entfernen und `user_id` direkt mit `auth.uid()` befüllen (kein custom `users`-Table nötig für MVP).

**Option B:** Bei jedem Auth-Event (sign-in, sign-up) einen Eintrag in der `users`-Tabelle erstellen (Trigger oder App-Code).

→ Wähle Option A. Erstelle eine neue Migration:
```sql
-- Remove FK constraints that reference the custom users table
ALTER TABLE shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_user_id_fkey;
ALTER TABLE shopping_trips DROP CONSTRAINT IF EXISTS shopping_trips_user_id_fkey;
ALTER TABLE user_product_preferences DROP CONSTRAINT IF EXISTS user_product_preferences_user_id_fkey;
ALTER TABLE checkoff_sequences DROP CONSTRAINT IF EXISTS checkoff_sequences_user_id_fkey;
ALTER TABLE sorting_errors DROP CONSTRAINT IF EXISTS sorting_errors_user_id_fkey;

-- user_id is now TEXT (auth.uid() returns UUID as string, compatible with TEXT)
-- shopping_lists already has user_id UUID → change to TEXT for flexibility
ALTER TABLE shopping_lists ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE shopping_trips ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE user_product_preferences ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE checkoff_sequences ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE sorting_errors ALTER COLUMN user_id TYPE TEXT;
```

3. **`src/lib/list/active-list.ts`** umschreiben:
   - `getOrCreateActiveList()`: Supabase-Query statt IndexedDB
     ```typescript
     const supabase = createClientIfConfigured();
     const userId = getCurrentUserId();
     const { data } = await supabase
       .from('shopping_lists')
       .select('*')
       .eq('user_id', userId)
       .eq('status', 'active')
       .maybeSingle();
     if (data) return data;
     // Create new list
     const { data: newList } = await supabase
       .from('shopping_lists')
       .insert({ user_id: userId, status: 'active' })
       .select()
       .single();
     return newList;
     ```
   - `addListItem()`, `updateListItem()`, `deleteListItem()`, `getListItems()`: Alle auf Supabase umstellen
   - **Interface** (`AddItemParams`, Return-Typen) möglichst gleich halten, damit aufrufende Komponenten wenig ändern müssen

4. **`src/components/list/use-list-data.ts`** umschreiben:
   - `refetch()`: Daten aus Supabase statt IndexedDB laden
   - Supabase Realtime Subscription für `list_items` (INSERT, UPDATE, DELETE) hinzufügen
   - `useEffect` für Subscription Setup/Cleanup
   - Die bestehende Logik für Auto-Reorder, Deferred Items, Sorting bleibt erhalten — nur die Datenquelle ändert sich

5. **`src/lib/list/typical-products.ts`** umschreiben:
   - `getCompletedTripCount()`: Supabase statt IndexedDB
   - `getTypicalProducts()`: Supabase statt IndexedDB

6. **`src/lib/list/last-trip.ts`**: Supabase statt IndexedDB

7. **`src/lib/list/recent-list-products.ts`**: Bereits teilweise Supabase (Receipts), den IndexedDB-Teil für list_items ebenfalls auf Supabase umstellen

### Schritt 4: Datenmigration für bestehende Nutzer

1. **Einmalige Migration** in `src/lib/auth/auth-helpers.ts`:
   ```typescript
   export async function migrateLocalDataToSupabase(newUserId: string): Promise<void> {
     const oldDeviceId = localStorage.getItem('digital-shopping-list-device-id');
     const migrated = localStorage.getItem('data-migration-complete');
     if (migrated || !oldDeviceId) return;

     // 1. IndexedDB → Supabase
     const lists = await db.lists.toArray();
     const items = await db.list_items.toArray();
     const trips = await db.trips.toArray();
     const tripItems = await db.trip_items.toArray();
     // ... insert into Supabase with newUserId ...

     // 2. Update existing Supabase data (receipts, auto_reorder_settings)
     const supabase = createClientIfConfigured();
     await supabase.from('receipts').update({ user_id: newUserId }).eq('user_id', oldDeviceId);
     await supabase.from('receipt_items')... // via receipt_id join
     await supabase.from('auto_reorder_settings').update({ user_id: newUserId }).eq('user_id', oldDeviceId);

     // 3. Mark as done
     localStorage.setItem('data-migration-complete', 'true');
   }
   ```

2. Migration aufrufen in `AuthProvider` nach erfolgreichem `signInAnonymously()` (erster Start)

### Schritt 5: API-Routes absichern

Die API-Routes, die `user_id` aus dem Request Body lesen, müssen umgestellt werden:

1. **`src/app/api/upload-receipt-photo/route.ts`**:
   - `user_id` nicht mehr aus Body lesen
   - Stattdessen: Auth-Header (`Authorization: Bearer <token>`) parsen, User über Supabase Admin Client verifizieren
   - Oder: `user_id` weiterhin aus Body akzeptieren (einfacher), aber im Frontend aus `getCurrentUserId()` setzen (Auth-basiert)
   - **Empfehlung für MVP:** `user_id` aus Body beibehalten, aber der Wert kommt jetzt aus `auth.uid()` statt Device-ID

2. **`src/app/api/process-receipt/route.ts`**: Gleiche Anpassung

---

## Fallstricke (im Prompt-Kontext beachten)

1. **`users`-Tabelle:** Die Initial-Migration erstellt eine `users`-Tabelle mit FK-Constraints. Die App schreibt dort aber nie rein (kein Sign-Up-Code für diese Tabelle). Die FK-Constraints auf `shopping_lists.user_id → users.user_id` etc. müssen entfernt werden, sonst schlägt das Insert fehl.

2. **UUID vs TEXT:** `auth.uid()` gibt einen UUID-String zurück. Die `receipts`- und `auto_reorder_settings`-Tabellen haben `user_id TEXT` — das ist kompatibel. Die `shopping_lists`-Tabelle hat `user_id UUID` — nach der Migration auf TEXT ebenfalls kompatibel.

3. **Realtime RLS:** Supabase Realtime respektiert RLS-Policies. Die Realtime-Subscription funktioniert nur, wenn der eingeloggte User die Rows auch per RLS sehen darf. → RLS kommt in Block 1, aber für den Test müssen die Policies erstmal `USING (true)` bleiben (wie jetzt), sonst sieht Realtime nichts.

4. **IndexedDB löschen:** Nach erfolgreicher Migration die IndexedDB-Daten NICHT sofort löschen — erst nach Bestätigung, dass alles in Supabase angekommen ist. Ein `localStorage`-Flag `data-migration-complete` schützt vor doppelter Migration.

5. **Offline:** Nach dem Umbau funktioniert die Liste ohne Internet nicht mehr. Das ist akzeptabel für den Friendly User Test. Offline-Support kommt in einer späteren Phase.

---

## Testplan

- [ ] Neuer Nutzer: App öffnen → automatisch anonymous eingeloggt → leere Liste → Produkte suchen und hinzufügen → Liste in Supabase sichtbar
- [ ] Gleicher Nutzer, zweiter Tab: Liste wird in Echtzeit synchronisiert
- [ ] Konto erstellen: E-Mail + Passwort → weiterhin gleiche Daten
- [ ] Auf neuem Gerät einloggen → gleiche Liste, gleiche Kassenzettel, gleiche Auto-Reorder-Settings
- [ ] "Ohne Konto fortfahren" auf neuem Gerät → neue leere Liste
- [ ] Bestehender Nutzer (mit alten IndexedDB-Daten): App-Update → Migration läuft → Daten in Supabase → alte Liste weiterhin sichtbar
- [ ] Abmelden → wieder anmelden → Daten vorhanden
- [ ] Abhaken eines Produkts → auf zweitem Gerät sofort sichtbar

---

## Specs aktualisieren

Nach der Umsetzung:
- `specs/FEATURES-ACCOUNT.md` → Status auf "Implemented" setzen
- `specs/ARCHITECTURE.md` → Auth-Sektion updaten, IndexedDB-Rolle beschreiben
- `specs/DATA-MODEL.md` → user_id-Typen dokumentieren
- `specs/CHANGELOG.md` → Eintrag hinzufügen
- `specs/SECURITY-BACKLOG.md` → S4 (Auth) auf 🟢 Erledigt setzen
