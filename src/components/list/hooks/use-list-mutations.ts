"use client";

import { useCallback, useRef } from "react";
import { log } from "@/lib/utils/logger";
import { updateListItem, deleteListItem } from "@/lib/list";
import { recordCompetitorPurchase } from "@/lib/competitor-products/competitor-product-service";
import { touchAutoReorderOnCheckoff, type AutoReorderSetting } from "@/lib/list/auto-reorder-service";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

const CHECK_FEEDBACK_MS = 350;

type Ref<T> = React.MutableRefObject<T>;
type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface MutationDeps {
  uncheckedRef: Ref<ListItemWithMeta[]>;
  checkedRef: Ref<ListItemWithMeta[]>;
  deferredRef: Ref<ListItemWithMeta[]>;
  setUnchecked: SetState<ListItemWithMeta[]>;
  setChecked: SetState<ListItemWithMeta[]>;
  setDeferred: SetState<ListItemWithMeta[]>;
  debouncedRefetch: () => void;
  refetchRef: Ref<(opts?: { forceReorder?: boolean }) => Promise<void>>;
  autoReorderCacheRef: Ref<AutoReorderSetting[] | null>;
}

export function useListMutations(deps: MutationDeps) {
  const {
    uncheckedRef, checkedRef, deferredRef,
    setUnchecked, setChecked, setDeferred,
    debouncedRefetch, refetchRef, autoReorderCacheRef,
  } = deps;

  const checkAnimatingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exclude = (id: string) => (prev: ListItemWithMeta[]) => prev.filter(i => i.item_id !== id);

  const setItemChecked = useCallback(
    (itemId: string, isChecked: boolean): Promise<void> => {
      const nowIso = new Date().toISOString();
      const existingTimer = checkAnimatingRef.current.get(itemId);
      if (existingTimer) { clearTimeout(existingTimer); checkAnimatingRef.current.delete(itemId); }

      const originalItem =
        uncheckedRef.current.find(i => i.item_id === itemId) ??
        checkedRef.current.find(i => i.item_id === itemId) ??
        deferredRef.current.find(i => i.item_id === itemId);
      if (!originalItem) return Promise.resolve();

      const elsewhereItem = deferredRef.current.find(i => i.item_id === itemId && i.deferred_reason === "elsewhere");
      if (elsewhereItem && isChecked) {
        setDeferred(exclude(itemId));
        if (elsewhereItem.competitor_product_id && elsewhereItem.buy_elsewhere_retailer) {
          recordCompetitorPurchase(elsewhereItem.competitor_product_id, elsewhereItem.buy_elsewhere_retailer)
            .catch(e => log.error("[useListData] recordCompetitorPurchase failed:", e));
        }
        deleteListItem(itemId).catch(e => {
          log.error("[useListData] remove elsewhere item failed:", e);
          setDeferred(prev => [...prev, elsewhereItem]);
        });
        return Promise.resolve();
      }

      const wasDeferred = deferredRef.current.some(i => i.item_id === itemId);
      const updatedItem: ListItemWithMeta = { ...originalItem, is_checked: isChecked, checked_at: isChecked ? nowIso : null };

      if (isChecked) {
        setUnchecked(prev => prev.map(i => i.item_id === itemId ? updatedItem : i));
        setDeferred(prev => prev.map(i => i.item_id === itemId ? updatedItem : i));
        const timer = setTimeout(() => {
          checkAnimatingRef.current.delete(itemId);
          setUnchecked(exclude(itemId));
          setDeferred(exclude(itemId));
          setChecked(prev => [...prev.filter(i => i.item_id !== itemId), updatedItem]);
          debouncedRefetch();
        }, CHECK_FEEDBACK_MS);
        checkAnimatingRef.current.set(itemId, timer);
      } else {
        setChecked(exclude(itemId));
        setUnchecked(prev => [...prev.filter(i => i.item_id !== itemId), updatedItem]);
        debouncedRefetch();
      }

      updateListItem(itemId, { is_checked: isChecked, checked_at: isChecked ? nowIso : null })
        .then(() => {
          if (!isChecked) return;
          touchAutoReorderOnCheckoff(itemId, nowIso).then(
            (productId) => {
              if (!productId) return;
              const cached = autoReorderCacheRef.current?.find(s => s.product_id === productId);
              if (cached) cached.last_checked_at = nowIso;
            },
            e => log.error("[useListData] auto-reorder update failed:", e)
          );
        })
        .catch(e => {
          log.error("[useListData] setItemChecked DB update failed:", e);
          const pendingTimer = checkAnimatingRef.current.get(itemId);
          if (pendingTimer) { clearTimeout(pendingTimer); checkAnimatingRef.current.delete(itemId); }
          if (isChecked) {
            setUnchecked(exclude(itemId)); setChecked(exclude(itemId)); setDeferred(exclude(itemId));
            if (wasDeferred) setDeferred(prev => [...prev, originalItem]);
            else setUnchecked(prev => [...prev, originalItem]);
          } else {
            setUnchecked(exclude(itemId));
            setChecked(prev => [...prev, originalItem]);
          }
        });
      return Promise.resolve();
    },
    [uncheckedRef, checkedRef, deferredRef, setUnchecked, setChecked, setDeferred, debouncedRefetch, autoReorderCacheRef]
  );

  const setItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const update = (list: ListItemWithMeta[]) => list.map(i => i.item_id === itemId ? { ...i, quantity } : i);
    setUnchecked(update); setChecked(update); setDeferred(update);
    try { await updateListItem(itemId, { quantity }); debouncedRefetch(); }
    catch (e) { log.error("[useListData] setItemQuantity failed:", e); refetchRef.current(); }
  }, [setUnchecked, setChecked, setDeferred, debouncedRefetch, refetchRef]);

  const removeItem = useCallback(async (itemId: string) => {
    const origU = uncheckedRef.current, origC = checkedRef.current, origD = deferredRef.current;
    setUnchecked(exclude(itemId)); setChecked(exclude(itemId)); setDeferred(exclude(itemId));
    try { await deleteListItem(itemId); debouncedRefetch(); }
    catch (e) { log.error("[useListData] removeItem failed:", e); setUnchecked(origU); setChecked(origC); setDeferred(origD); }
  }, [uncheckedRef, checkedRef, deferredRef, setUnchecked, setChecked, setDeferred, debouncedRefetch]);

  const deferItem = useCallback(async (itemId: string) => {
    const item = uncheckedRef.current.find(i => i.item_id === itemId);
    if (!item) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const deferredItem: ListItemWithMeta = { ...item, is_deferred: true, available_from: tomorrowStr, deferred_reason: "manual", deferred_until: tomorrowStr };
    setUnchecked(exclude(itemId));
    setDeferred(prev => [...prev, deferredItem]);
    try { await updateListItem(itemId, { deferred_until: tomorrowStr }); }
    catch (e) { log.error("[useListData] deferItem failed:", e); setDeferred(exclude(itemId)); setUnchecked(prev => [...prev, item]); }
  }, [uncheckedRef, setUnchecked, setDeferred]);

  const undeferItem = useCallback(async (itemId: string) => {
    const item = deferredRef.current.find(i => i.item_id === itemId);
    if (!item || item.deferred_reason !== "manual") return;
    const activeItem: ListItemWithMeta = { ...item, is_deferred: false, available_from: undefined, deferred_reason: undefined, deferred_until: null };
    setDeferred(exclude(itemId));
    setUnchecked(prev => [...prev, activeItem]);
    try { await updateListItem(itemId, { deferred_until: null }); }
    catch (e) { log.error("[useListData] undeferItem failed:", e); setUnchecked(exclude(itemId)); setDeferred(prev => [...prev, item]); }
  }, [deferredRef, setDeferred, setUnchecked]);

  const updateItemComment = useCallback((itemId: string, comment: string | null) => {
    // #region agent log
    console.log('[DEBUG-fceaab][F] updateItemComment called:', {itemId, comment});
    // #endregion
    const patch = (list: ListItemWithMeta[]) =>
      list.map(i => i.item_id === itemId ? { ...i, comment } : i);
    setUnchecked(patch);
    setChecked(patch);
    setDeferred(patch);
  }, [setUnchecked, setChecked, setDeferred]);

  const setBuyElsewhere = useCallback(async (itemId: string, retailer: string) => {
    const item = uncheckedRef.current.find(i => i.item_id === itemId);
    if (!item) return;
    const elsewhereItem: ListItemWithMeta = { ...item, is_deferred: true, deferred_reason: "elsewhere", is_buy_elsewhere: true, buy_elsewhere_retailer: retailer };
    setUnchecked(exclude(itemId));
    setDeferred(prev => [...prev, elsewhereItem]);
    try { await updateListItem(itemId, { buy_elsewhere_retailer: retailer }); }
    catch (e) { log.error("[useListData] setBuyElsewhere failed:", e); setDeferred(exclude(itemId)); setUnchecked(prev => [...prev, item]); }
  }, [uncheckedRef, setUnchecked, setDeferred]);

  return { checkAnimatingRef, setItemChecked, setItemQuantity, removeItem, deferItem, undeferItem, setBuyElsewhere, updateItemComment };
}
