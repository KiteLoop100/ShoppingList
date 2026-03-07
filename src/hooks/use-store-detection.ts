import { useState, useEffect, useRef, useCallback } from "react";
import {
  detectStoreOrPosition,
  setListGpsConfirmed,
  setListStore,
} from "@/lib/store/store-service";
import type { GeoPosition } from "@/lib/store/store-service";
import type { LocalStore } from "@/lib/db";
import { createInStoreMonitor } from "@/lib/store/in-store-monitor";
import type { InStoreMonitorHandle } from "@/lib/store/in-store-monitor";
import type { SortMode } from "@/components/search/product-search";
import { log } from "@/lib/utils/logger";

const SORT_TOAST_MS = 2000;
const GPS_RETRY_DELAY_MS = 10_000;
const GPS_MAX_RETRIES = 2;

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
  /** GPS position available but no known store nearby -- user can create one. */
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
 * so the caller can show a "create store" dialog. The monitor still starts so
 * the store is detected once the user arrives.
 *
 * On GPS failure the hook retries up to GPS_MAX_RETRIES times with a
 * GPS_RETRY_DELAY_MS delay. If all retries fail, the default store from
 * Settings is used as fallback.
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
  const gpsAttemptRef = useRef(0);
  const prevStoreIdRef = useRef<string | null | "__init__">("__init__");
  const manualSortRef = useRef(false);
  manualSortRef.current = userHasManuallyChosenSort;
  const monitorRef = useRef<InStoreMonitorHandle | null>(null);

  const startMonitor = useCallback(
    (forListId: string, initiallyInStore: boolean) => {
      monitorRef.current?.stop();
      monitorRef.current = createInStoreMonitor(
        forListId,
        initiallyInStore,
        (inStore, nearestStore) => {
          setIsInStore(inStore);
          if (nearestStore) setDetectedStoreName(nearestStore.name);
        }
      );
    },
    []
  );

  const stopMonitor = useCallback(() => {
    monitorRef.current?.stop();
    monitorRef.current = null;
  }, []);

  useEffect(() => {
    if (!listId || gpsAttemptRef.current > 0) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function attempt(retryCount: number): Promise<void> {
      if (cancelled) return;
      gpsAttemptRef.current = retryCount + 1;

      const { result, gpsPosition } = await detectStoreOrPosition(listId!);

      if (cancelled) return;

      if (result) {
        const { store: detectedStore, detectedByGps } = result;
        setDetectedStoreName(detectedStore.name);

        if (detectedByGps) {
          setIsInStore(true);
          await setListGpsConfirmed(listId!, true);
          if (!manualSortRef.current && !sortRestoredFromSession.current) {
            setSortMode("shopping-order");
            setShowSortToast(true);
          }
        }

        startMonitor(listId!, detectedByGps);
        refetchRef.current();
        return;
      }

      if (gpsPosition) {
        setUnknownLocation(gpsPosition);
        startMonitor(listId!, false);
        return;
      }

      if (retryCount < GPS_MAX_RETRIES) {
        log.debug(
          `[useStoreDetection] GPS attempt ${retryCount + 1} failed, retrying in ${GPS_RETRY_DELAY_MS / 1000}s`
        );
        retryTimer = setTimeout(
          () => void attempt(retryCount + 1),
          GPS_RETRY_DELAY_MS
        );
        return;
      }

      log.warn("[useStoreDetection] All GPS retries exhausted, using default store fallback");
    }

    void attempt(0);

    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      stopMonitor();
    };
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

      startMonitor(listId, true);
      refetchRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, startMonitor]);

  const handleSkipCreateStore = useCallback(() => {
    setUnknownLocation(null);
  }, []);

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

  useEffect(() => {
    if (!showSortToast) return;
    const id = setTimeout(() => setShowSortToast(false), SORT_TOAST_MS);
    return () => clearTimeout(id);
  }, [showSortToast]);

  const resetOnCompletion = useCallback(() => {
    stopMonitor();
    setIsInStore(false);
    setDetectedStoreName(null);
    setUnknownLocation(null);
  }, [stopMonitor]);

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
