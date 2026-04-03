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
import { PostShoppingPrompt } from "@/components/feedback/post-shopping-prompt";
import { ScanCompleteBanner } from "@/components/list/scan-complete-banner";
import { useScanButtonVisible } from "@/hooks/use-scan-button-visible";
import { MobileHeader } from "@/components/layout/mobile-header";

const COMPLETION_DELAY_MS = 1800;

export default function MainScreenPage() {
  const t = useTranslations("home");
  const tList = useTranslations("list");
  const tStore = useTranslations("store");
  const tCommon = useTranslations("common");

  const [showCompletion, setShowCompletion] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [lastTripId, setLastTripId] = useState<string | null>(null);
  const [lastCheckedCount, setLastCheckedCount] = useState(0);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
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
      listNotes: listData.listNotes,
      store: listData.store,
      unchecked: listData.unchecked,
      checked: listData.checked,
      deferred: listData.deferred,
      total: listData.total,
      withoutPriceCount: listData.withoutPriceCount,
      cartTotal: listData.cartTotal,
      cartWithoutPriceCount: listData.cartWithoutPriceCount,
      loading: listData.loading,
      dataSortMode: listData.dataSortMode,
      refetch: listData.refetch,
      setItemChecked: listData.setItemChecked,
      setItemQuantity: listData.setItemQuantity,
      removeItem: listData.removeItem,
      uncheckItem: listData.uncheckItem,
      deferItem: listData.deferItem,
      undeferItem: listData.undeferItem,
      setBuyElsewhere: listData.setBuyElsewhere,
      updateItemComment: listData.updateItemComment,
    }),
    [
      listData.listId,
      listData.listNotes,
      listData.store,
      listData.unchecked,
      listData.checked,
      listData.deferred,
      listData.total,
      listData.withoutPriceCount,
      listData.cartTotal,
      listData.cartWithoutPriceCount,
      listData.loading,
      listData.dataSortMode,
      listData.refetch,
      listData.setItemChecked,
      listData.setItemQuantity,
      listData.removeItem,
      listData.uncheckItem,
      listData.deferItem,
      listData.undeferItem,
      listData.setBuyElsewhere,
      listData.updateItemComment,
    ]
  );

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const {
    isInStore,
    detectedStoreName,
    showSortToast,
    gpsEnabled,
    gpsError,
    unknownLocation,
    resetOnCompletion,
  } = useStoreDetection({
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
      const checkedCount = stableListData.checked.length;
      resetOnCompletion();
      const tripId = await archiveListAsTrip(checkedListId, deferredItemIds);
      setUserHasManuallyChosenSort(false);
      setSortMode("my-order");
      setShowCompletion(true);
      refetch();
      if (tripId) {
        setLastTripId(tripId);
        setLastCheckedCount(checkedCount);
      }
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        setShowCompletion(false);
        if (tripId && checkedCount >= 3) {
          setShowFeedbackPrompt(true);
        }
      }, COMPLETION_DELAY_MS);
    },
    [refetch, setSortMode, setUserHasManuallyChosenSort, resetOnCompletion, stableListData.checked.length]
  );

  const [showScanCompleteBanner, setShowScanCompleteBanner] = useState(false);

  const isScanAndGoActive = useMemo(
    () => stableListData.checked.some((i) => i.is_extra_scan),
    [stableListData.checked]
  );

  const hasDefaultStore = store !== null;
  const scanButtonVisible = useScanButtonVisible(gpsEnabled, isInStore, gpsError, isScanAndGoActive, hasDefaultStore);

  // Detect "last item checked" directly from stableListData — avoids child → callback → parent cascade.
  // When Scan & Go is active, suppress auto-archive and show a banner instead.
  useEffect(() => {
    const uncheckedCount = stableListData.unchecked.length;
    const checkedCount = stableListData.checked.length;
    const listIdArg = stableListData.listId;
    const prevVal = prevUncheckedCountRef.current;
    const hadUnchecked = prevVal !== null && prevVal > 0;
    const nowAllChecked = uncheckedCount === 0 && checkedCount > 0;
    prevUncheckedCountRef.current = uncheckedCount;
    if (hadUnchecked && nowAllChecked && listIdArg) {
      if (isScanAndGoActive) {
        setShowScanCompleteBanner(true);
      } else {
        const deferredIds = stableListData.deferred.map((d) => d.item_id);
        handleLastItemChecked(listIdArg, deferredIds);
      }
    }
  // stableListData.unchecked / checked / deferred are stable array refs from useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableListData.unchecked, stableListData.checked, stableListData.deferred, stableListData.listId, handleLastItemChecked, isScanAndGoActive]);

  const handleFinishScanAndGo = useCallback(async () => {
    const listIdArg = stableListData.listId;
    if (!listIdArg) return;
    setShowScanCompleteBanner(false);
    const deferredIds = stableListData.deferred.map((d) => d.item_id);
    await handleLastItemChecked(listIdArg, deferredIds);
  }, [stableListData.listId, stableListData.deferred, handleLastItemChecked]);

  const extraScanCount = useMemo(
    () => stableListData.checked.filter((i) => i.is_extra_scan).length,
    [stableListData.checked]
  );

  const overlayContainerRef = useRef<HTMLDivElement>(null);

  return (
    <main className="mx-auto flex h-screen max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-2xl lg:h-[calc(100vh-49px)] lg:max-w-4xl">
      <MobileHeader detectedStoreName={detectedStoreName} unknownLocation={!!unknownLocation} />

      {detectedStoreName ? (
        <div className="hidden shrink-0 bg-green-50 px-8 py-1.5 text-center text-xs text-green-700 lg:block">
          {tStore("storeDetected", { storeName: detectedStoreName })}
        </div>
      ) : unknownLocation ? (
        <div className="hidden shrink-0 bg-amber-50 px-8 py-1.5 text-center text-xs text-amber-700 lg:block">
          {tStore("gpsActiveNoStore")}{" – "}
          <Link href="/settings" className="underline hover:text-amber-900">
            {tStore("selectStorePrompt")}
          </Link>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ProductSearch
          placeholder={t("searchPlaceholder")}
          onAdded={handleAdded}
          className="shrink-0 px-4 pt-4 md:px-6 lg:px-8"
          aria-label={t("searchPlaceholder")}
          overlayContainerRef={overlayContainerRef}
          sortMode={sortReady ? sortMode : undefined}
          onSortModeChange={handleSortModeChange}
        />

        {showSortToast && (
          <div
            className="mx-4 mb-1 rounded-lg bg-aldi-blue/10 px-3 py-1.5 text-center text-xs text-aldi-blue md:mx-6 lg:mx-8"
            role="status"
            aria-live="polite"
          >
            {tList("sortSwitchedToShoppingOrder")}
          </div>
        )}

        <div
          ref={overlayContainerRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2 md:px-6 md:pb-6 lg:px-8 lg:pb-8"
        >
          {sortReady && (
            <ShoppingListContent
              sortMode={sortMode}
              listData={stableListData}
              scanButtonVisible={scanButtonVisible}
            />
          )}
        </div>
      </div>

      {showScanCompleteBanner && (
        <ScanCompleteBanner
          onContinueScanning={() => setShowScanCompleteBanner(false)}
          onFinishTrip={handleFinishScanAndGo}
        />
      )}

      {showCompletion && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-aldi-blue text-white transition-opacity duration-200"
          role="alert"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-3xl">✓</span>
            <span className="text-xl font-semibold">{tList("tripComplete")}</span>
            {extraScanCount > 0 && (
              <span className="text-sm text-white/80">
                {tList("tripCompleteSummary", {
                  total: lastCheckedCount,
                  extraCount: extraScanCount,
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {showFeedbackPrompt && (
        <PostShoppingPrompt
          tripId={lastTripId}
          checkedCount={lastCheckedCount}
          onDismiss={() => setShowFeedbackPrompt(false)}
        />
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
