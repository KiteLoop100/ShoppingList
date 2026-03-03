"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { log } from "@/lib/utils/logger";
import { setDemandGroups } from "@/lib/search/local-search";
import { db } from "@/lib/db";
import {
  getActiveListWithItems,
  addListItem,
  updateListItem,
  deleteListItem,
} from "@/lib/list";
import { recordCompetitorPurchase } from "@/lib/competitor-products/competitor-product-service";
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
import { useProducts } from "@/lib/products-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-context";
import { getStoreById } from "@/lib/store/store-service";
import { getDefaultStoreId } from "@/lib/settings/default-store";
import { fetchDemandGroupsFromSupabase, toDemandGroups } from "@/lib/categories/category-service";
import {
  fetchActiveAutoReorderSettings,
  touchAutoReorderOnCheckoff,
  type AutoReorderSetting,
} from "@/lib/list/auto-reorder-service";
import type { LocalDemandGroup, LocalListItem, LocalShoppingList, LocalStore } from "@/lib/db";
import type { DemandGroup, Product, SortMode, AssortmentType } from "@/types";

export type { AutoReorderSetting } from "@/lib/list/auto-reorder-service";

const COUNTRY_TZ: Record<string, string> = {
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
};

/**
 * Compute the activation timestamp for a deferred special:
 * day before special_start_date at 15:00 local time (CET/CEST).
 * Returns a UTC millisecond timestamp.
 */
function computeActivationTime(specialStartDate: string, country: string): number {
  const tz = COUNTRY_TZ[country] || "Europe/Berlin";
  const [y, m, d] = specialStartDate.split("-").map(Number);
  const dayBefore = new Date(Date.UTC(y, m - 1, d));
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  // Start with 14:00 UTC (= 15:00 CET, close enough as initial guess)
  const guessUtc = Date.UTC(
    dayBefore.getUTCFullYear(), dayBefore.getUTCMonth(), dayBefore.getUTCDate(),
    14, 0, 0
  );
  // Determine actual local hour at our guess time to find the real offset
  const localHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hour12: false,
  }).format(new Date(guessUtc));
  const localHour = parseInt(localHourStr, 10);
  // Adjust so local hour becomes exactly 15
  return guessUtc - (localHour - 15) * 3_600_000;
}

function isDeferredSpecial(
  assortmentType: AssortmentType | string | undefined,
  specialStartDate: string | null | undefined,
  country: string
): boolean {
  if (
    assortmentType !== "special" &&
    assortmentType !== "special_food" &&
    assortmentType !== "special_nonfood"
  ) return false;
  if (!specialStartDate) return false;
  const activationMs = computeActivationTime(specialStartDate, country);
  return Date.now() < activationMs;
}

function computeReorderActivationDate(
  lastCheckedAt: string,
  value: number,
  unit: "days" | "weeks" | "months"
): string {
  const d = new Date(lastCheckedAt);
  if (unit === "days") d.setDate(d.getDate() + value);
  else if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d.toISOString().slice(0, 10);
}

export interface UseListDataResult {
  listId: string | null;
  store: LocalStore | null;
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  total: number;
  withoutPriceCount: number;
  loading: boolean;
  /** The sort mode that was used to produce the current unchecked/checked/deferred arrays. */
  dataSortMode: SortMode;
  refetch: (opts?: { forceReorder?: boolean }) => Promise<void>;
  setItemChecked: (itemId: string, checked: boolean) => Promise<void>;
  setItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  deferItem: (itemId: string) => Promise<void>;
  undeferItem: (itemId: string) => Promise<void>;
  setBuyElsewhere: (itemId: string, retailer: string) => Promise<void>;
}

// ─── Helper types & functions for decomposed refetch ──────────────────

interface ListDataCaches {
  demandGroupsCache: { current: DemandGroup[] | null };
  autoReorderCache: { current: AutoReorderSetting[] | null };
  idbProductsCache: { current: Product[] | null };
}

