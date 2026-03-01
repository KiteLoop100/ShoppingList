import { useState, useEffect, useRef, useCallback } from "react";
import { detectAndSetStoreForList, setListGpsConfirmed } from "@/lib/store/store-service";
import { startInStoreMonitor, stopInStoreMonitor } from "@/lib/store/in-store-monitor";
import type { SortMode } from "@/components/search/product-search";

const SORT_TOAST_MS = 2000;

interface UseStoreDetectionOptions {
  listId: string | null | undefined;
  loading: boolean;
  storeId: string | null | undefined;
  userHasManuallyChosenSort: boolean;
  sortRestoredFromSession: React.MutableRefObject<boolean>;
  setSortMode: (mode: SortMode) => void;
  setUserHasManuallyChosenSort: (v: boolean) => void;
  refetchRef: React.MutableRefObject<() => void>;
}

export interface StoreDetectionState {
  isInStore: boolean;
  detectedStoreName: string | null;
  showSortToast: boolean;
  /** Call when a shopping trip completes to stop monitoring and clear store state. */
  resetOnCompletion: () => void;
}

/**
 * Handles GPS-based store detection, in-store monitoring, and automatic
 * sort-mode switching when the active store changes.
 */
export function useStoreDetection({
  listId,
  loading,
  storeId,
  userHasManuallyChosenSort,
  sortRestoredFromSession,
  setSortMode,
  setUserHasManuallyChosenSort,
  refetchRef,
}: UseStoreDetectionOptions): StoreDetectionState {
  const [isInStore, setIsInStore] = useState(false);
  const [detectedStoreName, setDetectedStoreName] = useState<string | null>(null);
  const [showSortToast, setShowSortToast] = useState(false);
  const gpsTriedRef = useRef(false);
  const prevStoreIdRef = useRef<string | null | "__init__">("__init__");
  const manualSortRef = useRef(false);
  manualSortRef.current = userHasManuallyChosenSort;

  // GPS-based store detection runs once when listId becomes available
  useEffect(() => {
    if (!listId || gpsTriedRef.current) return;
    gpsTriedRef.current = true;

    detectAndSetStoreForList(listId).then(async (result) => {
      if (!result) return;
      const { store: detectedStore, detectedByGps } = result;

      setDetectedStoreName(detectedStore.name);

      if (detectedByGps) {
        setIsInStore(true);
        await setListGpsConfirmed(listId, true);
        if (!manualSortRef.current && !sortRestoredFromSession.current) {
          setSortMode("shopping-order");
          setShowSortToast(true);
        }
      }

      startInStoreMonitor(listId, detectedByGps, (inStore, nearestStore) => {
        setIsInStore(inStore);
        if (nearestStore) setDetectedStoreName(nearestStore.name);
      });

      refetchRef.current();
    });

    return () => stopInStoreMonitor();
  // listId is the only meaningful dependency; other values are stable refs/callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // F03: Auto-switch sort mode when the active store is set or cleared
  useEffect(() => {
    if (loading) return;

    const currentStoreId = storeId ?? null;
    const prev = prevStoreIdRef.current;

    if (prev === "__init__") {
      prevStoreIdRef.current = currentStoreId;
      return;
    }

    if (currentStoreId !== null && prev !== currentStoreId) {
      prevStoreIdRef.current = currentStoreId;
      setUserHasManuallyChosenSort(false);
      setSortMode("shopping-order");
      setShowSortToast(true);
    } else if (currentStoreId === null && prev !== null) {
      prevStoreIdRef.current = null;
      if (!manualSortRef.current) setSortMode("my-order");
    }
  }, [loading, storeId, setSortMode, setUserHasManuallyChosenSort]);

  // Sort toast auto-dismiss
  useEffect(() => {
    if (!showSortToast) return;
    const id = setTimeout(() => setShowSortToast(false), SORT_TOAST_MS);
    return () => clearTimeout(id);
  }, [showSortToast]);

  const resetOnCompletion = useCallback(() => {
    stopInStoreMonitor();
    setIsInStore(false);
    setDetectedStoreName(null);
  }, []);

  return { isInStore, detectedStoreName, showSortToast, resetOnCompletion };
}
