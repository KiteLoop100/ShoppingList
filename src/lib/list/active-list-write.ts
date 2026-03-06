/**
 * Write operations for shopping list items: add, update, delete, batch-add.
 * Read operations remain in ./active-list.ts.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/generate-id";
import type { LocalListItem } from "@/lib/db";

export interface AddItemParams {
  list_id: string;
  product_id: string | null;
  custom_name: string | null;
  display_name: string;
  demand_group_code: string;
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
    demand_group_code,
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
      demand_group_code: existing.demand_group_code ?? demand_group_code,
      added_at: existing.added_at,
    };
  }

  const item_id = generateId();
  const now = new Date().toISOString();
  const sort_position = -Date.now();

  const insertPayload = {
    item_id,
    list_id,
    product_id,
    custom_name,
    display_name,
    quantity,
    is_checked: false,
    checked_at: null as string | null,
    sort_position,
    demand_group_code,
    added_at: now,
    ...(buy_elsewhere_retailer ? { buy_elsewhere_retailer } : {}),
    ...(competitor_product_id ? { competitor_product_id } : {}),
  };

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
    demand_group_code: newItem.demand_group_code ?? demand_group_code,
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
    demand_group_code?: string;
    deferred_until?: string | null;
    buy_elsewhere_retailer?: string | null;
    competitor_product_id?: string | null;
    comment?: string | null;
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
  if (updates.demand_group_code !== undefined) updatePayload.demand_group_code = updates.demand_group_code;
  if (updates.deferred_until !== undefined) updatePayload.deferred_until = updates.deferred_until;
  if (updates.buy_elsewhere_retailer !== undefined) updatePayload.buy_elsewhere_retailer = updates.buy_elsewhere_retailer;
  if (updates.competitor_product_id !== undefined) updatePayload.competitor_product_id = updates.competitor_product_id;
  if (updates.comment !== undefined) updatePayload.comment = updates.comment;

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

export async function addListItemsBatch(
  paramsList: AddItemParams[]
): Promise<LocalListItem[]> {
  if (paramsList.length === 0) return [];
  if (paramsList.length === 1) return [await addListItem(paramsList[0])];

  const supabase = createClientIfConfigured();
  if (!supabase) throw new Error("Supabase not configured");

  const listId = paramsList[0].list_id;

  const { data: existingItems } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", listId)
    .eq("is_checked", false);

  const results: LocalListItem[] = [];
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { item_id: string; quantity: number }[] = [];

  for (const params of paramsList) {
    const {
      product_id,
      custom_name,
      display_name,
      demand_group_code,
      quantity = 1,
      buy_elsewhere_retailer = null,
      competitor_product_id = null,
    } = params;

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
      toUpdate.push({ item_id: existing.item_id, quantity: newQty });
      results.push({
        item_id: existing.item_id,
        list_id: existing.list_id,
        product_id: existing.product_id ?? null,
        custom_name: existing.custom_name ?? null,
        display_name: existing.display_name,
        quantity: newQty,
        is_checked: existing.is_checked,
        checked_at: existing.checked_at ?? null,
        sort_position: existing.sort_position,
        demand_group_code: existing.demand_group_code ?? demand_group_code,
        added_at: existing.added_at,
      });
    } else {
      const item_id = generateId();
      const now = new Date().toISOString();
      const sort_position = -Date.now();
      const insertPayload = {
        item_id,
        list_id: listId,
        product_id,
        custom_name,
        display_name,
        quantity,
        is_checked: false,
        checked_at: null as string | null,
        sort_position,
        demand_group_code,
        added_at: now,
        ...(buy_elsewhere_retailer ? { buy_elsewhere_retailer } : {}),
        ...(competitor_product_id ? { competitor_product_id } : {}),
      };
      toInsert.push(insertPayload);
      results.push({
        item_id,
        list_id: listId,
        product_id: product_id ?? null,
        custom_name: custom_name ?? null,
        display_name,
        quantity,
        is_checked: false,
        checked_at: null,
        sort_position,
        demand_group_code,
        added_at: now,
      });
    }
  }

  const promises: Promise<void>[] = [];
  if (toInsert.length > 0) {
    promises.push(
      (async () => {
        const { error } = await supabase.from("list_items").insert(toInsert);
        if (error) throw new Error(`Batch insert failed: ${error.message}`);
      })()
    );
  }
  for (const u of toUpdate) {
    promises.push(
      (async () => {
        await supabase.from("list_items").update({ quantity: u.quantity }).eq("item_id", u.item_id);
      })()
    );
  }
  await Promise.all(promises);

  return results;
}
