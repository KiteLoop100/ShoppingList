# FEATURES-ACCOUNT.md – Account, Auth & Multi-Device (F17)

> User accounts with email/password login, multi-device sync via Supabase Auth,
> shared family usage (one account, multiple devices), migration from IndexedDB to Supabase.

---

## 1. Overview

| Aspect | Value |
|--------|-------|
| **Feature ID** | F17 |
| **Phase** | Pre-Launch (required before Friendly User Test) |
| **Dependencies** | None (foundational) |
| **Enables** | RLS, Storage security, Rate-Limiting, Shared Lists (later) |

### Goals

1. Users can create an account (email + password) and log in on multiple devices
2. A family can share one account → same shopping list on all devices
3. Shopping list data lives in Supabase (not just IndexedDB) for real-time sync
4. `auth.uid()` replaces `getDeviceUserId()` → enables proper Row-Level Security
5. Existing single-device users can continue using the app anonymously, then optionally upgrade to a full account

---

## 2. Auth Model

### 2.1 Anonymous-First → Optional Registration

```
First App Start
    │
    ▼
signInAnonymously()  ──→  Supabase creates auth.user with UUID
    │                       localStorage stores session token
    │                       App works immediately (no sign-up wall)
    ▼
User can optionally:
    │
    ├── Continue anonymously (forever)
    │
    └── Create account (email + password)
        └── linkIdentity() merges anonymous user into registered user
            └── Same UUID, same data, now accessible from other devices
```

### 2.2 Login Flow

```
Returning User (new device or cleared cache)
    │
    ▼
Login Screen  ──→  signInWithPassword(email, password)
    │                 │
    │                 ▼
    │            Session restored → list, receipts, auto-reorder visible
    │
    └── "Ohne Konto fortfahren" → signInAnonymously() (new empty user)
```

### 2.3 Session Persistence

- Supabase JS client handles session tokens automatically (`localStorage`)
- Session refresh via refresh token (auto)
- Logout clears session but data remains in Supabase (accessible after re-login)

---

## 3. Data Migration: IndexedDB → Supabase

### 3.1 What Moves to Supabase

| Data | Currently | After Migration |
|------|-----------|-----------------|
| `lists` (active shopping list) | IndexedDB | Supabase `shopping_lists` |
| `list_items` | IndexedDB | Supabase `list_items` |
| `trips` (shopping history) | IndexedDB | Supabase `shopping_trips` |
| `trip_items` | IndexedDB | Supabase `trip_items` |
| `preferences` (user product prefs) | IndexedDB | Supabase `user_product_preferences` |
| `receipts`, `receipt_items` | Supabase (already) | Supabase (no change) |
| `auto_reorder_settings` | Supabase (already) | Supabase (no change) |

### 3.2 What Stays Local

| Data | Reason |
|------|--------|
| `products` (product catalog) | Read-only reference data, cached locally for performance |
| `categories` | Read-only reference data |
| `stores` | Read-only reference data |
| `aisle_orders`, `aggregated` | Read-only, store-specific |
| `pairwise_comparisons`, `checkoff_sequences` | Write-back to Supabase via API, local copy for offline (later) |
| `offline_queue` | Local queue for offline sync (Phase 2) |

### 3.3 Settings Sync

Settings (language, default store, dietary exclusions, product preferences) are now stored in Supabase `user_settings` table and synced across devices. localStorage serves as a fast synchronous cache. See FEATURES-CORE.md § F12 "Settings Sync" for details.

### 3.4 One-Time Migration Flow

When an existing user (pre-account feature) opens the updated app:

```
App Start
    │
    ▼
Check: Is there a Supabase Auth session?
    │
    ├── YES → Normal flow (already migrated)
    │
    └── NO → Check: Does localStorage have old device-id?
              │
              ├── YES → Old user with local data
              │    │
              │    ▼
              │  signInAnonymously() → new auth.uid()
              │    │
              │    ▼
              │  Read all data from IndexedDB (lists, items, trips, preferences)
              │    │
              │    ▼
              │  Write to Supabase with new auth.uid()
              │    │
              │    ▼
              │  Migrate existing Supabase data (receipts, auto_reorder_settings):
              │    UPDATE receipts SET user_id = auth.uid() WHERE user_id = old_device_id
              │    UPDATE auto_reorder_settings SET user_id = auth.uid() WHERE user_id = old_device_id
              │    │
              │    ▼
              │  Mark migration complete (localStorage flag)
              │    │
              │    ▼
              │  Delete old IndexedDB data (optional, after confirmation)
              │
              └── NO → New user
                   │
                   ▼
                 signInAnonymously() → empty state
```

### 3.5 Schema Adjustments

The existing `shopping_lists`, `list_items`, `shopping_trips`, `trip_items`, `user_product_preferences` tables in Supabase reference `users.user_id` as UUID with FK constraint. Since the app never writes to these tables yet, no data migration in Supabase is needed — only the app code changes to write there.

The `receipts` and `auto_reorder_settings` tables currently use `user_id TEXT` (device ID string). These need a migration:

```sql
-- Change user_id from TEXT to UUID, matching auth.users(id)
ALTER TABLE receipts ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
-- This will fail for non-UUID device IDs → needs migration script first

-- Alternative: Keep TEXT but update values via migration code
-- (Recommended: handle in application code during one-time migration)
```

**Decision: Keep `user_id` as TEXT** in `receipts` and `auto_reorder_settings` (simpler). The migration code updates the values from old device-ID to new `auth.uid()` (which is a UUID string). Later, when cleaning up, these can be changed to UUID type.

