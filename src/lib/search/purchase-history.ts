/**
 * Loads user purchase history from Supabase and populates the
 * in-memory cache used by the scoring engine and smart filter.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { setUserHistory } from "@/lib/search/local-search";
import type { UserProductPreference } from "@/lib/search/scoring-engine";
import { log } from "@/lib/utils/logger";

export async function loadPurchaseHistory(): Promise<void> {
  const supabase = createClientIfConfigured();
  if (!supabase) return;

  const userId = getCurrentUserId();
  if (!userId || userId === "anonymous") return;

  try {
    const { data, error } = await supabase.rpc("get_user_purchase_history", {
      p_user_id: userId,
    });

    if (!error && data) {
      const history: UserProductPreference[] = (data as Array<{
        product_id: string;
        purchase_count: number;
        last_purchased_at: string;
      }>).map((row) => ({
        product_id: row.product_id,
        purchase_count: Number(row.purchase_count),
        last_purchased_at: row.last_purchased_at,
      }));

      setUserHistory(history);
      console.info(`[ProductsSync] Purchase history: ${history.length} products loaded`);
      return;
    }

    log.warn("[ProductsSync] RPC unavailable, using fallback:", error?.message);
  } catch {
    log.warn("[ProductsSync] RPC call failed, using fallback");
  }

  await loadPurchaseHistoryFallback(supabase, userId);
}

async function loadPurchaseHistoryFallback(
  supabase: NonNullable<ReturnType<typeof createClientIfConfigured>>,
  userId: string,
): Promise<void> {
  const { data: trips } = await supabase
    .from("shopping_trips")
    .select("trip_id")
    .eq("user_id", userId);

  if (!trips || trips.length === 0) return;

  const tripIds = trips.map((t: { trip_id: string }) => t.trip_id);
  const { data: items } = await supabase
    .from("trip_items")
    .select("product_id, checked_at")
    .in("trip_id", tripIds)
    .not("product_id", "is", null);

  if (!items || items.length === 0) return;

  const historyMap = new Map<string, { count: number; lastAt: string }>();
  for (const item of items as Array<{ product_id: string; checked_at: string | null }>) {
    const ts = item.checked_at ?? "";
    const existing = historyMap.get(item.product_id);
    if (existing) {
      existing.count++;
      if (ts > existing.lastAt) existing.lastAt = ts;
    } else {
      historyMap.set(item.product_id, { count: 1, lastAt: ts });
    }
  }

  const history: UserProductPreference[] = [];
  for (const [productId, entry] of historyMap) {
    history.push({
      product_id: productId,
      purchase_count: entry.count,
      last_purchased_at: entry.lastAt,
    });
  }

  setUserHistory(history);
  console.info(`[ProductsSync] Purchase history (fallback): ${history.length} products loaded`);
}
