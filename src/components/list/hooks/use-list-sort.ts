"use client";

import {
  sortAndGroupItems,
  assignPrices,
  assignThumbnails,
  assignHasAdditionalInfo,
  estimateTotal,
  VIRTUAL_GROUP_AKTIONSARTIKEL,
  type ListItemWithMeta,
  type ProductMetaForSort,
} from "@/lib/list/list-helpers";
import { getDemandGroupOrderForList } from "@/lib/store/aisle-order";
import { getHierarchicalOrder } from "@/lib/store/hierarchical-order";
import { syncPairwiseFromSupabase } from "@/lib/store/sync-pairwise-from-supabase";
import { isDeferredSpecial } from "./use-auto-reorder";
import { getSpecialActivationCalendarDate } from "@/lib/list/special-activation";
import type { SortData, SortedItems } from "./list-data-helpers";
import type { LocalListItem } from "@/lib/db";
import type { DemandGroup, SortMode } from "@/types";

// ─── Sort engine ──────────────────────────────────────────────────────

export async function sortListItems(
  items: LocalListItem[],
  sortMode: SortMode,
  effectiveStoreId: string | null,
  demandGroups: DemandGroup[],
  demandGroupMap: Map<string, DemandGroup>,
  productMetaMap: Map<string, ProductMetaForSort>,
  syncedStoreIds: { current: Set<string> },
): Promise<SortedItems> {
  const runCategorySort = async () => {
    const demandGroupOrder = await getDemandGroupOrderForList(effectiveStoreId);
    return sortAndGroupItems(items, demandGroupMap, demandGroupOrder, productMetaMap);
  };

  let u: ListItemWithMeta[];
  let c: ListItemWithMeta[];
  let d: ListItemWithMeta[];

  const isShoppingOrder = sortMode === "shopping-order" || sortMode === "shopping-order-tiles";
  if (isShoppingOrder && items.length > 0) {
    try {
      const groups = new Set<string>();
      const subgroupsByGroup = new Map<string, Set<string>>();
      const productsByScope = new Map<string, Set<string>>();
      for (const item of items) {
        const dg = demandGroupMap.get(item.demand_group_code);
        const meta = item.product_id ? productMetaMap.get(item.product_id) : null;
        const isSpecialActive = meta?.is_special && !(item as ListItemWithMeta).is_deferred;
        const group = isSpecialActive
          ? VIRTUAL_GROUP_AKTIONSARTIKEL
          : (meta?.demand_group_code ?? item.demand_group_code ?? "");
        const subgroup = isSpecialActive ? "" : (meta?.demand_sub_group ?? "");
        if (group) groups.add(group);
        if (group && subgroup) {
          if (!subgroupsByGroup.has(group)) subgroupsByGroup.set(group, new Set());
          subgroupsByGroup.get(group)!.add(subgroup);
          const scope = `${group}|${subgroup}`;
          if (!productsByScope.has(scope)) productsByScope.set(scope, new Set());
          if (item.product_id) productsByScope.get(scope)!.add(item.product_id);
        }
      }
      const defaultGroupOrder = [...demandGroups]
        .sort((a, b) => (a.sort_position ?? 999) - (b.sort_position ?? 999))
        .map((dg) => dg.code);
      if (effectiveStoreId && !syncedStoreIds.current.has(effectiveStoreId)) {
        await syncPairwiseFromSupabase(effectiveStoreId);
        syncedStoreIds.current.add(effectiveStoreId);
      }
      const order = await getHierarchicalOrder({
        storeId: effectiveStoreId,
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
      const out = sortAndGroupItems(
        items,
        demandGroupMap,
        undefined,
        productMetaMap,
        order
      );
      u = out.unchecked;
      c = out.checked;
      d = out.deferred;
      if (u.length + c.length + d.length === 0 && items.length > 0) {
        const fallback = await runCategorySort();
        u = fallback.unchecked;
        c = fallback.checked;
        d = fallback.deferred;
      }
    } catch {
      const fallback = await runCategorySort();
      u = fallback.unchecked;
      c = fallback.checked;
      d = fallback.deferred;
    }
  } else {
    const out = await runCategorySort();
    u = out.unchecked;
    c = out.checked;
    d = out.deferred;
    if (sortMode === "my-order" && u.length > 0) {
      u = [...u].sort((a, b) => (a.sort_position ?? 0) - (b.sort_position ?? 0));
    }
  }

  return { unchecked: u, checked: c, deferred: d };
}

// ─── Client-side re-sort (no network reload) ──────────────────────────

export async function resortItems(
  data: SortData,
  currentSortMode: SortMode,
  syncedStoreIds: { current: Set<string> },
): Promise<{ unchecked: ListItemWithMeta[]; checked: ListItemWithMeta[]; deferred: ListItemWithMeta[]; total: number; withoutPriceCount: number; cartTotal: number; cartWithoutPriceCount: number }> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const freshItems = data.items.map(srcItem => {
    const src = srcItem as ListItemWithMeta;
    const item: LocalListItem & Partial<ListItemWithMeta> = { ...srcItem };
    delete item.is_deferred;
    delete item.available_from;
    delete item.deferred_reason;
    delete item.is_buy_elsewhere;

    if (src.deferred_reason === "reorder") {
      item.is_deferred = src.is_deferred;
      item.available_from = src.available_from;
      item.deferred_reason = "reorder";
      return item as LocalListItem;
    }
    if (srcItem.buy_elsewhere_retailer) {
      item.is_deferred = true;
      item.deferred_reason = "elsewhere";
      item.is_buy_elsewhere = true;
      item.buy_elsewhere_retailer = srcItem.buy_elsewhere_retailer;
      item.competitor_product_id = srcItem.competitor_product_id ?? null;
      return item as LocalListItem;
    }
    if (srcItem.deferred_until && srcItem.deferred_until !== "next_trip") {
      if (srcItem.deferred_until > todayStr) {
        item.is_deferred = true;
        item.available_from = srcItem.deferred_until;
        item.deferred_reason = "manual";
      }
    } else if (srcItem.deferred_until === "next_trip") {
      item.is_deferred = true;
      item.available_from = srcItem.deferred_until;
      item.deferred_reason = "manual";
    }
    if (srcItem.product_id && !item.is_deferred) {
      const info = data.productDeferredInfo.get(srcItem.product_id);
      const saleStart = info?.special_start_date;
      if (
        info &&
        saleStart &&
        isDeferredSpecial(info.assortment_type, saleStart, info.country)
      ) {
        item.is_deferred = true;
        item.available_from = getSpecialActivationCalendarDate(saleStart) ?? saleStart;
        item.deferred_reason = "special";
      }
    }
    return item as LocalListItem;
  });
  const { unchecked: u, checked: c, deferred: d } = await sortListItems(
    freshItems, currentSortMode, data.effectiveStoreId,
    data.demandGroups, data.demandGroupMap, data.productMetaMap, syncedStoreIds,
  );
  assignPrices(u, c, data.productPriceMap, d);
  assignThumbnails(u, c, data.productThumbnailMap, d);
  assignHasAdditionalInfo(u, c, data.productIdsWithAdditionalInfo, d);
  const dNonElsewhere = d.filter(i => i.deferred_reason !== "elsewhere");
  const { total, withoutPriceCount } = estimateTotal([...u, ...c, ...dNonElsewhere]);
  const { total: cartTotal, withoutPriceCount: cartWithoutPriceCount } = estimateTotal(c);
  return { unchecked: u, checked: c, deferred: d, total, withoutPriceCount, cartTotal, cartWithoutPriceCount };
}
