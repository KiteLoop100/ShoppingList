/**
 * Active list read operations: get-or-create list, fetch items.
 * Write operations live in ./active-list-write.ts and are re-exported below.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/generate-id";
import type { LocalListItem, LocalShoppingList } from "@/lib/db";
import type { ListStatus } from "@/types";

export async function getOrCreateActiveList(): Promise<LocalShoppingList> {
  const supabase = createClientIfConfigured();

  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  // Always use the live session user ID so the value matches auth.uid() in RLS,
  // even when the cached getCurrentUserId() is not yet populated (race condition on startup).
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: existingRows } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const existing = existingRows?.[0] ?? null;

  if (existing) {
    return {
      list_id: existing.list_id,
      user_id: existing.user_id,
      store_id: existing.store_id ?? null,
      status: existing.status as ListStatus,
      created_at: existing.created_at,
      completed_at: existing.completed_at ?? null,
      notes: existing.notes ?? null,
    };
  }

  const list_id = generateId();
  const now = new Date().toISOString();

  const { data: newList, error } = await supabase
    .from("shopping_lists")
    .insert({
      list_id,
      user_id: userId,
      store_id: null,
      status: "active",
      created_at: now,
    })
    .select()
    .single();

  if (error || !newList) {
    throw new Error(`Failed to create list: ${error?.message}`);
  }

  return {
    list_id: newList.list_id,
    user_id: newList.user_id,
    store_id: newList.store_id ?? null,
    status: newList.status as ListStatus,
    created_at: newList.created_at,
    completed_at: newList.completed_at ?? null,
    notes: newList.notes ?? null,
  };
}

export async function getListItems(listId: string): Promise<LocalListItem[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const { data } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", listId);

  if (!data) return [];

  return data.map((row) => ({
    item_id: row.item_id,
    list_id: row.list_id,
    product_id: row.product_id ?? null,
    custom_name: row.custom_name ?? null,
    display_name: row.display_name,
    quantity: row.quantity,
    is_checked: row.is_checked,
    checked_at: row.checked_at ?? null,
    sort_position: row.sort_position,
    demand_group_code: row.demand_group_code ?? "AK",
    added_at: row.added_at,
    deferred_until: row.deferred_until ?? null,
    buy_elsewhere_retailer: row.buy_elsewhere_retailer ?? null,
    competitor_product_id: row.competitor_product_id ?? null,
    comment: row.comment ?? null,
  }));
}

let cachedActiveListId: string | null = null;

export async function getActiveListWithItems(): Promise<{
  list: LocalShoppingList;
  items: LocalListItem[];
}> {
  if (cachedActiveListId) {
    const previousId = cachedActiveListId;
    const [list, items] = await Promise.all([
      getOrCreateActiveList(),
      getListItems(previousId),
    ]);
    cachedActiveListId = list.list_id;
    if (list.list_id !== previousId) {
      const freshItems = await getListItems(list.list_id);
      return { list, items: freshItems };
    }
    return { list, items };
  }
  const list = await getOrCreateActiveList();
  cachedActiveListId = list.list_id;
  const items = await getListItems(list.list_id);
  return { list, items };
}

// Re-export write operations so existing imports from this module continue to work
export {
  addListItem,
  updateListItem,
  deleteListItem,
  addListItemsBatch,
  updateShoppingListNotes,
} from "./active-list-write";
export type { AddItemParams } from "./active-list-write";
