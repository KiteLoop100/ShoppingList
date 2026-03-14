"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useProducts } from "@/lib/products-context";
import { useCurrentCountry } from "@/lib/current-country-context";
import type { RecentListProduct, ReceiptProduct } from "@/lib/list";
import type { Product, SortMode } from "@/types";
import dynamic from "next/dynamic";
import { useAddToList } from "./hooks/use-add-to-list";
import { useSearchExecution, MIN_QUERY_LENGTH } from "./hooks/use-search-execution";
import { SearchResultsPanel } from "./search-results-panel";
import { RecentPurchasesPanel } from "./recent-purchases-panel";
import { SpecialsPanel } from "./specials-panel";
import { RetailerProductsPanel } from "./retailer-products-panel";
import { PurchaseHistoryMenu, type MenuSelection } from "./purchase-history-menu";
import { ConsumedPanel } from "./consumed-panel";

export type { SortMode } from "@/types";

const BarcodeScannerModal = dynamic(
  () => import("./barcode-scanner-modal").then(m => m.BarcodeScannerModal),
  { ssr: false }
);

export interface ProductSearchProps {
  placeholder: string;
  onAdded?: () => void;
  className?: string;
  "aria-label"?: string;
  /** When set, search results render as full overlay inside this container (covers list). */
  overlayContainerRef?: React.RefObject<HTMLDivElement | null>;
  sortMode?: SortMode;
  onSortModeChange?: (mode: SortMode) => void;
}

