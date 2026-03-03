# Sync module

Bidirectional sync with Supabase, offline queue processing. Not yet implemented as a dedicated module.

Sync-related logic currently lives in individual service files:
- `src/lib/store/sync-pairwise-from-supabase.ts` – aisle order sync
- `src/lib/settings/settings-sync.ts` – settings sync
- `src/lib/list/active-list.ts` – list item CRUD with Supabase writes
