"use client";

import { useCallback, useEffect } from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useListFetch } from "./hooks/use-list-fetch";
import { useListMutations } from "./hooks/use-list-mutations";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { SortMode } from "@/types";

export type { AutoReorderSetting } from "@/lib/list/auto-reorder-service";

export interface UseListDataResult {
  listId: string | null;
  listNotes: string | null;
  store: import("@/lib/db").LocalStore | null;
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  total: number;
  withoutPriceCount: number;
  loading: boolean;
  dataSortMode: SortMode;
  refetch: (opts?: { forceReorder?: boolean }) => Promise<void>;
  setItemChecked: (itemId: string, checked: boolean) => Promise<void>;
  setItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  deferItem: (itemId: string) => Promise<void>;
  undeferItem: (itemId: string) => Promise<void>;
  setBuyElsewhere: (itemId: string, retailer: string) => Promise<void>;
  updateItemComment: (itemId: string, comment: string | null) => void;
}

export function useListData(sortMode: SortMode = "my-order"): UseListDataResult {
  const fetch = useListFetch(sortMode);
  const {
    listId, listNotes, store, unchecked, checked, deferred, total, withoutPriceCount,
    loading, dataSortMode, setUnchecked, setChecked, setDeferred,
    uncheckedRef, checkedRef, deferredRef,
    refetch, refetchRef, autoReorderCacheRef,
    activationTimerRef, debounceRefetchRef,
  } = fetch;

  const debouncedRefetch = useCallback(() => {
    if (debounceRefetchRef.current) clearTimeout(debounceRefetchRef.current);
    debounceRefetchRef.current = setTimeout(() => {
      debounceRefetchRef.current = null;
      refetchRef.current();
    }, 300);
  }, [debounceRefetchRef, refetchRef]);

  const { checkAnimatingRef, setItemChecked, setItemQuantity, removeItem, deferItem, undeferItem, setBuyElsewhere, updateItemComment } =
    useListMutations({
      uncheckedRef, checkedRef, deferredRef,
      setUnchecked, setChecked, setDeferred,
      debouncedRefetch, refetchRef, autoReorderCacheRef,
    });

  useEffect(() => {
    const activationTimer = activationTimerRef;
    const debounceTimer = debounceRefetchRef;
    const animatingTimers = checkAnimatingRef;
    return () => {
      if (activationTimer.current) clearTimeout(activationTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      for (const timer of animatingTimers.current.values()) clearTimeout(timer);
      animatingTimers.current.clear();
    };
  }, [activationTimerRef, debounceRefetchRef, checkAnimatingRef]);

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
          // #region agent log
          console.log('[DEBUG-fceaab][G] realtime event → refetch', {animating: checkAnimatingRef.current.size});
          // #endregion
          if (checkAnimatingRef.current.size > 0) return;
          refetchRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, checkAnimatingRef, refetchRef]);

  return {
    listId, listNotes, store, unchecked, checked, deferred,
    total, withoutPriceCount, loading, dataSortMode,
    refetch, setItemChecked, setItemQuantity,
    removeItem, deferItem, undeferItem, setBuyElsewhere, updateItemComment,
  };
}
