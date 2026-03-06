import { useState, useCallback, useRef, useLayoutEffect, useEffect } from "react";
import type { SortMode } from "@/types";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SORT_MODE_KEY = "dsl_sortMode";
const MANUAL_SORT_KEY = "dsl_manualSort";

function readPersistedSort(): { mode: SortMode; manual: boolean; fromSession: boolean } {
  if (typeof window === "undefined") return { mode: "my-order", manual: false, fromSession: false };
  try {
    const mode = sessionStorage.getItem(SORT_MODE_KEY) as SortMode | null;
    if (mode === null) return { mode: "my-order", manual: false, fromSession: false };
    const manual = sessionStorage.getItem(MANUAL_SORT_KEY) === "1";
    const VALID_MODES: SortMode[] = ["my-order", "shopping-order", "shopping-order-tiles"];
    const validMode = VALID_MODES.includes(mode as SortMode) ? (mode as SortMode) : "my-order";
    return { mode: validMode, manual, fromSession: true };
  } catch {
    return { mode: "my-order", manual: false, fromSession: false };
  }
}

export interface PersistedSortState {
  sortMode: SortMode;
  userHasManuallyChosenSort: boolean;
  sortReady: boolean;
  sortRestoredFromSession: React.MutableRefObject<boolean>;
  setSortMode: (mode: SortMode) => void;
  setUserHasManuallyChosenSort: (v: boolean) => void;
}

/** Reads and writes sort-mode preference to sessionStorage, restoring on mount. */
export function usePersistedSort(): PersistedSortState {
  const [sortMode, setSortModeRaw] = useState<SortMode>("my-order");
  const [userHasManuallyChosenSort, setUserHasManuallyChosenSortRaw] = useState(false);
  const sortRestoredFromSession = useRef(false);
  const [sortReady, setSortReady] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const persisted = readPersistedSort();
    setSortModeRaw(persisted.mode);
    setUserHasManuallyChosenSortRaw(persisted.manual);
    sortRestoredFromSession.current = persisted.fromSession;
    setSortReady(true);
  }, []);

  const setSortMode = useCallback((mode: SortMode) => {
    setSortModeRaw(mode);
    try { sessionStorage.setItem(SORT_MODE_KEY, mode); } catch { /* noop */ }
  }, []);

  const setUserHasManuallyChosenSort = useCallback((v: boolean) => {
    setUserHasManuallyChosenSortRaw(v);
    try { sessionStorage.setItem(MANUAL_SORT_KEY, v ? "1" : "0"); } catch { /* noop */ }
  }, []);

  return {
    sortMode,
    userHasManuallyChosenSort,
    sortReady,
    sortRestoredFromSession,
    setSortMode,
    setUserHasManuallyChosenSort,
  };
}
