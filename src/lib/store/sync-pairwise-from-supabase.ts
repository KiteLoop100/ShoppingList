/**
 * Lädt pairwise_comparisons für einen Store aus Supabase und ersetzt die lokale IndexedDB
 * vollständig (Full Replace). So wird die serverseitig gesetzte Reihenfolge
 * (z. B. set-store-layout-munich-richard-strauss) korrekt in der App übernommen,
 * ohne dass veraltete Einträge aus früheren Skriptläufen interferieren.
 */

import { db } from "@/lib/db";
import { createClientIfConfigured } from "@/lib/supabase/client";

let _lastSyncedStoreId: string | null = null;
let _lastSyncedAt = 0;
const SYNC_COOLDOWN_MS = 60_000;

type PairwiseRow = {
  store_id: string;
  level: string;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b_count: number;
  b_before_a_count: number;
  last_updated_at: string | null;
};

export async function syncPairwiseFromSupabase(storeId: string): Promise<void> {
  if (_lastSyncedStoreId === storeId && Date.now() - _lastSyncedAt < SYNC_COOLDOWN_MS) {
    return;
  }

  const supabase = createClientIfConfigured();
  if (!supabase) return;

  // PostgREST server-side max_rows caps each response at 1000 rows regardless of client .limit().
  // Paginate until all rows are collected.
  const PAGE_SIZE = 1000;
  const allRows: PairwiseRow[] = [];
  let from = 0;

  while (true) {
    const { data: page, error } = await supabase
      .from("pairwise_comparisons")
      .select("store_id, level, scope, item_a, item_b, a_before_b_count, b_before_a_count, last_updated_at")
      .eq("store_id", storeId)
      .range(from, from + PAGE_SIZE - 1);

    if (error || !page || page.length === 0) break;
    allRows.push(...(page as PairwiseRow[]));
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (allRows.length === 0) {
    _lastSyncedStoreId = storeId;
    _lastSyncedAt = Date.now();
    return;
  }

  const now = new Date().toISOString();

  const records = allRows.map((r) => ({
    store_id: r.store_id,
    level: r.level,
    scope: r.scope ?? null,
    item_a: r.item_a,
    item_b: r.item_b,
    a_before_b_count: r.a_before_b_count,
    b_before_a_count: r.b_before_a_count,
    last_updated_at: r.last_updated_at ?? now,
  }));

  // Full replace: delete all IDB entries for this store, then insert from Supabase.
  await db.transaction("rw", db.pairwise_comparisons, async () => {
    await db.pairwise_comparisons.where("store_id").equals(storeId).delete();
    await db.pairwise_comparisons.bulkAdd(records as never[]);
  });

  _lastSyncedStoreId = storeId;
  _lastSyncedAt = Date.now();
}
