"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { log } from "@/lib/utils/logger";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { searchModule, isLastTripCommand, isAktionsartikelCommand, detectRetailerPrefix, type RetailerPrefixResult } from "@/lib/search";
import { useProducts } from "@/lib/products-context";
import { useCurrentCountry } from "@/lib/current-country-context";
import type { Product, SearchResult } from "@/types";
import {
  getOrCreateActiveList,
  addListItem,
  getRecentListProducts,
  type RecentListProduct,
} from "@/lib/list";
import { assignCategory, CategoryAssignmentError } from "@/lib/category/assign-category";
import { BarcodeScannerModal } from "./barcode-scanner-modal";
import { SearchResultsPanel } from "./search-results-panel";
import { RecentPurchasesPanel } from "./recent-purchases-panel";
import { SpecialsPanel } from "./specials-panel";

const SEARCH_DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 1;

export type { SortMode } from "@/types";
import type { SortMode } from "@/types";

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
  placeholder,
  onAdded,
  className = "",
  "aria-label": ariaLabel,
  overlayContainerRef,
  sortMode,
  onSortModeChange,
}: ProductSearchProps) {
  const t = useTranslations("search");
  const { products } = useProducts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [recentListProducts, setRecentListProducts] = useState<
    RecentListProduct[] | null | "pending"
  >(null);
  const [specialsProducts, setSpecialsProducts] = useState<Product[] | null | "pending">(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sortToastText, setSortToastText] = useState<string | null>(null);
  const sortToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = (typeof window !== "undefined" && document.documentElement.lang) || "de";

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const isRecentCommand = useMemo(
    () => trimmedQuery.length >= MIN_QUERY_LENGTH && isLastTripCommand(trimmedQuery),
    [trimmedQuery]
  );
  const isSpecialsCommand = useMemo(
    () => trimmedQuery.length >= MIN_QUERY_LENGTH && isAktionsartikelCommand(trimmedQuery),
    [trimmedQuery]
  );

  const { country } = useCurrentCountry();

  const retailerPrefix = useMemo(
    (): RetailerPrefixResult | null =>
      trimmedQuery.length >= MIN_QUERY_LENGTH
        ? detectRetailerPrefix(trimmedQuery, country ?? "DE")
        : null,
    [trimmedQuery, country]
  );

  const productsRef = useRef(products);
  productsRef.current = products;
  const countryRef = useRef(country);
  countryRef.current = country;

  const runSearch = useCallback(async (q: string, id: number) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const currentProducts = productsRef.current;
      if (currentProducts.length > 0) {
        const list = await searchModule({
          query: trimmed,
          limit: 50,
          products: currentProducts,
        });
        if (id !== searchIdRef.current) return;
        setResults(list);
        return;
      }
      const countryCode = countryRef.current ?? "DE";
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(trimmed)}&country=${encodeURIComponent(countryCode)}&limit=20`
      );
      if (id !== searchIdRef.current) return;
      if (!res.ok) {
        setResults([]);
        return;
      }
      const json = (await res.json()) as { products?: Array<{ product_id: string; name: string; category_id: string; category_name: string; price: number | null }> };
      const list: SearchResult[] = (json.products ?? []).map((p) => ({
        product_id: p.product_id,
        name: p.name,
        category_id: p.category_id,
        category_name: p.category_name ?? "",
        price: p.price,
        score: 1,
        source: "other" as const,
      }));
      if (id !== searchIdRef.current) return;
      setResults(list);
    } finally {
      if (id === searchIdRef.current) setLoading(false);
    }
  }, []);

  const fetchRecentPurchases = useCallback(async () => {
    setLoading(true);
    setRecentListProducts("pending");
    try {
      const list = await getRecentListProducts();
      setRecentListProducts(list);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSpecials = useCallback(() => {
    setLoading(true);
    setSpecialsProducts("pending");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourWeeksAgo = new Date(today);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const specials = productsRef.current
      .filter((p) => {
        if (p.status !== "active") return false;
        const at = (p as { assortment_type?: string }).assortment_type;
        if (at !== "special" && at !== "special_food" && at !== "special_nonfood") return false;
        const startStr = (p as { special_start_date?: string | null }).special_start_date;
        if (startStr) {
          const start = new Date(startStr);
          if (start < fourWeeksAgo) return false;
        }
        const endStr = (p as { special_end_date?: string | null }).special_end_date;
        if (endStr) {
          const end = new Date(endStr);
          if (end < today) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aDate = (a as { special_start_date?: string | null }).special_start_date ?? "";
        const bDate = (b as { special_start_date?: string | null }).special_start_date ?? "";
        return bDate.localeCompare(aDate);
      })
      .slice(0, 100);

    setSpecialsProducts(specials);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = ++searchIdRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isRecentCommand) {
        setResults([]);
        setSpecialsProducts(null);
        fetchRecentPurchases();
      } else if (isSpecialsCommand) {
        setResults([]);
        setRecentListProducts(null);
        fetchSpecials();
      } else if (retailerPrefix) {
        setRecentListProducts(null);
        setSpecialsProducts(null);
        setResults([]);
      } else {
        setRecentListProducts(null);
        setSpecialsProducts(null);
        runSearch(query, id);
      }
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isRecentCommand, isSpecialsCommand, retailerPrefix, runSearch, fetchRecentPurchases, fetchSpecials]);

  const ensureListId = useCallback(async () => {
    const list = await getOrCreateActiveList();
    return list.list_id;
  }, []);

  const addGeneric = useCallback(async () => {
    const raw = query.trim();
    if (!raw) return;
    const rp = detectRetailerPrefix(raw, country ?? "DE");
    const name = rp ? rp.productQuery : raw;
    if (!name) return;
    setErrorMsg(null);
    setAdding(true);
    try {
      const lid = await ensureListId();
      const { category_id } = await assignCategory(name);
      await addListItem({
        list_id: lid,
        product_id: null,
        custom_name: name,
        display_name: name,
        category_id,
        quantity: 1,
        buy_elsewhere_retailer: rp ? rp.retailer.name : null,
      });
    } catch (e) {
      log.error("[addGeneric] failed:", e);
      setAdding(false);
      if (e instanceof CategoryAssignmentError) {
        setErrorMsg(t("categoryAssignmentFailed"));
      } else {
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    setAdding(false);
    setQuery("");
    setResults([]);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 400);
    onAdded?.();
    inputRef.current?.focus();
  }, [query, country, ensureListId, onAdded, t]);

  const addSpecific = useCallback(
    async (result: SearchResult) => {
      setErrorMsg(null);
      try {
        const lid = await ensureListId();
        await addListItem({
          list_id: lid,
          product_id: result.product_id,
          custom_name: null,
          display_name: result.name,
          category_id: result.category_id,
          quantity: 1,
        });
      } catch (e) {
        log.error("[addSpecific] failed:", e);
        setErrorMsg(e instanceof Error ? e.message : String(e));
        return;
      }
      setQuery("");
      setResults([]);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 400);
      onAdded?.();
      inputRef.current?.focus();
    },
    [ensureListId, onAdded]
  );

  const addProductFromBarcode = useCallback(
    async (product: Product) => {
      setErrorMsg(null);
      try {
        const lid = await ensureListId();
        if (!lid) return;
        await addListItem({
          list_id: lid,
          product_id: product.product_id,
          custom_name: null,
          display_name: product.name,
          category_id: product.category_id,
          quantity: 1,
        });
      } catch (e) {
        log.error("[addProductFromBarcode] failed:", e);
        setErrorMsg(t("unexpectedError", { message: e instanceof Error ? e.message : String(e) }));
        return;
      }
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 400);
      onAdded?.();
    },
    [ensureListId, onAdded, t]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addGeneric();
        inputRef.current?.blur();
      }
    },
    [addGeneric]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setRecentListProducts(null);
    setSpecialsProducts(null);
    inputRef.current?.focus();
  }, []);

  const addSelectedItemsToList = useCallback(
    async (selectedItems: { product_id: string; quantity: number }[]): Promise<void> => {
      if (selectedItems.length === 0) return;
      const productMap = new Map(productsRef.current.map((p) => [p.product_id, p]));
      const lid = await ensureListId();
      for (const { product_id, quantity } of selectedItems) {
        const product = productMap.get(product_id);
        if (!product) continue;
        await addListItem({
          list_id: lid,
          product_id: product.product_id,
          custom_name: null,
          display_name: product.name,
          category_id: product.category_id,
          quantity,
        });
      }
    },
    [ensureListId]
  );

  const confirmRecentPurchases = useCallback(
    async (selectedItems: { product_id: string; quantity: number }[]) => {
      setErrorMsg(null);
      try {
        await addSelectedItemsToList(selectedItems);
      } catch (e) {
        log.error("[confirmRecentPurchases] failed:", e);
        setErrorMsg(t("unexpectedError", { message: e instanceof Error ? e.message : String(e) }));
        return;
      }
      setQuery("");
      setResults([]);
      setRecentListProducts(null);
      onAdded?.();
      inputRef.current?.focus();
    },
    [addSelectedItemsToList, onAdded, t]
  );

  const confirmSpecials = useCallback(
    async (selectedItems: { product_id: string; quantity: number }[]) => {
      setErrorMsg(null);
      try {
        await addSelectedItemsToList(selectedItems);
      } catch (e) {
        log.error("[confirmSpecials] failed:", e);
        setErrorMsg(t("unexpectedError", { message: e instanceof Error ? e.message : String(e) }));
        return;
      }
      setQuery("");
      setResults([]);
      setSpecialsProducts(null);
      onAdded?.();
    },
    [addSelectedItemsToList, onAdded, t]
  );

  const triggerRecentPurchases = useCallback(() => {
    inputRef.current?.blur();
    setQuery("letzte einkäufe");
  }, []);

  const triggerAktionsartikel = useCallback(() => {
    inputRef.current?.blur();
    setQuery("aktionsartikel");
  }, []);

  const handleSortToggle = useCallback(() => {
    if (!sortMode || !onSortModeChange) return;
    const newMode: SortMode = sortMode === "my-order" ? "shopping-order" : "my-order";
    onSortModeChange(newMode);
    const label = newMode === "my-order" ? t("chipSortMyOrder") : t("chipSortShoppingOrder");
    setSortToastText(label);
    if (sortToastTimerRef.current) clearTimeout(sortToastTimerRef.current);
    sortToastTimerRef.current = setTimeout(() => setSortToastText(null), 2000);
  }, [sortMode, onSortModeChange, t]);

  const showResults = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showClear = query.length > 0;

  const recentListForPanel: RecentListProduct[] | null =
    recentListProducts === "pending" || recentListProducts === null
      ? null
      : recentListProducts;

  const specialsForPanel: Product[] | null =
    specialsProducts === "pending" || specialsProducts === null
      ? null
      : specialsProducts;

  const resultsContent = showResults && (
    isRecentCommand ? (
      <RecentPurchasesPanel
        recentProducts={recentListForPanel ?? []}
        products={products}
        loading={loading}
        onConfirm={confirmRecentPurchases}
        onCancel={clearSearch}
        addCountLabel={(count) => t("lastTripAddCount", { count })}
        cancelLabel={t("lastTripCancel")}
        titleLabel={t("recentPurchasesTitle")}
        noneLabel={t("recentPurchasesNone")}
        loadingLabel={t("searching")}
      />
    ) : isSpecialsCommand ? (
      <SpecialsPanel
        specials={specialsForPanel ?? []}
        loading={loading}
        onConfirm={confirmSpecials}
        onCancel={clearSearch}
        addCountLabel={(count) => t("specialsAddCount", { count })}
        cancelLabel={t("specialsCancel")}
        titleLabel={t("specialsTitle")}
        noneLabel={t("specialsNone")}
        loadingLabel={t("searching")}
        locale={locale}
      />
    ) : retailerPrefix ? (
      <div className="p-4 text-center">
        {retailerPrefix.productQuery ? (
          <p className="text-sm text-aldi-muted">
            {t("retailerHint", { retailer: retailerPrefix.retailer.name })}
          </p>
        ) : (
          <p className="text-sm text-aldi-muted">
            {t("retailerNoItems", { retailer: retailerPrefix.retailer.name })}
          </p>
        )}
      </div>
    ) : (
      <SearchResultsPanel
        loading={loading}
        results={results}
        query={query}
        onSelect={addSpecific}
        onAddGeneric={addGeneric}
        noResultsLabel={t("noResults", { query: trimmedQuery })}
        searchingLabel={t("searching")}
      />
    )
  );

  const showChips = query.length === 0;

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
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setTimeout(() => window.scrollTo({ top: 0 }), 100);
              }}
              placeholder={placeholder}
              aria-label={ariaLabel ?? placeholder}
              autoComplete="off"
              enterKeyHint="done"
              disabled={adding}
              className="min-h-touch min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:outline-none disabled:opacity-50"
            />
            {showChips && (
              <button
                type="button"
                onClick={triggerRecentPurchases}
                className="shrink-0 rounded-full border border-aldi-muted-light bg-gray-50 px-2 py-0.5 text-[10px] text-aldi-muted transition-colors hover:border-aldi-blue/50 hover:text-aldi-blue"
              >
                {t("chipRecentPurchases")}
              </button>
            )}
            <button
              type="button"
              className="touch-target shrink-0 px-2 text-aldi-muted transition-colors hover:text-aldi-blue"
              onClick={() => setBarcodeScannerOpen(true)}
              aria-label={t("barcodeScanner")}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {showClear && (
              <button
                type="button"
                className="touch-target shrink-0 px-2 text-aldi-muted transition-colors hover:text-aldi-text"
                onClick={clearSearch}
                aria-label={t("clear")}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {sortMode && onSortModeChange && (
          <button
            type="button"
            onClick={handleSortToggle}
            className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
              sortMode === "shopping-order"
                ? "border-aldi-blue bg-aldi-blue/10 text-aldi-blue"
                : "border-aldi-muted-light bg-white text-aldi-muted hover:border-aldi-blue/50 hover:text-aldi-blue"
            }`}
            aria-label={sortMode === "my-order" ? t("chipSortMyOrder") : t("chipSortShoppingOrder")}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h12M3 17h6" />
            </svg>
          </button>
        )}
      </div>
      {sortToastText && (
        <div
          className="mt-1.5 animate-fade-in rounded-lg bg-aldi-blue/10 px-3 py-1 text-center text-xs font-medium text-aldi-blue"
          role="status"
          aria-live="polite"
        >
          {t("sortToast", { mode: sortToastText })}
        </div>
      )}
      {adding && (
        <div
          className="mt-2 flex items-center gap-2 rounded-lg bg-aldi-blue/5 border border-aldi-blue/20 px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
          <span className="text-sm font-medium text-aldi-blue animate-pulse">
            {t("addingProduct")}
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {errorMsg}
          <button
            type="button"
            className="ml-2 font-bold"
            onClick={() => setErrorMsg(null)}
          >
            ✕
          </button>
        </div>
      )}
      {showResults && overlayContainerRef?.current
        ? createPortal(
            resultsContent,
            overlayContainerRef.current
          )
        : showResults && !overlayContainerRef && (
            <div
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[60vh] overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-lg"
              role="listbox"
            >
              {resultsContent}
            </div>
          )}
      <BarcodeScannerModal
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onProductAdded={addProductFromBarcode}
        onProductNotFound={() => {
          setErrorMsg(t("barcodeNotFound"));
        }}
      />
    </div>
  );
}