interface FetchedListData {
  list: LocalShoppingList;
  items: LocalListItem[];
  idbProducts: Product[];
  demandGroups: DemandGroup[];
  demandGroupMap: Map<string, DemandGroup>;
  reorderMap: Map<string, AutoReorderSetting>;
  storeResult: LocalStore | null;
}

async function fetchListData(caches: ListDataCaches): Promise<FetchedListData> {
  const shouldFetchDemandGroups = caches.demandGroupsCache.current === null;
  const shouldFetchReorder = caches.autoReorderCache.current === null;
  const shouldFetchIdbProducts = caches.idbProductsCache.current === null;

  const [listResult, idbProductsResult, reorderRows, idbDgs, dgRows] = await Promise.all([
    getActiveListWithItems(),
    shouldFetchIdbProducts ? db.products.toArray() : Promise.resolve([] as Product[]),
    shouldFetchReorder ? fetchActiveAutoReorderSettings() : Promise.resolve(null),
    shouldFetchDemandGroups ? db.demand_groups.toArray() : Promise.resolve([] as LocalDemandGroup[]),
    shouldFetchDemandGroups ? fetchDemandGroupsFromSupabase() : Promise.resolve(null),
  ]);

  const { list, items } = listResult;

  const idbProducts = caches.idbProductsCache.current ?? idbProductsResult;
  if (caches.idbProductsCache.current === null) {
    caches.idbProductsCache.current = idbProducts;
  }

  const storeResult = list.store_id != null
    ? await getStoreById(list.store_id)
    : null;

  let demandGroups: DemandGroup[];
  if (caches.demandGroupsCache.current) {
    demandGroups = caches.demandGroupsCache.current;
  } else {
    demandGroups = idbDgs.map(dg => ({ code: dg.code, name: dg.name, name_en: dg.name_en, icon: dg.icon, color: dg.color, sort_position: dg.sort_position }));
    if (dgRows?.length) {
      const codeSet = new Set(demandGroups.map(dg => dg.code));
      for (const row of toDemandGroups(dgRows)) {
        if (!codeSet.has(row.code)) {
          codeSet.add(row.code);
          demandGroups.push(row);
        }
      }
    }
    caches.demandGroupsCache.current = demandGroups;
    setDemandGroups(demandGroups);
  }

  if (caches.autoReorderCache.current === null) {
    caches.autoReorderCache.current = ((reorderRows ?? []) as AutoReorderSetting[]).map(row => ({
      ...row,
      product_id: String(row.product_id),
    }));
  }

  const demandGroupMap = new Map(demandGroups.map(dg => [dg.code, dg]));
  const reorderMap = new Map<string, AutoReorderSetting>();
  for (const row of caches.autoReorderCache.current) {
    reorderMap.set(row.product_id, row);
  }
  return { list, items, idbProducts, demandGroups, demandGroupMap, reorderMap, storeResult };
}

interface ProductMaps {
  productPriceMap: Map<string, number>;
  productThumbnailMap: Map<string, string>;
  productMetaMap: Map<string, ProductMetaForSort>;
  productIdsWithAdditionalInfo: Set<string>;
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>;
}

