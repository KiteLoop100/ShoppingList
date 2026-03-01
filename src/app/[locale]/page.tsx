"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/lib/i18n/navigation";
import { ProductSearch } from "@/components/search/product-search";
import { ShoppingListContent } from "@/components/list/shopping-list-content";
import { useListData } from "@/components/list/use-list-data";
import { seedIfNeeded } from "@/lib/db/seed";
import { archiveListAsTrip } from "@/lib/list";
import { usePersistedSort } from "@/hooks/use-persisted-sort";
import { useStoreDetection } from "@/hooks/use-store-detection";
import { OnboardingFlow, ONBOARDING_COMPLETE_KEY } from "@/components/onboarding/onboarding-flow";
import { useAuth } from "@/lib/auth/auth-context";

const COMPLETION_DELAY_MS = 1800;

export default function MainScreenPage() {
  const t = useTranslations("home");
  const tList = useTranslations("list");
  const tStore = useTranslations("store");
  const tCommon = useTranslations("common");
  const tCapture = useTranslations("capture");
  const tFlyer = useTranslations("flyer");
  const tReceipts = useTranslations("receipts");

  const [showCompletion, setShowCompletion] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const searchParams = useSearchParams();
  const { user, isAnonymous } = useAuth();

  useEffect(() => {
    const forceShow = searchParams.get("onboarding") === "true";
    if (forceShow) {
      setShowOnboarding(true);
      return;
    }
    const done = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (!done && (!user || isAnonymous)) {
      setShowOnboarding(true);
    }
  }, [searchParams, user, isAnonymous]);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const {
    sortMode,
    userHasManuallyChosenSort,
    sortReady,
    sortRestoredFromSession,
    setSortMode,
    setUserHasManuallyChosenSort,
  } = usePersistedSort();

  const listData = useListData(sortMode);
  const { loading, refetch, listId, store } = listData;

  const stableListData = useMemo(
    () => ({
      listId: listData.listId,
      store: listData.store,
      unchecked: listData.unchecked,
      checked: listData.checked,
      deferred: listData.deferred,
      total: listData.total,
      withoutPriceCount: listData.withoutPriceCount,
      loading: listData.loading,
      dataSortMode: listData.dataSortMode,
      refetch: listData.refetch,
      setItemChecked: listData.setItemChecked,
      setItemQuantity: listData.setItemQuantity,
      removeItem: listData.removeItem,
      deferItem: listData.deferItem,
      undeferItem: listData.undeferItem,
      setBuyElsewhere: listData.setBuyElsewhere,
    }),
    [
      listData.listId,
      listData.store,
      listData.unchecked,
      listData.checked,
      listData.deferred,
      listData.total,
      listData.withoutPriceCount,
      listData.loading,
      listData.dataSortMode,
      listData.refetch,
      listData.setItemChecked,
      listData.setItemQuantity,
      listData.removeItem,
      listData.deferItem,
      listData.undeferItem,
      listData.setBuyElsewhere,
    ]
  );

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const { isInStore, detectedStoreName, showSortToast, resetOnCompletion } = useStoreDetection({
    listId,
    loading,
    storeId: store?.store_id,
    userHasManuallyChosenSort,
    sortRestoredFromSession,
    setSortMode,
    setUserHasManuallyChosenSort,
    refetchRef,
  });

  useEffect(() => {
    seedIfNeeded();
  }, []);

  const handleSortModeChange = useCallback((mode: Parameters<typeof setSortMode>[0]) => {
    setSortMode(mode);
    setUserHasManuallyChosenSort(true);
  }, [setSortMode, setUserHasManuallyChosenSort]);

  const handleAdded = useCallback(() => {
    refetch();
  }, [refetch]);

  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUncheckedCountRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, []);

  const handleLastItemChecked = useCallback(
    async (checkedListId: string, deferredItemIds: string[]) => {
      resetOnCompletion();
      await archiveListAsTrip(checkedListId, deferredItemIds);
      setUserHasManuallyChosenSort(false);
      setSortMode("my-order");
      setShowCompletion(true);
      refetch();
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        setShowCompletion(false);
      }, COMPLETION_DELAY_MS);
    },
    [refetch, setSortMode, setUserHasManuallyChosenSort, resetOnCompletion]
  );

  // Detect "last item checked" directly from stableListData — avoids child → callback → parent cascade.
  useEffect(() => {
    const uncheckedCount = stableListData.unchecked.length;
    const checkedCount = stableListData.checked.length;
    const listIdArg = stableListData.listId;
    const prevVal = prevUncheckedCountRef.current;
    const hadUnchecked = prevVal !== null && prevVal > 0;
    const nowAllChecked = uncheckedCount === 0 && checkedCount > 0;
    prevUncheckedCountRef.current = uncheckedCount;
    if (hadUnchecked && nowAllChecked && listIdArg) {
      const deferredIds = stableListData.deferred.map((d) => d.item_id);
      handleLastItemChecked(listIdArg, deferredIds);
    }
  // stableListData.unchecked / checked / deferred are stable array refs from useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableListData.unchecked, stableListData.checked, stableListData.deferred, stableListData.listId, handleLastItemChecked]);

  const overlayContainerRef = useRef<HTMLDivElement>(null);

  return (
    <main className="mx-auto flex h-screen max-w-lg flex-col overflow-hidden bg-aldi-bg">
      <header className="flex shrink-0 items-center gap-2 bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex-1">
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-aldi-text">
            {tCommon("appName")}
          </h1>
          <p className={`text-[12px] leading-tight ${detectedStoreName ? "text-green-600" : "text-gray-400"}`}>
            {detectedStoreName
              ? tStore("storeDetected", { storeName: detectedStoreName })
              : tStore("noStoreDetected")}
          </p>
        </div>
        <Link
          href="/capture"
          className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCapture("navLabel")}
        >
          <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </Link>
        <Link
          href="/receipts"
          className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tReceipts("navLabel")}
        >
          <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </Link>
        <Link
          href="/flyer"
          className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tFlyer("navLabel")}
        >
          <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
          </svg>
        </Link>
        <Link
          href="/settings"
          className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("settings")}
        >
          <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ProductSearch
          placeholder={t("searchPlaceholder")}
          onAdded={handleAdded}
          className="shrink-0 px-4 pt-4"
          aria-label={t("searchPlaceholder")}
          overlayContainerRef={overlayContainerRef}
          sortMode={sortReady ? sortMode : undefined}
          onSortModeChange={handleSortModeChange}
        />

        {showSortToast && (
          <div
            className="mx-4 mb-1 rounded-lg bg-aldi-blue/10 px-3 py-1.5 text-center text-xs text-aldi-blue"
            role="status"
            aria-live="polite"
          >
            {tList("sortSwitchedToShoppingOrder")}
          </div>
        )}

        <div
          ref={overlayContainerRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2"
        >
          {sortReady && (
            <ShoppingListContent
              sortMode={sortMode}
              listData={stableListData}
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

      {showOnboarding && (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          showSkip={searchParams.get("onboarding") !== "true"}
        />
      )}
    </main>
  );
}
