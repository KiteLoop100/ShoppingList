"use client";

import { useState, useCallback, useEffect } from "react";
import { getActiveListWithItems } from "@/lib/list";
import { db } from "@/lib/db";
import { getStoreById } from "@/lib/store/store-service";
import {
  sortAndGroupItems,
  assignPrices,
  estimateTotal,
} from "@/lib/list/list-helpers";
import { getCategoryOrderForList } from "@/lib/store/aisle-order";
import { useProducts } from "@/lib/products-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import type { LocalStore, LocalCategory } from "@/lib/db";

export interface ListSummary {
  itemCount: number;
  estimatedTotal: number;
  withoutPriceCount: number;
}

export function useListSummary(): {
  summary: ListSummary | null;
  loading: boolean;
  refetch: () => Promise<void>;
  listId: string | null;
  store: LocalStore | null;
} {
  const [summary, setSummary] = useState<ListSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [listId, setListId] = useState<string | null>(null);
  const [store, setStore] = useState<LocalStore | null>(null);

  const { products: contextProducts } = useProducts();

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { list, items } = await getActiveListWithItems();
      setListId(list.list_id);
      const storeRes =
        list.store_id != null ? await getStoreById(list.store_id) : null;
      setStore(storeRes ?? null);

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
      let { unchecked, checked } = sortAndGroupItems(
        items,
        categoryMap,
        categoryOrder
      );
      assignPrices(unchecked, checked, productPriceMap);
      const all = [...unchecked, ...checked];
      const { total, withoutPriceCount } = estimateTotal(all);
      setSummary({
        itemCount: all.length,
        estimatedTotal: total,
        withoutPriceCount,
      });
    } catch {
      setSummary({ itemCount: 0, estimatedTotal: 0, withoutPriceCount: 0 });
      setListId(null);
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, [contextProducts]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary, loading, refetch, listId, store };
}
