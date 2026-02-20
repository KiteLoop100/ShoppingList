/**
 * Active list and list items: get-or-create list, CRUD items.
 * Uses IndexedDB (Dexie) for offline-first storage.
 */

import { db } from "@/lib/db";
import type { ListItem, ShoppingList } from "@/types";
import type { LocalListItem, LocalShoppingList } from "@/lib/db";
import { getDeviceUserId } from "./device-id";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export async function getOrCreateActiveList(): Promise<LocalShoppingList> {
  const user_id = getDeviceUserId();
  const all = await db.lists.where("user_id").equals(user_id).toArray();
  const existing = all.find((l) => l.status === "active");
  if (existing) return existing;

  const list_id = generateId();
  const now = new Date().toISOString();
  const list: LocalShoppingList = {
    list_id,
    user_id,
    store_id: null,
    status: "active",
    created_at: now,
    completed_at: null,
  };
  await db.lists.add(list as never);
  return list;
}

export async function getListItems(listId: string): Promise<LocalListItem[]> {
  const items = await db.list_items.where("list_id").equals(listId).toArray();
  return items;
}

export interface AddItemParams {
  list_id: string;
  product_id: string | null;
  custom_name: string | null;
  display_name: string;
  category_id: string;
  quantity?: number;
}

export async function addListItem(params: AddItemParams): Promise<LocalListItem> {
  const {
    list_id,
    product_id,
    custom_name,
    display_name,
    category_id,
    quantity = 1,
  } = params;
  const item_id = generateId();
  const now = new Date().toISOString();
  const sort_position = Date.now();
  const item: LocalListItem = {
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
  await db.list_items.add(item as never);
  return item;
}

export async function updateListItem(
  itemId: string,
  updates: {
    quantity?: number;
    is_checked?: boolean;
    checked_at?: string | null;
  }
): Promise<void> {
  const item = await db.list_items.where("item_id").equals(itemId).first();
  if (!item) return;
  if (updates.quantity !== undefined) item.quantity = updates.quantity;
  if (updates.is_checked !== undefined) item.is_checked = updates.is_checked;
  if (updates.checked_at !== undefined) item.checked_at = updates.checked_at;
  await db.list_items.put(item as never);
}

export async function deleteListItem(itemId: string): Promise<void> {
  await db.list_items.where("item_id").equals(itemId).delete();
}

export async function getActiveListWithItems(): Promise<{
  list: LocalShoppingList;
  items: LocalListItem[];
}> {
  const list = await getOrCreateActiveList();
  const items = await getListItems(list.list_id);
  return { list, items };
}
