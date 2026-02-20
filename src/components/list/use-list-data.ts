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
  sortAndGroupItemsHierarchical,
  assignPrices,
  estimateTotal,
  type ListItemWithMeta,
  type ProductMetaForSort,
} from "@/lib/list/list-helpers";
import { getCategoryOrderForList } from "@/lib/store/aisle-order";
import { getHierarchicalOrder } from "@/lib/store/hierarchical-order";
import { useProducts } from "@/lib/products-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import type { LocalCategory } from "@/lib/db";
import type { SortMode } from "@/components/list/sort-mode-tabs";

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

export function useListData(sortMode: SortMode = "my-order"): UseListDataResult {
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
      const productMetaMap = new Map<string, ProductMetaForSort>();
      for (const p of idbProducts) {
        if (p.price != null) productPriceMap.set(p.product_id, p.price);
        productMetaMap.set(p.product_id, {
          demand_group: p.demand_group ?? null,
          demand_sub_group: p.demand_sub_group ?? null,
          popularity_score: p.popularity_score ?? null,
        });
      }
      for (const p of contextProducts) {
        if (p.price != null) productPriceMap.set(p.product_id, p.price);
        if (!productMetaMap.has(p.product_id)) {
          productMetaMap.set(p.product_id, {
            demand_group: p.demand_group ?? null,
            demand_sub_group: p.demand_sub_group ?? null,
            popularity_score: p.popularity_score ?? null,
          });
        }
      }

      let u: ListItemWithMeta[];
      let c: ListItemWithMeta[];

      if (sortMode === "shopping-order" && items.length > 0) {
        const groups = new Set<string>();
        const subgroupsByGroup = new Map<string, Set<string>>();
        const productsByScope = new Map<string, Set<string>>();
        for (const item of items) {
          const cat = categoryMap.get(item.category_id);
          const meta = item.product_id ? productMetaMap.get(item.product_id) : null;
          const group = meta?.demand_group ?? cat?.name ?? "";
          const subgroup = meta?.demand_sub_group ?? "";
          if (group) groups.add(group);
          if (group && subgroup) {
            if (!subgroupsByGroup.has(group)) subgroupsByGroup.set(group, new Set());
            subgroupsByGroup.get(group)!.add(subgroup);
            const scope = `${group}|${subgroup}`;
            if (!productsByScope.has(scope)) productsByScope.set(scope, new Set());
            if (item.product_id) productsByScope.get(scope)!.add(item.product_id);
          }
        }
        const defaultGroupOrder = [...categories]
          .sort((a, b) => (a.default_sort_position ?? 999) - (b.default_sort_position ?? 999))
          .map((cat) => cat.name);
        const order = await getHierarchicalOrder({
          storeId: list.store_id,
          groups: [...groups],
          subgroupsByGroup: new Map(
            [...subgroupsByGroup].map(([g, set]) => [g, [...set]])
          ),
          productsByScope: new Map(
            [...productsByScope].map(([s, set]) => [s, [...set]])
          ),
          defaultGroupOrder,
          defaultSubgroupOrder: (group) => {
            const subs = subgroupsByGroup.get(group);
            return subs ? [...subs].sort((a, b) => a.localeCompare(b)) : [];
          },
          defaultProductOrder: (scope) => {
            const pids = productsByScope.get(scope);
            if (!pids) return [];
            return [...pids].sort((a, b) => {
              const pa = productMetaMap.get(a)?.popularity_score ?? 0;
              const pb = productMetaMap.get(b)?.popularity_score ?? 0;
              return (pb ?? 0) - (pa ?? 0);
            });
          },
        });
        const out = sortAndGroupItemsHierarchical(
          items,
          categoryMap,
          productMetaMap,
          order
        );
        u = out.unchecked;
        c = out.checked;
      } else {
        const categoryOrder = await getCategoryOrderForList(list.store_id);
        const out = sortAndGroupItems(items, categoryMap, categoryOrder);
        u = out.unchecked;
        c = out.checked;
      }

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
  }, [contextProducts, sortMode]);

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