function buildProductMaps(idbProducts: Product[], contextProducts: Product[]): ProductMaps {
  const productPriceMap = new Map<string, number>();
  const productThumbnailMap = new Map<string, string>();
  const productMetaMap = new Map<string, ProductMetaForSort>();
  const productIdsWithAdditionalInfo = new Set<string>();
  const productDeferredInfo = new Map<string, { assortment_type: string; special_start_date: string | null; country: string }>();

  const SPECIAL_TYPES = new Set(["special", "special_food", "special_nonfood"]);

  const markHasAdditionalInfo = (p: Pick<Product, "product_id" | "thumbnail_url" | "brand" | "nutrition_info" | "ingredients" | "allergens" | "weight_or_quantity" | "article_number" | "ean_barcode" | "demand_group" | "assortment_type" | "special_start_date" | "special_end_date">) => {
    if (p.thumbnail_url || (p.brand != null && p.brand !== "") || (p.nutrition_info != null && typeof p.nutrition_info === "object" && Object.keys(p.nutrition_info).length > 0) || (p.ingredients != null && p.ingredients !== "") || (p.allergens != null && p.allergens !== "") || (p.weight_or_quantity != null && p.weight_or_quantity !== "") || (p.article_number != null && p.article_number !== "") || (p.ean_barcode != null && p.ean_barcode !== "") || (p.demand_group != null && p.demand_group !== "") || (p.assortment_type === "special" || p.assortment_type === "special_food" || p.assortment_type === "special_nonfood") || (p.special_start_date != null && p.special_start_date !== "") || (p.special_end_date != null && p.special_end_date !== "")) {
      productIdsWithAdditionalInfo.add(p.product_id);
    }
  };

  const processProduct = (p: Product) => {
    if (p.price != null) productPriceMap.set(p.product_id, p.price);
    if (p.thumbnail_url) productThumbnailMap.set(p.product_id, p.thumbnail_url);
    markHasAdditionalInfo(p);
    productMetaMap.set(p.product_id, {
      demand_group: p.demand_group ?? null,
      demand_sub_group: p.demand_sub_group ?? null,
      popularity_score: p.popularity_score ?? null,
      is_special: SPECIAL_TYPES.has(p.assortment_type ?? ""),
    });
    productDeferredInfo.set(p.product_id, {
      assortment_type: p.assortment_type ?? "daily_range",
      special_start_date: p.special_start_date ?? null,
      country: p.country ?? "DE",
    });
  };

  for (const p of idbProducts) processProduct(p);
  for (const p of contextProducts) processProduct(p);

  return { productPriceMap, productThumbnailMap, productMetaMap, productIdsWithAdditionalInfo, productDeferredInfo };
}

async function processAutoReorder(
  items: LocalListItem[],
  reorderMap: Map<string, AutoReorderSetting>,
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>,
  idbProducts: Product[],
  contextProducts: Product[],
  list: LocalShoppingList,
  demandGroupMap: Map<string, DemandGroup>,
  todayStr: string,
): Promise<void> {
  for (const item of items) {
    if (item.buy_elsewhere_retailer) {
      (item as ListItemWithMeta).is_deferred = true;
      (item as ListItemWithMeta).deferred_reason = "elsewhere";
      (item as ListItemWithMeta).is_buy_elsewhere = true;
      (item as ListItemWithMeta).buy_elsewhere_retailer = item.buy_elsewhere_retailer;
      (item as ListItemWithMeta).competitor_product_id = item.competitor_product_id ?? null;
      continue;
    }
    if (item.deferred_until && item.deferred_until !== "next_trip") {
      if (item.deferred_until > todayStr) {
        (item as ListItemWithMeta).is_deferred = true;
        (item as ListItemWithMeta).available_from = item.deferred_until;
        (item as ListItemWithMeta).deferred_reason = "manual";
      } else {
        updateListItem(item.item_id, { deferred_until: null }).catch(() => {});
      }
    } else if (item.deferred_until === "next_trip") {
      (item as ListItemWithMeta).is_deferred = true;
      (item as ListItemWithMeta).available_from = item.deferred_until;
      (item as ListItemWithMeta).deferred_reason = "manual";
    }
    if (!item.product_id) continue;
    if (reorderMap.has(item.product_id)) {
      (item as ListItemWithMeta).has_auto_reorder = true;
    }
    if (!(item as ListItemWithMeta).is_deferred) {
      const info = productDeferredInfo.get(item.product_id);
      if (info && isDeferredSpecial(info.assortment_type, info.special_start_date, info.country)) {
        (item as ListItemWithMeta).is_deferred = true;
        (item as ListItemWithMeta).available_from = info.special_start_date;
        (item as ListItemWithMeta).deferred_reason = "special";
      }
    }
  }

  const existingProductIds = new Set(items.filter((i) => i.product_id).map((i) => i.product_id!));

  for (const [productId, setting] of reorderMap) {
    if (existingProductIds.has(productId)) continue;
    if (!setting.last_checked_at) continue;

    const activationDate = computeReorderActivationDate(
      setting.last_checked_at,
      setting.reorder_value,
      setting.reorder_unit
    );

    const product = idbProducts.find((p) => p.product_id === productId)
      ?? contextProducts.find((p) => p.product_id === productId);
    if (!product) continue;

    if (activationDate <= todayStr) {
      await addListItem({
        list_id: list.list_id,
        product_id: productId,
        custom_name: null,
        display_name: product.name,
        demand_group_code: product.demand_group_code,
        quantity: 1,
      });
    } else {
      const dg = demandGroupMap.get(product.demand_group_code);
      items.push({
        item_id: `reorder-${productId}`,
        list_id: list.list_id,
        product_id: productId,
        custom_name: null,
        display_name: product.name,
        quantity: 1,
        is_checked: false,
        checked_at: null,
        sort_position: 999,
        demand_group_code: product.demand_group_code,
        added_at: new Date().toISOString(),
        is_deferred: true,
        available_from: activationDate,
        deferred_reason: "reorder",
        category_name: dg?.name ?? "",
        category_icon: dg?.icon ?? "📦",
        category_sort_position: dg?.sort_position ?? 999,
        price: null,
      } as ListItemWithMeta & { is_deferred: boolean; available_from: string; deferred_reason: "reorder" });
    }
  }
}

