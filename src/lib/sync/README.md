# Sync module

Bidirectional sync with Supabase, offline queue processing. Not yet implemented as a dedicated module.

Sync-related logic currently lives in individual service files:
- `src/lib/products-context.tsx` – product delta-sync (IndexedDB cache + Supabase)
- `src/lib/store/sync-pairwise-from-supabase.ts` – aisle order sync
- `src/lib/settings/settings-sync.ts` – settings sync
- `src/lib/list/active-list.ts` – list item CRUD with Supabase writes

## Product Delta-Sync

`products-context.tsx` implements a two-phase sync strategy:

1. **Instant startup** – `loadFromCache(country)` reads from IndexedDB immediately on mount.
2. **Background refresh** – `deltaSync(country)` fetches only rows with `updated_at > lastSync` from Supabase, writes them to IndexedDB, and returns the full updated list.

The `products-last-sync-{country}` key in `localStorage` tracks the last successful sync timestamp.

### Stale-state guard
If IndexedDB is empty but `products-last-sync-{country}` exists (e.g. after a schema upgrade that wiped IndexedDB), `syncProducts()` clears the stale timestamp before calling `deltaSync()`. This forces a full load instead of a no-op incremental query.
