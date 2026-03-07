import { useState, useEffect, useRef, useCallback } from "react";
import {
  detectStoreOrPosition,
  setListGpsConfirmed,
  setListStore,
} from "@/lib/store/store-service";
import type { GeoPosition } from "@/lib/store/store-service";
import type { LocalStore } from "@/lib/db";
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
  /** GPS position available but no known store nearby — user can create one. */
  unknownLocation: GeoPosition | null;
  /** Call after user creates a store from the unknown-location prompt. */
  handleStoreCreated: (store: LocalStore) => void;
  /** Call when user skips creating a store. */
  handleSkipCreateStore: () => void;
  /** Call when a shopping trip completes to stop monitoring and clear store state. */
  resetOnCompletion: () => void;
}

/**
 * Handles GPS-based store detection, in-store monitoring, and automatic
 * sort-mode switching when the active store changes.
 *
 * When GPS is available but no known store is nearby, `unknownLocation` is set
 * so the caller can show a "create store" dialog.
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
  const [unknownLocation, setUnknownLocation] = useState<GeoPosition | null>(null);
  const gpsTriedRef = useRef(false);
  const prevStoreIdRef = useRef<string | null | "__init__">("__init__");
  const manualSortRef = useRef(false);
  manualSortRef.current = userHasManuallyChosenSort;

  useEffect(() => {
    if (!listId || gpsTriedRef.current) return;
    gpsTriedRef.current = true;

    detectStoreOrPosition(listId).then(async ({ result, gpsPosition }) => {
      if (result) {
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
      } else if (gpsPosition) {
        setUnknownLocation(gpsPosition);
      }
    });

    return () => stopInStoreMonitor();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const handleStoreCreated = useCallback(async (store: LocalStore) => {
    setUnknownLocation(null);
    setDetectedStoreName(store.name);
    setIsInStore(true);

    if (listId) {
      await setListStore(listId, store.store_id);
      await setListGpsConfirmed(listId, true);

      if (!manualSortRef.current && !sortRestoredFromSession.current) {
        setSortMode("shopping-order");
        setShowSortToast(true);
      }

      startInStoreMonitor(listId, true, (inStore, nearestStore) => {
        setIsInStore(inStore);
        if (nearestStore) setDetectedStoreName(nearestStore.name);
      });

      refetchRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const handleSkipCreateStore = useCallback(() => {
    setUnknownLocation(null);
  }, []);

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
    setUnknownLocation(null);
  }, []);

  return {
    isInStore,
    detectedStoreName,
    showSortToast,
    unknownLocation,
    handleStoreCreated,
    handleSkipCreateStore,
    resetOnCompletion,
  };
}
