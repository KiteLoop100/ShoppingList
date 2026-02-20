"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ProductSearch } from "@/components/search/product-search";
import { ShoppingListContent } from "@/components/list/shopping-list-content";
import { SortModeTabs, type SortMode } from "@/components/list/sort-mode-tabs";
import { StorePickerOverlay } from "@/components/store/store-picker-overlay";
import { useListSummary } from "@/components/list/use-list-summary";
import { seedIfNeeded } from "@/lib/db/seed";
import { getOrCreateActiveList, archiveListAsTrip } from "@/lib/list";
import { detectAndSetStoreForList } from "@/lib/store/store-service";

const COMPLETION_DELAY_MS = 1800;
const SORT_TOAST_MS = 2000;

export default function MainScreenPage() {
  const t = useTranslations("home");
  const tList = useTranslations("list");
  const tStore = useTranslations("store");
  const tCommon = useTranslations("common");
  const { summary, loading, refetch, listId, store } = useListSummary();
  const [showCompletion, setShowCompletion] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("my-order");
  const [userHasManuallyChosenSort, setUserHasManuallyChosenSort] = useState(false);
  const [showSortToast, setShowSortToast] = useState(false);
  const gpsTriedRef = useRef(false);
  const prevStoreIdRef = useRef<string | null>(null);

  useEffect(() => {
    seedIfNeeded();
  }, []);

  useEffect(() => {
    if (!listId || gpsTriedRef.current) return;
    gpsTriedRef.current = true;
    detectAndSetStoreForList(listId).then((detected) => {
      if (detected) refetch();
    });
  }, [listId, refetch]);

  // F03: Auto-switch sort mode when store is set or cleared
  useEffect(() => {
    const storeId = store?.store_id ?? null;
    const prevStoreId = prevStoreIdRef.current;

    if (storeId !== null) {
      if (prevStoreId !== storeId) {
        prevStoreIdRef.current = storeId;
        setUserHasManuallyChosenSort(false);
        setSortMode("shopping-order");
        setShowSortToast(true);
      }
    } else {
      prevStoreIdRef.current = null;
      if (!userHasManuallyChosenSort) setSortMode("my-order");
    }
  }, [store?.store_id, userHasManuallyChosenSort]);

  useEffect(() => {
    if (!showSortToast) return;
    const id = setTimeout(() => setShowSortToast(false), SORT_TOAST_MS);
    return () => clearTimeout(id);
  }, [showSortToast]);

  const handleSortModeChange = useCallback((mode: SortMode) => {
    setSortMode(mode);
    setUserHasManuallyChosenSort(true);
  }, []);

  const handleAdded = useCallback(() => {
    refetch();
    setListKey((k) => k + 1);
  }, [refetch]);

  const handleLastItemChecked = useCallback(
    async (listId: string) => {
      await archiveListAsTrip(listId);
      setUserHasManuallyChosenSort(false);
      setSortMode("my-order");
      setShowCompletion(true);
      const id = setTimeout(() => {
        setShowCompletion(false);
        refetch();
        setListKey((k) => k + 1);
      }, COMPLETION_DELAY_MS);
      return () => clearTimeout(id);
    },
    [refetch]
  );

  const hasItems = summary && summary.itemCount > 0;
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const [, setOverlayContainerMounted] = useState(false);
  const setOverlayRef = useCallback((el: HTMLDivElement | null) => {
    (overlayContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setOverlayContainerMounted(!!el); // force re-render so portal target is available
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-aldi-muted-light bg-white px-4 py-3">
        <h1 className="flex-1 text-lg font-bold text-aldi-blue">
          {tCommon("appName")}
        </h1>
        <button
          type="button"
          className="min-h-touch max-w-[50%] truncate rounded-lg px-2 text-left text-sm font-medium text-aldi-text transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-blue"
          onClick={() => setStorePickerOpen(true)}
          aria-label={tStore("changeStore")}
          title={store ? `${store.name}, ${store.address}` : undefined}
        >
          {store ? `${store.name} ▾` : tStore("changeStore")}
        </button>
        <Link
          href="/settings"
          className="touch-target flex items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("settings")}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </Link>
      </header>

      <StorePickerOverlay
        open={storePickerOpen}
        listId={listId}
        onClose={() => setStorePickerOpen(false)}
        onStoreSelected={async () => {
          await refetch();
          setListKey((k) => k + 1);
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ProductSearch
          placeholder={t("searchPlaceholder")}
          onAdded={handleAdded}
          className="shrink-0 p-4 pb-0"
          aria-label={t("searchPlaceholder")}
          overlayContainerRef={overlayContainerRef}
        />

        <div className="shrink-0 px-4 pb-2">
          <SortModeTabs value={sortMode} onChange={handleSortModeChange} />
        </div>

        {showSortToast && (
          <div
            className="mx-4 mb-2 rounded-lg bg-aldi-blue/10 px-3 py-2 text-center text-sm text-aldi-blue"
            role="status"
            aria-live="polite"
          >
            {tList("sortSwitchedToShoppingOrder")}
          </div>
        )}

        <div
          ref={setOverlayRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-2"
        >
          {loading ? (
            <p className="py-8 text-center text-aldi-muted">
              {tCommon("loading")}
            </p>
          ) : (
            <ShoppingListContent
              key={`${listKey}-${store?.store_id ?? "none"}`}
              sortMode={sortMode}
              onLastItemChecked={handleLastItemChecked}
            />
          )}
        </div>
      </div>

      {showCompletion && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-aldi-blue text-white transition-opacity duration-200"
          role="alert"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl">✓</span>
            <span className="text-xl font-semibold">{tList("tripComplete")}</span>
          </div>
        </div>
      )}
    </main>
  );
}