---

## 4. Supabase Realtime Sync

### 4.1 Why Realtime

With the shopping list in Supabase, multiple devices can modify it. Without Realtime, changes would only appear on page refresh. With Supabase Realtime, changes appear instantly:

- Partner A adds "Milch" on phone → Partner B sees it on tablet within ~1 second
- Partner A checks off "Butter" → disappears on Partner B's screen instantly

### 4.2 Implementation

```typescript
// Subscribe to list item changes for the active list
const channel = supabase
  .channel(`list-${activeListId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'list_items',
      filter: `list_id=eq.${activeListId}`,
    },
    (payload) => {
      // INSERT → add item to local state
      // UPDATE → update item in local state (check-off, quantity)
      // DELETE → remove item from local state
    }
  )
  .subscribe();
```

### 4.3 Conflict Resolution

- **Last-write-wins** per field (Supabase default)
- Both devices add the same product → two items appear (user can merge manually)
- Both devices check off the same item → no conflict (idempotent)
- One device deletes, other edits → delete wins (item gone)

---

## 5. UI Changes

### 5.1 Settings Page — New "Account" Section (top of page)

```
┌─────────────────────────────────────────┐
│ 👤 Konto                                │
│                                         │
│ Angemeldet als: peter@example.com       │
│                                         │
│ [Abmelden]                              │
│                                         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ Geräte: 2 verbunden                     │
│ Zuletzt: iPhone (vor 3 Min.)            │
└─────────────────────────────────────────┘
```

For anonymous users:

```
┌─────────────────────────────────────────┐
│ 👤 Konto                                │
│                                         │
│ Du nutzt die App ohne Konto.            │
│ Erstelle ein Konto, um deine Daten      │
│ auf mehreren Geräten zu nutzen.         │
│                                         │
│ [Anmelden oder Konto erstellen]         │
└─────────────────────────────────────────┘
```

### 5.2 Login / Registration Screen

Accessible via:
- Settings → "Anmelden oder Konto erstellen" (for anonymous users)
- App start on a new device (if no session)

```
┌─────────────────────────────────────────┐
│                                         │
│         🛒 Digital Shopping List        │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ E-Mail                            │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Passwort                          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Anmelden]                             │
│  [Konto erstellen]                      │
│                                         │
│  ──── oder ────                         │
│                                         │
│  [Ohne Konto fortfahren]                │
│                                         │
│  Passwort vergessen?                    │
└─────────────────────────────────────────┘
```

### 5.3 Header — No Visual Change

The header does not show login status. Account management is in Settings only.

---

## 6. Affected Files

### New Files

| File | Purpose |
|------|---------|
| `src/lib/auth/auth-context.tsx` | AuthProvider with session state, login/logout/register functions |
| `src/lib/auth/auth-helpers.ts` | `getCurrentUserId()` (replaces `getDeviceUserId()`), migration logic |
| `src/app/[locale]/login/page.tsx` | Login / Registration page |
| `supabase/migrations/YYYYMMDD_auth_migration.sql` | RLS policy updates, any schema changes |
| `src/lib/settings/settings-sync.ts` | Cross-device settings sync (Supabase `user_settings` + localStorage cache) |
| `supabase/migrations/20260227200000_user_settings.sql` | `user_settings` table with RLS |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/list/device-id.ts` | Deprecated → replaced by `auth-helpers.ts` |
| `src/lib/list/active-list.ts` | IndexedDB → Supabase queries |
| `src/lib/list/recent-list-products.ts` | Use `getCurrentUserId()` |
| `src/lib/list/typical-products.ts` | IndexedDB trips → Supabase trips |
| `src/lib/list/last-trip.ts` | IndexedDB → Supabase |
| `src/components/list/use-list-data.ts` | Supabase queries + Realtime subscription |
| `src/components/list/product-detail-modal.tsx` | Use `getCurrentUserId()` |
| `src/app/[locale]/capture/receipt-scanner.tsx` | Use `getCurrentUserId()`, auth header |
| `src/app/[locale]/receipts/page.tsx` | Use `getCurrentUserId()` |
| `src/app/api/upload-receipt-photo/route.ts` | Read user from auth token |
| `src/app/api/process-receipt/route.ts` | Read user from auth token |
| `src/app/[locale]/settings/settings-client.tsx` | Account section + settings sync on load |
| `src/lib/settings/product-preferences.ts` | Writes now sync to Supabase via settings-sync |
| `src/lib/settings/default-store.ts` | Writes now sync to Supabase via settings-sync |
| `src/lib/supabase/client.ts` | Auth session handling |
| `src/messages/de.json` / `en.json` | Account-related translation keys |
| `src/app/[locale]/layout.tsx` | Wrap in AuthProvider |

---

## 7. Deployment Considerations

- **Supabase Auth must be configured:** Enable email/password provider in Supabase Dashboard → Authentication → Providers
- **Email confirmation:** Disable for Friendly User Test (simpler onboarding). Enable later.
- **Anonymous Auth:** Enable in Supabase Dashboard → Authentication → Settings → "Enable anonymous sign-ins"
- **Realtime:** Enabled by default in Supabase. No extra config needed.

---

## 8. Future: Shared Lists (F16)

Not part of this feature. Current scope is: one account = one list = shared across devices.

Shared lists (multiple accounts seeing the same list) will be a separate feature with:
- `list_members` table (many-to-many: users ↔ lists)
- Invite flow (share link or email invite)
- Per-item "added by" attribution
- RLS policies for shared access

---

*Created: 2026-02-25*
*Status: Planned — Pre-Launch*