interface SortedItems {
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
}

/** Cached data needed to re-sort items client-side without a network reload. */
interface SortData {
  items: LocalListItem[];
  effectiveStoreId: string | null;
  demandGroups: DemandGroup[];
  demandGroupMap: Map<string, DemandGroup>;
  productMetaMap: Map<string, ProductMetaForSort>;
  productPriceMap: Map<string, number>;
  productThumbnailMap: Map<string, string>;
  productIdsWithAdditionalInfo: Set<string>;
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>;
}

async function sortListItems(
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

  if (sortMode === "shopping-order" && items.length > 0) {
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
          : (meta?.demand_group ?? dg?.name ?? "");
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
        .map((dg) => dg.name);
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

function scheduleActivationTimer(
  deferredItems: ListItemWithMeta[],
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>,
  refetchFn: () => void,
  timerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  if (deferredItems.length === 0) return;

  let nearestMs = Infinity;
  for (const item of deferredItems) {
    if (!item.product_id) continue;
    if (item.deferred_reason === "special") {
      const info = productDeferredInfo.get(item.product_id);
      if (info?.special_start_date) {
        const actMs = computeActivationTime(info.special_start_date, info.country);
        const delta = actMs - Date.now();
        if (delta > 0 && delta < nearestMs) nearestMs = delta;
      }
    } else if (item.deferred_reason === "reorder" && item.available_from) {
      const actMs = new Date(item.available_from + "T00:00:00").getTime();
      const delta = actMs - Date.now();
      if (delta > 0 && delta < nearestMs) nearestMs = delta;
    }
  }
  if (nearestMs < Infinity) {
    timerRef.current = setTimeout(refetchFn, Math.min(nearestMs + 1000, 2_147_483_647));
  }
}

/** Delay (ms) between visual check-off feedback and moving the item to the checked section. */
const CHECK_FEEDBACK_MS = 600;

// ─── Hook ─────────────────────────────────────────────────────────────

export function useListData(sortMode: SortMode = "my-order"): UseListDataResult {
  const { loading: authLoading } = useAuth();
  const { products: contextProducts } = useProducts();
  const contextProductsRef = useRef(contextProducts);
  contextProductsRef.current = contextProducts;

  const [listId, setListId] = useState<string | null>(null);
  const [store, setStore] = useState<LocalStore | null>(null);
  const [unchecked, setUnchecked] = useState<ListItemWithMeta[]>([]);
  const [checked, setChecked] = useState<ListItemWithMeta[]>([]);
  const [deferred, setDeferred] = useState<ListItemWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [withoutPriceCount, setWithoutPriceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataSortMode, setDataSortMode] = useState<SortMode>(sortMode);

  const uncheckedRef = useRef<ListItemWithMeta[]>([]);
  uncheckedRef.current = unchecked;
  const checkedRef = useRef<ListItemWithMeta[]>([]);
  checkedRef.current = checked;
  const deferredRef = useRef<ListItemWithMeta[]>([]);
  deferredRef.current = deferred;

  const checkAnimatingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);
  const refetchSeqRef = useRef(0);
  const demandGroupsCacheRef = useRef<DemandGroup[] | null>(null);
  const autoReorderCacheRef = useRef<AutoReorderSetting[] | null>(null);
  const idbProductsCacheRef = useRef<Product[] | null>(null);
  const prevContextProductsLenRef = useRef(contextProducts.length);
  const syncedStoreIdsRef = useRef<Set<string>>(new Set());

  // Ref so refetch can always read the current sortMode without being re-created on change
  const sortModeRef = useRef<SortMode>(sortMode);
  sortModeRef.current = sortMode;
  // Cached intermediate data for client-side re-sort without network reload
  const sortDataRef = useRef<SortData | null>(null);

  const refetch = useCallback(async (opts?: { forceReorder?: boolean }) => {
    if (opts?.forceReorder) autoReorderCacheRef.current = null;
    const seq = ++refetchSeqRef.current;
    if (isFirstLoad.current) setLoading(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const caches: ListDataCaches = {
        demandGroupsCache: demandGroupsCacheRef,
        autoReorderCache: autoReorderCacheRef,
        idbProductsCache: idbProductsCacheRef,
      };

      const { list, items, idbProducts, demandGroups, demandGroupMap, reorderMap, storeResult } =
        await fetchListData(caches);


      const currentContextProducts = contextProductsRef.current;
      const { productPriceMap, productThumbnailMap, productMetaMap, productIdsWithAdditionalInfo, productDeferredInfo } =
        buildProductMaps(idbProducts, currentContextProducts);

      await processAutoReorder(
        items, reorderMap, productDeferredInfo,
        idbProducts, currentContextProducts, list, demandGroupMap, todayStr,
      );

      const effectiveStoreId = list.store_id ?? getDefaultStoreId();

      sortDataRef.current = {
        items: [...items],
        effectiveStoreId,
        demandGroups,
        demandGroupMap,
        productMetaMap,
        productPriceMap,
        productThumbnailMap,
        productIdsWithAdditionalInfo,
        productDeferredInfo,
      };

      const currentSortMode = sortModeRef.current;
      const { unchecked: u, checked: c, deferred: d } = await sortListItems(
        items, currentSortMode, effectiveStoreId,
        demandGroups, demandGroupMap, productMetaMap, syncedStoreIdsRef,
      );

      if (seq !== refetchSeqRef.current) return;

      assignPrices(u, c, productPriceMap, d);
      assignThumbnails(u, c, productThumbnailMap, d);
      assignHasAdditionalInfo(u, c, productIdsWithAdditionalInfo, d);
      const { total: t, withoutPriceCount: w } = estimateTotal([...u, ...c]);

      setListId(list.list_id);
      setStore(storeResult ?? null);
      setUnchecked(u);
      setChecked(c);
      setDeferred(d);
      setTotal(t);
      setWithoutPriceCount(w);
      setDataSortMode(currentSortMode);

      scheduleActivationTimer(d, productDeferredInfo, () => refetch(), activationTimerRef);
    } catch (e) {
      log.error("[useListData] refetch failed:", e);
    } finally {
      if (seq === refetchSeqRef.current) {
        isFirstLoad.current = false;
        setLoading(false);
      }
    }
  // sortMode intentionally excluded: sort-mode changes trigger resort(), not refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Re-sorts the already-loaded items client-side using the cached SortData.
   * Called when sortMode changes – avoids a full Supabase + IndexedDB reload.
   * Re-applies deferred-status logic so time-sensitive status (e.g. specials
   * whose start date just passed) is correctly reflected.
   */
  const resort = useCallback(async () => {
    const data = sortDataRef.current;
    if (!data) return;
    const currentSortMode = sortModeRef.current;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const freshItems = data.items.map(srcItem => {
        const src = srcItem as ListItemWithMeta;
        const item: LocalListItem & Partial<ListItemWithMeta> = { ...srcItem };
        delete item.is_deferred;
        delete item.available_from;
        delete item.deferred_reason;
        delete item.is_buy_elsewhere;

        // Reorder items are synthetic (not from DB) — preserve their deferred state
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
          if (info && isDeferredSpecial(info.assortment_type, info.special_start_date, info.country)) {
            item.is_deferred = true;
            item.available_from = info.special_start_date;
            item.deferred_reason = "special";
          }
        }
        return item as LocalListItem;
      });
      const { unchecked: u, checked: c, deferred: d } = await sortListItems(
        freshItems, currentSortMode, data.effectiveStoreId,
        data.demandGroups, data.demandGroupMap, data.productMetaMap, syncedStoreIdsRef,
      );
      assignPrices(u, c, data.productPriceMap, d);
      assignThumbnails(u, c, data.productThumbnailMap, d);
      assignHasAdditionalInfo(u, c, data.productIdsWithAdditionalInfo, d);
      const { total: t, withoutPriceCount: w } = estimateTotal([...u, ...c]);
      setUnchecked(u);
      setChecked(c);
      setDeferred(d);
      setTotal(t);
      setWithoutPriceCount(w);
      setDataSortMode(currentSortMode);
    } catch (e) {
      log.error("[useListData] resort failed:", e);
    }
  }, []); // stable – reads sortMode via sortModeRef.current

  // Invalidate IDB products cache when contextProducts length changes (new products added via Capture/Scan).
  // When products first become available (0→N), trigger a full refetch so productMetaMap and
  // deferred-status are computed with complete data (fixes race condition on app startup).
  useEffect(() => {
    const prevLen = prevContextProductsLenRef.current;
    const curLen = contextProducts.length;
    if (prevLen !== curLen) {
      prevContextProductsLenRef.current = curLen;
      idbProductsCacheRef.current = null;
      if (prevLen === 0 && curLen > 0 && !isFirstLoad.current) {
        refetchRef.current();
      }
    }
  }, [contextProducts.length]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [refetch, authLoading]);

  // Sort-mode change: re-sort client-side, no network reload
  const isFirstSortModeEffect = useRef(true);
  useEffect(() => {
    if (isFirstSortModeEffect.current) {
      isFirstSortModeEffect.current = false;
      return;
    }
    resort();
  // resort is stable ([] deps), so this only fires when sortMode actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  // Stable ref so action callbacks don't depend on refetch identity
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const debounceRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (debounceRefetchRef.current) clearTimeout(debounceRefetchRef.current);
    debounceRefetchRef.current = setTimeout(() => {
      debounceRefetchRef.current = null;
      refetchRef.current();
    }, 300);
  }, []);

  const setItemChecked = useCallback(
    (itemId: string, isChecked: boolean): Promise<void> => {
      const nowIso = new Date().toISOString();

      // Cancel any in-flight check animation for this item (handles rapid double-tap)
      const existingTimer = checkAnimatingRef.current.get(itemId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        checkAnimatingRef.current.delete(itemId);
      }

      const originalItem =
        uncheckedRef.current.find(i => i.item_id === itemId) ??
        checkedRef.current.find(i => i.item_id === itemId) ??
        deferredRef.current.find(i => i.item_id === itemId);

      if (!originalItem) return Promise.resolve();

      // Fix 1: Elsewhere items are deleted instead of checked
      const elsewhereItem = deferredRef.current.find(
        i => i.item_id === itemId && i.deferred_reason === "elsewhere"
      );
      if (elsewhereItem && isChecked) {
        setDeferred(prev => prev.filter(i => i.item_id !== itemId));

        if (elsewhereItem.competitor_product_id && elsewhereItem.buy_elsewhere_retailer) {
          recordCompetitorPurchase(
            elsewhereItem.competitor_product_id,
            elsewhereItem.buy_elsewhere_retailer,
          ).catch(e => log.error("[useListData] recordCompetitorPurchase failed:", e));
        }

        deleteListItem(itemId).catch(e => {
          log.error("[useListData] remove elsewhere item failed:", e);
          setDeferred(prev => [...prev, elsewhereItem]);
        });
        return Promise.resolve();
      }

      const wasDeferred = deferredRef.current.some(i => i.item_id === itemId);

      const updatedItem: ListItemWithMeta = {
        ...originalItem,
        is_checked: isChecked,
        checked_at: isChecked ? nowIso : null,
      };

      if (isChecked) {
        // Phase 1: Update item in-place so checkmark + strikethrough are visible
        setUnchecked(prev => prev.map(i => i.item_id === itemId ? updatedItem : i));
        setDeferred(prev => prev.map(i => i.item_id === itemId ? updatedItem : i));

        // Phase 2: Move to checked section after animation delay
        const timer = setTimeout(() => {
          checkAnimatingRef.current.delete(itemId);
          setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
          setDeferred(prev => prev.filter(i => i.item_id !== itemId));
          setChecked(prev => [...prev.filter(i => i.item_id !== itemId), updatedItem]);
          debouncedRefetch();
        }, CHECK_FEEDBACK_MS);
        checkAnimatingRef.current.set(itemId, timer);
      } else {
        setChecked(prev => prev.filter(i => i.item_id !== itemId));
        setUnchecked(prev => [...prev.filter(i => i.item_id !== itemId), updatedItem]);
        debouncedRefetch();
      }

      updateListItem(itemId, {
        is_checked: isChecked,
        checked_at: isChecked ? nowIso : null,
      })
        .then(() => {
          if (!isChecked) return;
          touchAutoReorderOnCheckoff(itemId, nowIso).then(
            (productId) => {
              if (!productId) return;
              const cached = autoReorderCacheRef.current?.find(
                s => s.product_id === productId
              );
              if (cached) cached.last_checked_at = nowIso;
            },
            e => log.error("[useListData] auto-reorder update failed:", e)
          );
        })
        .catch(e => {
          log.error("[useListData] setItemChecked DB update failed:", e);
          const pendingTimer = checkAnimatingRef.current.get(itemId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            checkAnimatingRef.current.delete(itemId);
          }
          // Revert: remove from all arrays, then re-add to original location
          if (isChecked) {
            setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
            setChecked(prev => prev.filter(i => i.item_id !== itemId));
            setDeferred(prev => prev.filter(i => i.item_id !== itemId));
            if (wasDeferred) {
              setDeferred(prev => [...prev, originalItem]);
            } else {
              setUnchecked(prev => [...prev, originalItem]);
            }
          } else {
            setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
            setChecked(prev => [...prev, originalItem]);
          }
        });

      return Promise.resolve();
    },
    [debouncedRefetch]
  );

  const setItemQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return;
      const updateList = (list: ListItemWithMeta[]) =>
        list.map(i => i.item_id === itemId ? { ...i, quantity } : i);
      setUnchecked(updateList);
      setChecked(updateList);
      setDeferred(updateList);
      try {
        await updateListItem(itemId, { quantity });
        debouncedRefetch();
      } catch (e) {
        log.error("[useListData] setItemQuantity failed:", e);
        refetchRef.current();
      }
    },
    [debouncedRefetch]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const originalUnchecked = uncheckedRef.current;
      const originalChecked = checkedRef.current;
      const originalDeferred = deferredRef.current;
      setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
      setChecked(prev => prev.filter(i => i.item_id !== itemId));
      setDeferred(prev => prev.filter(i => i.item_id !== itemId));
      try {
        await deleteListItem(itemId);
        debouncedRefetch();
      } catch (e) {
        log.error("[useListData] removeItem failed:", e);
        setUnchecked(originalUnchecked);
        setChecked(originalChecked);
        setDeferred(originalDeferred);
      }
    },
    [debouncedRefetch]
  );

  const deferItem = useCallback(
    async (itemId: string) => {
      const item = uncheckedRef.current.find(i => i.item_id === itemId);
      if (!item) return;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const deferredItem: ListItemWithMeta = {
        ...item,
        is_deferred: true,
        available_from: tomorrowStr,
        deferred_reason: "manual",
        deferred_until: tomorrowStr,
      };
      setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
      setDeferred(prev => [...prev, deferredItem]);
      try {
        await updateListItem(itemId, { deferred_until: tomorrowStr });
      } catch (e) {
        log.error("[useListData] deferItem failed:", e);
        setDeferred(prev => prev.filter(i => i.item_id !== itemId));
        setUnchecked(prev => [...prev, item]);
      }
    },
    []
  );

  const undeferItem = useCallback(
    async (itemId: string) => {
      const item = deferredRef.current.find(i => i.item_id === itemId);
      if (!item || item.deferred_reason !== "manual") return;
      const activeItem: ListItemWithMeta = {
        ...item,
        is_deferred: false,
        available_from: undefined,
        deferred_reason: undefined,
        deferred_until: null,
      };
      setDeferred(prev => prev.filter(i => i.item_id !== itemId));
      setUnchecked(prev => [...prev, activeItem]);
      try {
        await updateListItem(itemId, { deferred_until: null });
      } catch (e) {
        log.error("[useListData] undeferItem failed:", e);
        setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
        setDeferred(prev => [...prev, item]);
      }
    },
    []
  );

  const setBuyElsewhere = useCallback(
    async (itemId: string, retailer: string) => {
      const item = uncheckedRef.current.find(i => i.item_id === itemId);
      if (!item) return;
      const elsewhereItem: ListItemWithMeta = {
        ...item,
        is_deferred: true,
        deferred_reason: "elsewhere",
        is_buy_elsewhere: true,
        buy_elsewhere_retailer: retailer,
      };
      setUnchecked(prev => prev.filter(i => i.item_id !== itemId));
      setDeferred(prev => [...prev, elsewhereItem]);
      try {
        await updateListItem(itemId, { buy_elsewhere_retailer: retailer });
      } catch (e) {
        log.error("[useListData] setBuyElsewhere failed:", e);
        setDeferred(prev => prev.filter(i => i.item_id !== itemId));
        setUnchecked(prev => [...prev, item]);
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (activationTimerRef.current) clearTimeout(activationTimerRef.current);
      if (debounceRefetchRef.current) clearTimeout(debounceRefetchRef.current);
      for (const timer of checkAnimatingRef.current.values()) clearTimeout(timer);
      checkAnimatingRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!listId) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const channel = supabase
      .channel(`list-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_items",
          filter: `list_id=eq.${listId}`,
        },
        () => {
          if (checkAnimatingRef.current.size > 0) return;
          refetchRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  return {
    listId,
    store,
    unchecked,
    checked,
    deferred,
    total,
    withoutPriceCount,
    loading,
    dataSortMode,
    refetch,
    setItemChecked,
    setItemQuantity,
    removeItem,
    deferItem,
    undeferItem,
    setBuyElsewhere,
  };
}
