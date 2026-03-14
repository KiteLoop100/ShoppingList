"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { log } from "@/lib/utils/logger";
import {
  assignPrices,
  assignThumbnails,
  assignHasAdditionalInfo,
  estimateTotal,
  type ListItemWithMeta,
} from "@/lib/list/list-helpers";
import { useProducts } from "@/lib/products-context";
import { useAuth } from "@/lib/auth/auth-context";
import { getDefaultStoreId } from "@/lib/settings/default-store";
import { type AutoReorderSetting } from "@/lib/list/auto-reorder-service";
import { processAutoReorder } from "./use-auto-reorder";
import { sortListItems, resortItems } from "./use-list-sort";
import {
  fetchListData,
  buildProductMaps,
  scheduleActivationTimer,
  type ListDataCaches,
  type SortData,
} from "./list-data-helpers";
import type { LocalStore } from "@/lib/db";
import type { DemandGroup, DemandSubGroup, Product, SortMode } from "@/types";

export type {
  ListDataCaches,
  FetchedListData,
  ProductMaps,
  SortData,
  SortedItems,
} from "./list-data-helpers";
export { computeActivationTime } from "./list-data-helpers";

export interface UseListFetchResult {
  listId: string | null;
  listNotes: string | null;
  store: LocalStore | null;
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  total: number;
  withoutPriceCount: number;
  cartTotal: number;
  cartWithoutPriceCount: number;
  loading: boolean;
  dataSortMode: SortMode;
  setUnchecked: React.Dispatch<React.SetStateAction<ListItemWithMeta[]>>;
  setChecked: React.Dispatch<React.SetStateAction<ListItemWithMeta[]>>;
  setDeferred: React.Dispatch<React.SetStateAction<ListItemWithMeta[]>>;
  uncheckedRef: React.MutableRefObject<ListItemWithMeta[]>;
  checkedRef: React.MutableRefObject<ListItemWithMeta[]>;
  deferredRef: React.MutableRefObject<ListItemWithMeta[]>;
  refetch: (opts?: { forceReorder?: boolean }) => Promise<void>;
  refetchRef: React.MutableRefObject<(opts?: { forceReorder?: boolean }) => Promise<void>>;
  autoReorderCacheRef: React.MutableRefObject<AutoReorderSetting[] | null>;
  activationTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  debounceRefetchRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export function useListFetch(sortMode: SortMode): UseListFetchResult {
  const { loading: authLoading } = useAuth();
  const { products: contextProducts } = useProducts();
  const contextProductsRef = useRef(contextProducts);
  contextProductsRef.current = contextProducts;

  const [listId, setListId] = useState<string | null>(null);
  const [listNotes, setListNotes] = useState<string | null>(null);
  const [store, setStore] = useState<LocalStore | null>(null);
  const [unchecked, setUnchecked] = useState<ListItemWithMeta[]>([]);
  const [checked, setChecked] = useState<ListItemWithMeta[]>([]);
  const [deferred, setDeferred] = useState<ListItemWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [withoutPriceCount, setWithoutPriceCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartWithoutPriceCount, setCartWithoutPriceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataSortMode, setDataSortMode] = useState<SortMode>(sortMode);

  const uncheckedRef = useRef<ListItemWithMeta[]>([]);
  uncheckedRef.current = unchecked;
  const checkedRef = useRef<ListItemWithMeta[]>([]);
  checkedRef.current = checked;
  const deferredRef = useRef<ListItemWithMeta[]>([]);
  deferredRef.current = deferred;

  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);
  const refetchSeqRef = useRef(0);
  const demandGroupsCacheRef = useRef<DemandGroup[] | null>(null);
  const demandSubGroupsCacheRef = useRef<DemandSubGroup[] | null>(null);
  const autoReorderCacheRef = useRef<AutoReorderSetting[] | null>(null);
  const idbProductsCacheRef = useRef<Product[] | null>(null);
  const prevContextProductsLenRef = useRef(contextProducts.length);
  const syncedStoreIdsRef = useRef<Set<string>>(new Set());
  const sortModeRef = useRef<SortMode>(sortMode);
  sortModeRef.current = sortMode;
  const sortDataRef = useRef<SortData | null>(null);
  const debounceRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async (opts?: { forceReorder?: boolean }) => {
    if (opts?.forceReorder) autoReorderCacheRef.current = null;
    const seq = ++refetchSeqRef.current;
    if (isFirstLoad.current) setLoading(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const caches: ListDataCaches = {
        demandGroupsCache: demandGroupsCacheRef,
        demandSubGroupsCache: demandSubGroupsCacheRef,
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
        items: [...items], effectiveStoreId, demandGroups, demandGroupMap,
        productMetaMap, productPriceMap, productThumbnailMap, productIdsWithAdditionalInfo, productDeferredInfo,
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
      const { total: t, withoutPriceCount: w } = estimateTotal([...u, ...c, ...d]);
      const { total: ct, withoutPriceCount: cw } = estimateTotal(c);

      setListId(list.list_id);
      setListNotes(list.notes ?? null);
      setStore(storeResult ?? null);
      setUnchecked(u);
      setChecked(c);
      setDeferred(d);
      setTotal(t);
      setWithoutPriceCount(w);
      setCartTotal(ct);
      setCartWithoutPriceCount(cw);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resort = useCallback(async () => {
    const data = sortDataRef.current;
    if (!data) return;
    try {
      const result = await resortItems(data, sortModeRef.current, syncedStoreIdsRef);
      setUnchecked(result.unchecked);
      setChecked(result.checked);
      setDeferred(result.deferred);
      setTotal(result.total);
      setWithoutPriceCount(result.withoutPriceCount);
      setCartTotal(result.cartTotal);
      setCartWithoutPriceCount(result.cartWithoutPriceCount);
      setDataSortMode(sortModeRef.current);
    } catch (e) {
      log.error("[useListData] resort failed:", e);
    }
  }, []);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

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

  const isFirstSortModeEffect = useRef(true);
  useEffect(() => {
    if (isFirstSortModeEffect.current) {
      isFirstSortModeEffect.current = false;
      return;
    }
    resort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  return {
    listId, listNotes, store, unchecked, checked, deferred,
    total, withoutPriceCount, cartTotal, cartWithoutPriceCount,
    loading, dataSortMode,
    setUnchecked, setChecked, setDeferred,
    uncheckedRef, checkedRef, deferredRef,
    refetch, refetchRef, autoReorderCacheRef,
    activationTimerRef, debounceRefetchRef,
  };
}
