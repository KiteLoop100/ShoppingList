/**
 * Active list and list items: get-or-create list, CRUD items.
 * Uses Supabase for persistent, multi-device storage.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/generate-id";
import type { LocalListItem, LocalShoppingList } from "@/lib/db";

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
      status: existing.status,
      created_at: existing.created_at,
      completed_at: existing.completed_at ?? null,
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
    status: newList.status,
    created_at: newList.created_at,
    completed_at: newList.completed_at ?? null,
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
    category_id: row.category_id,
    added_at: row.added_at,
    deferred_until: row.deferred_until ?? null,
    buy_elsewhere_retailer: row.buy_elsewhere_retailer ?? null,
    competitor_product_id: row.competitor_product_id ?? null,
  }));
}

export interface AddItemParams {
  list_id: string;
  product_id: string | null;
  custom_name: string | null;
  display_name: string;
  category_id: string;
  quantity?: number;
  buy_elsewhere_retailer?: string | null;
  competitor_product_id?: string | null;
}

export async function addListItem(params: AddItemParams): Promise<LocalListItem> {
  const {
    list_id,
    product_id,
    custom_name,
    display_name,
    category_id,
    quantity = 1,
    buy_elsewhere_retailer = null,
    competitor_product_id = null,
  } = params;

  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const { data: existingItems } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", list_id)
    .eq("is_checked", false);

  const existing = existingItems?.find(
    (i) =>
      product_id != null
        ? i.product_id === product_id
          && (i.buy_elsewhere_retailer ?? null) === (buy_elsewhere_retailer ?? null)
        : i.product_id == null
          && i.display_name === display_name
          && (i.buy_elsewhere_retailer ?? null) === (buy_elsewhere_retailer ?? null)
  );

  if (existing) {
    const newQty = (existing.quantity ?? 1) + quantity;
    await supabase
      .from("list_items")
      .update({ quantity: newQty })
      .eq("item_id", existing.item_id);

    return {
      item_id: existing.item_id,
      list_id: existing.list_id,
      product_id: existing.product_id ?? null,
      custom_name: existing.custom_name ?? null,
      display_name: existing.display_name,
      quantity: newQty,
      is_checked: existing.is_checked,
      checked_at: existing.checked_at ?? null,
      sort_position: existing.sort_position,
      category_id: existing.category_id,
      added_at: existing.added_at,
    };
  }

  const item_id = generateId();
  const now = new Date().toISOString();
  const sort_position = -Date.now();

  const insertPayload: Record<string, unknown> = {
    item_id,
    list_id,
    product_id,
    custom_name,
    display_name,
    quantity,
    is_checked: false,
    checked_at: null,
    sort_position,
    category_id,
    added_at: now,
  };
  if (buy_elsewhere_retailer) {
    insertPayload.buy_elsewhere_retailer = buy_elsewhere_retailer;
  }
  if (competitor_product_id) {
    insertPayload.competitor_product_id = competitor_product_id;
  }

  const { data: newItem, error } = await supabase
    .from("list_items")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !newItem) {
    throw new Error(`Failed to add item: ${error?.message}`);
  }

  return {
    item_id: newItem.item_id,
    list_id: newItem.list_id,
    product_id: newItem.product_id ?? null,
    custom_name: newItem.custom_name ?? null,
    display_name: newItem.display_name,
    quantity: newItem.quantity,
    is_checked: newItem.is_checked,
    checked_at: newItem.checked_at ?? null,
    sort_position: newItem.sort_position,
    category_id: newItem.category_id,
    added_at: newItem.added_at,
  };
}

export async function updateListItem(
  itemId: string,
  updates: {
    quantity?: number;
    is_checked?: boolean;
    checked_at?: string | null;
    product_id?: string | null;
    display_name?: string;
    custom_name?: string | null;
    category_id?: string;
    deferred_until?: string | null;
    buy_elsewhere_retailer?: string | null;
    competitor_product_id?: string | null;
  }
): Promise<void> {
  const supabase = createClientIfConfigured();
  if (!supabase) return;

  const updatePayload: Record<string, unknown> = {};
  if (updates.quantity !== undefined) updatePayload.quantity = updates.quantity;
  if (updates.is_checked !== undefined) updatePayload.is_checked = updates.is_checked;
  if (updates.checked_at !== undefined) updatePayload.checked_at = updates.checked_at;
  if (updates.product_id !== undefined) updatePayload.product_id = updates.product_id;
  if (updates.display_name !== undefined) updatePayload.display_name = updates.display_name;
  if (updates.custom_name !== undefined) updatePayload.custom_name = updates.custom_name;
  if (updates.category_id !== undefined) updatePayload.category_id = updates.category_id;
  if (updates.deferred_until !== undefined) updatePayload.deferred_until = updates.deferred_until;
  if (updates.buy_elsewhere_retailer !== undefined) updatePayload.buy_elsewhere_retailer = updates.buy_elsewhere_retailer;
  if (updates.competitor_product_id !== undefined) updatePayload.competitor_product_id = updates.competitor_product_id;

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from("list_items").update(updatePayload).eq("item_id", itemId);
    if (error) throw new Error(`updateListItem failed: ${error.message}`);
  }
}

export async function deleteListItem(itemId: string): Promise<void> {
  const supabase = createClientIfConfigured();
  if (!supabase) return;

  await supabase.from("list_items").delete().eq("item_id", itemId);
}

export async function getActiveListWithItems(): Promise<{
  list: LocalShoppingList;
  items: LocalListItem[];
}> {
  const list = await getOrCreateActiveList();
  const items = await getListItems(list.list_id);
  return { list, items };
}
