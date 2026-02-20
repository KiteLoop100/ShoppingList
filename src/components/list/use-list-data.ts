"use client";

import { useState, useCallback, useEffect } from "react";
import { db } from "@/lib/db";
import {
  getActiveListWithItems,
  updateListItem,
  deleteListItem,
} from "@/lib/list";
import {
  sortAndGroupItems,
  assignPrices,
  estimateTotal,
  type ListItemWithMeta,
} from "@/lib/list/list-helpers";
import { getCategoryOrderForList } from "@/lib/store/aisle-order";
import { useProducts } from "@/lib/products-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import type { LocalCategory } from "@/lib/db";

export interface UseListDataResult {
  listId: string | null;
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  total: number;
  withoutPriceCount: number;
  loading: boolean;
  refetch: () => Promise<void>;
  setItemChecked: (itemId: string, checked: boolean) => Promise<void>;
  setItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

export function useListData(): UseListDataResult {
  const { products: contextProducts } = useProducts();
  const [listId, setListId] = useState<string | null>(null);
  const [unchecked, setUnchecked] = useState<ListItemWithMeta[]>([]);
  const [checked, setChecked] = useState<ListItemWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [withoutPriceCount, setWithoutPriceCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { list, items } = await getActiveListWithItems();
      setListId(list.list_id);

      let categories: LocalCategory[] = await db.categories.toArray();
      const supabase = createClientIfConfigured();
      if (supabase) {
        const { data: supabaseCats } = await supabase.from("categories").select("category_id, name, name_translations, icon, default_sort_position");
        if (supabaseCats?.length) {
          const idSet = new Set(categories.map((c) => c.category_id));
          for (const row of supabaseCats) {
            const id = String(row.category_id);
            if (!idSet.has(id)) {
              idSet.add(id);
              categories.push({
                category_id: id,
                name: String(row.name),
                name_translations: (row.name_translations as Record<string, string>) ?? {},
                icon: String(row.icon ?? "📦"),
                default_sort_position: Number(row.default_sort_position ?? 999),
              });
            }
          }
        }
      }

      const categoryMap = new Map(categories.map((c) => [c.category_id, c]));

      const idbProducts = await db.products.toArray();
      const productPriceMap = new Map<string, number>();
      for (const p of idbProducts) {
        if (p.price != null) productPriceMap.set(p.product_id, p.price);
      }
      for (const p of contextProducts) {
        if (p.price != null) productPriceMap.set(p.product_id, p.price);
      }

      const categoryOrder = await getCategoryOrderForList(list.store_id);
      let { unchecked: u, checked: c } = sortAndGroupItems(
        items,
        categoryMap,
        categoryOrder
      );
      assignPrices(u, c, productPriceMap);
      setUnchecked(u);
      setChecked(c);

      const all = [...u, ...c];
      const { total: t, withoutPriceCount: w } = estimateTotal(all);
      setTotal(t);
      setWithoutPriceCount(w);
    } finally {
      setLoading(false);
    }
  }, [contextProducts]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setItemChecked = useCallback(
    async (itemId: string, isChecked: boolean) => {
      await updateListItem(itemId, {
        is_checked: isChecked,
        checked_at: isChecked ? new Date().toISOString() : null,
      });
      await refetch();
    },
    [refetch]
  );

  const setItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return;
      await updateListItem(itemId, { quantity });
      await refetch();
    },
    [refetch]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await deleteListItem(itemId);
      await refetch();
    },
    [refetch]
  );

  return {
    listId,
    unchecked,
    checked,
    total,
    withoutPriceCount,
    loading,
    refetch,
    setItemChecked,
    setItemQuantity,
    removeItem,
  };
}