export function ProductSearch({
  placeholder, onAdded, className = "", "aria-label": ariaLabel,
  overlayContainerRef, sortMode, onSortModeChange,
}: ProductSearchProps) {
  const t = useTranslations("search");
  const { products } = useProducts();
  const { country } = useCurrentCountry();
  const [query, setQuery] = useState("");
  const [displayQuery, setDisplayQuery] = useState("");
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [sortToastText, setSortToastText] = useState<string | null>(null);
  const sortToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = (typeof window !== "undefined" && document.documentElement.lang) || "de";

  const {
    results, recentListProducts, specialsProducts, retailerProducts,
    receiptProducts, receiptTitle,
    isSearching: loading, isRecentCommand, isSpecialsCommand, isConsumedCmd,
    retailerPrefix, receiptCommand, trimmedQuery, resetResults,
  } = useSearchExecution({ query, products, country });

  const resetSearch = useCallback(() => { setQuery(""); setDisplayQuery(""); resetResults(); }, [resetResults]);
  const focusInput = useCallback(() => { inputRef.current?.focus(); }, []);

  const {
    adding, errorMsg, justAdded, clearError, setError,
    addGeneric, addSpecific, addCompetitorProduct, addFromBarcode, addFromBarcodeCompetitor, confirmBatchAdd,
  } = useAddToList({
    query, country, retailerPrefix, products, onAdded,
    resetSearch, focusInput,
    t: t as (key: string, values?: Record<string, string>) => string,
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addGeneric(); inputRef.current?.blur(); }
  }, [addGeneric]);

  const clearSearch = useCallback(() => { resetSearch(); focusInput(); }, [resetSearch, focusInput]);

  const confirmRecentPurchases = useCallback(
    async (selectedItems: { product_id: string; quantity: number }[]) => {
      const ok = await confirmBatchAdd(selectedItems);
      if (ok) focusInput();
    },
    [confirmBatchAdd, focusInput],
  );
  const confirmSpecials = useCallback(
    async (items: { product_id: string; quantity: number }[]) => { await confirmBatchAdd(items); },
    [confirmBatchAdd],
  );
  const handleMenuSelect = useCallback((selection: MenuSelection) => {
    inputRef.current?.blur();
    setQuery(selection.command);
    setDisplayQuery(selection.label);
  }, []);

  const handleSortToggle = useCallback(() => {
    if (!sortMode || !onSortModeChange) return;
    const SORT_CYCLE: SortMode[] = ["my-order", "shopping-order", "shopping-order-tiles"];
    const currentIdx = SORT_CYCLE.indexOf(sortMode);
    const newMode = SORT_CYCLE[(currentIdx + 1) % SORT_CYCLE.length];
    onSortModeChange(newMode);
    const LABEL_KEYS: Record<SortMode, string> = {
      "my-order": "chipSortMyOrder",
      "shopping-order": "chipSortShoppingOrder",
      "shopping-order-tiles": "chipSortShoppingOrderTiles",
    };
    setSortToastText(t(LABEL_KEYS[newMode]));
    if (sortToastTimerRef.current) clearTimeout(sortToastTimerRef.current);
    sortToastTimerRef.current = setTimeout(() => setSortToastText(null), 2000);
  }, [sortMode, onSortModeChange, t]);

  const showResults = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showClear = query.length > 0 || displayQuery.length > 0;
  const showChips = query.length === 0;
  const recentForPanel: RecentListProduct[] | null =
    recentListProducts === "pending" || recentListProducts === null ? null : recentListProducts;
  const specialsForPanel: Product[] | null =
    specialsProducts === "pending" || specialsProducts === null ? null : specialsProducts;
  const receiptForPanel: ReceiptProduct[] | null =
    receiptProducts === "pending" || receiptProducts === null ? null : receiptProducts;

  const receiptPanelTitle = useMemo(() => {
    if (!receiptCommand || !receiptTitle) return "";
    const { retailer, mode, n } = receiptCommand;
    const displayRetailer = retailer === "ALDI" ? "ALDI SÜD" : retailer;
    if (mode === "single") {
      const key = n <= 2 ? `receiptTitleSingle${n}` : "receiptTitleSingle0";
      return t(key, { retailer: displayRetailer });
    }
    if (mode === "combined") return t("receiptTitleCombined", { retailer: displayRetailer, count: n });
    return t("receiptTitleNotRecently", { retailer: displayRetailer });
  }, [receiptCommand, receiptTitle, t]);

  const receiptRecentProducts: RecentListProduct[] = useMemo(
    () => (receiptForPanel ?? []).map((rp) => ({ product_id: rp.product_id, frequency: rp.frequency })),
    [receiptForPanel],
  );

  const resultsContent = showResults && (
    isConsumedCmd ? (
      <ConsumedPanel onCancel={clearSearch} />
    ) : receiptCommand ? (
      <RecentPurchasesPanel
        recentProducts={receiptRecentProducts} products={products} loading={loading}
        onConfirm={confirmRecentPurchases} onCancel={clearSearch}
        addCountLabel={(count) => t("lastTripAddCount", { count })}
        cancelLabel={t("lastTripCancel")} titleLabel={receiptPanelTitle}
        noneLabel={t("recentPurchasesNone")} loadingLabel={t("searching")}
        receiptProducts={receiptForPanel ?? undefined}
      />
    ) : isRecentCommand ? (
      <RecentPurchasesPanel
        recentProducts={recentForPanel ?? []} products={products} loading={loading}
        onConfirm={confirmRecentPurchases} onCancel={clearSearch}
        addCountLabel={(count) => t("lastTripAddCount", { count })}
        cancelLabel={t("lastTripCancel")} titleLabel={t("recentPurchasesTitle")}
        noneLabel={t("recentPurchasesNone")} loadingLabel={t("searching")}
      />
    ) : isSpecialsCommand ? (
      <SpecialsPanel
        specials={specialsForPanel ?? []} loading={loading}
        onConfirm={confirmSpecials} onCancel={clearSearch}
        addCountLabel={(count) => t("specialsAddCount", { count })}
        cancelLabel={t("specialsCancel")} titleLabel={t("specialsTitle")}
        noneLabel={t("specialsNone")} loadingLabel={t("searching")} locale={locale}
      />
    ) : retailerPrefix ? (
      <RetailerProductsPanel
        loading={loading} retailer={retailerPrefix.retailer}
        products={retailerProducts} productQuery={retailerPrefix.productQuery}
        onSelect={addCompetitorProduct} onAddGeneric={addGeneric}
        searchingLabel={t("searching")}
        noProductsLabel={t("retailerNoProducts", { retailer: retailerPrefix.retailer.name })}
        myPurchasesLabel={t("retailerMyPurchases")} otherProductsLabel={t("retailerOtherProducts")}
      />
    ) : (
      <SearchResultsPanel
        loading={loading} results={results} query={query}
        onSelect={addSpecific} onAddGeneric={addGeneric}
        noResultsLabel={t("noResults", { query: trimmedQuery })} searchingLabel={t("searching")}
      />
    )
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div
          className={`min-w-0 flex-1 rounded-xl border-2 bg-white transition-colors duration-200 ${
            justAdded
              ? "border-aldi-success animate-add-flash"
              : "border-aldi-muted-light focus-within:border-aldi-blue"
          }`}
        >
          <div className="flex items-center">
            <input
              ref={inputRef} type="search" value={displayQuery || query}
              onChange={(e) => { setDisplayQuery(""); setQuery(e.target.value); }} onKeyDown={handleKeyDown}
              onBlur={() => { setTimeout(() => window.scrollTo({ top: 0 }), 100); }}
              placeholder={placeholder} aria-label={ariaLabel ?? placeholder}
              autoComplete="off" enterKeyHint="done" disabled={adding}
              className="min-h-touch min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:outline-none disabled:opacity-50"
            />
            {showChips && (
              <PurchaseHistoryMenu onSelect={handleMenuSelect} />
            )}
            <button type="button" onClick={() => setBarcodeScannerOpen(true)} aria-label={t("barcodeScanner")}
              className="touch-target shrink-0 px-2 text-aldi-muted transition-colors hover:text-aldi-blue">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showClear && (
              <button type="button" onClick={clearSearch} aria-label={t("clear")}
                className="touch-target shrink-0 px-2 text-aldi-muted transition-colors hover:text-aldi-text">
                ✕
              </button>
            )}
          </div>
        </div>
        {sortMode && onSortModeChange && (
          <button type="button" onClick={handleSortToggle}
            className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
              sortMode !== "my-order"
                ? "border-aldi-blue bg-aldi-blue/10 text-aldi-blue"
                : "border-aldi-muted-light bg-white text-aldi-muted hover:border-aldi-blue/50 hover:text-aldi-blue"
            }`}
            aria-label={
              sortMode === "my-order" ? t("chipSortMyOrder")
              : sortMode === "shopping-order" ? t("chipSortShoppingOrder")
              : t("chipSortShoppingOrderTiles")
            }>
            {sortMode === "shopping-order-tiles" ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h12M3 17h6" />
              </svg>
            )}
          </button>
        )}
      </div>
      {sortToastText && (
        <div className="mt-1.5 animate-fade-in rounded-lg bg-aldi-blue/10 px-3 py-1 text-center text-xs font-medium text-aldi-blue"
          role="status" aria-live="polite">
          {t("sortToast", { mode: sortToastText })}
        </div>
      )}
      {adding && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-aldi-blue/5 border border-aldi-blue/20 px-3 py-2"
          role="status" aria-live="polite">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
          <span className="text-sm font-medium text-aldi-blue animate-pulse">{t("addingProduct")}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMsg}
          <button type="button" className="ml-2 font-bold" onClick={clearError}>✕</button>
        </div>
      )}
      {showResults && overlayContainerRef?.current
        ? createPortal(resultsContent, overlayContainerRef.current)
        : showResults && !overlayContainerRef && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[60vh] overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-lg"
              role="listbox">
              {resultsContent}
            </div>
          )}
      <BarcodeScannerModal
        open={barcodeScannerOpen} onClose={() => setBarcodeScannerOpen(false)}
        onProductAdded={addFromBarcode}
        onCompetitorProductAdded={addFromBarcodeCompetitor}
        onProductNotFound={() => { setError(t("barcodeNotFound")); }}
      />
    </div>
  );
}
