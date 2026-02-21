"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { searchModule, isLastTripCommand } from "@/lib/search";
import { useProducts } from "@/lib/products-context";
import type { Product, SearchResult } from "@/types";
import {
  getOrCreateActiveList,
  addListItem,
  getRecentListProducts,
  type RecentListProduct,
} from "@/lib/list";
import { assignCategory } from "@/lib/category/assign-category";
import { BarcodeScannerModal } from "./barcode-scanner-modal";

const SEARCH_DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 1;

/** Erkennt UUID-ähnliche Strings (z. B. Fallback-Anzeige product_id), um sie aus „Letzte Einkäufe“ auszufiltern. */
function looksLikeUuid(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 32) return false;
  return /^[0-9a-f-]{32,36}$/i.test(t) && (t.includes("-") || t.length >= 32);
}

export interface ProductSearchProps {
  placeholder: string;
  onAdded?: () => void;
  className?: string;
  "aria-label"?: string;
  /** When set, search results render as full overlay inside this container (covers list). */
  overlayContainerRef?: React.RefObject<HTMLDivElement | null>;
}

function SearchResultsPanel({
  loading,
  results,
  query,
  onSelect,
  onAddGeneric,
  noResultsLabel,
  searchingLabel,
}: {
  loading: boolean;
  results: SearchResult[];
  query: string;
  onSelect: (r: SearchResult) => void;
  onAddGeneric: () => void;
  noResultsLabel: string;
  searchingLabel: string;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col overflow-auto bg-white"
      role="listbox"
    >
      {loading ? (
        <div className="p-4 text-center text-sm text-aldi-muted">
          {searchingLabel}
        </div>
      ) : results.length === 0 ? (
        <div className="p-4 text-sm text-aldi-muted">{noResultsLabel}</div>
      ) : (
        <ul className="py-2">
          {results.map((r) => (
            <li key={r.product_id} role="option" aria-selected="false">
              <button
                type="button"
                className="flex min-h-touch w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-aldi-text transition-colors hover:bg-aldi-muted-light/40 focus:bg-aldi-muted-light/40 focus:outline-none"
                onClick={() => onSelect(r)}
              >
                <span className="flex-1 truncate">
                  {r.source === "favorite" && <span className="text-aldi-orange">★ </span>}
                  {r.name}
                </span>
                {r.price != null && (
                  <span className="shrink-0 text-sm font-medium tabular-nums text-aldi-muted">
                    €{r.price.toFixed(2)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentPurchasesPanel({
  recentProducts,
  products,
  loading,
  onConfirm,
  onCancel,
  addCountLabel,
  cancelLabel,
  titleLabel,
  noneLabel,
  loadingLabel,
}: {
  recentProducts: RecentListProduct[];
  products: Product[];
  loading: boolean;
  onConfirm: (selectedProductIds: string[]) => void;
  onCancel: () => void;
  addCountLabel: (count: number) => string;
  cancelLabel: string;
  titleLabel: string;
  noneLabel: string;
  loadingLabel: string;
}) {
  const [selected, setSelected] = useState<boolean[]>([]);

  const productMap = new Map(products.map((p) => [p.product_id, p]));
  const validRecentProducts = recentProducts.filter((r) => {
    const product = productMap.get(r.product_id);
    const name = product?.name?.trim();
    return !!name && !looksLikeUuid(name);
  });

  useEffect(() => {
    if (validRecentProducts.length > 0) {
      setSelected(validRecentProducts.map(() => true));
    }
  }, [validRecentProducts.length]);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const effectiveSelected =
    selected.length === validRecentProducts.length
      ? selected
      : validRecentProducts.map(() => true);
  const selectedCount = effectiveSelected.filter(Boolean).length;
  const selectedProductIds = validRecentProducts
    .filter((_, i) => effectiveSelected[i])
    .map((r) => r.product_id);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col bg-white"
      role="dialog"
      aria-label={titleLabel}
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-aldi-muted">
          {loadingLabel}
        </div>
      ) : validRecentProducts.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center p-4">
          <p className="text-center text-sm text-aldi-muted">{noneLabel}</p>
          <button
            type="button"
            className="touch-target mt-4 w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-text transition-colors hover:bg-gray-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-aldi-muted-light px-4 py-3">
            <h2 className="text-lg font-bold text-aldi-blue">{titleLabel}</h2>
          </div>
          <div className="flex shrink-0 gap-3 border-b border-aldi-muted-light bg-white p-3">
            <button
              type="button"
              className="touch-target w-1/2 min-w-[120px] rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-text transition-colors hover:bg-aldi-muted-light/40"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="touch-target w-1/2 min-w-[120px] rounded-xl border-2 border-aldi-blue bg-aldi-blue px-4 py-3 font-semibold text-white transition-colors hover:bg-aldi-blue/90"
              onClick={() => onConfirm(selectedProductIds)}
            >
              {addCountLabel(selectedCount)}
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto py-2" role="listbox" style={{ minHeight: 0 }}>
            {validRecentProducts.map((r, index) => {
              const product = productMap.get(r.product_id);
              const name = product?.name ?? r.product_id;
              return (
                <li key={r.product_id} role="option">
                  <button
                    type="button"
                    className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-aldi-muted-light/40"
                    onClick={() => toggle(index)}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
                        effectiveSelected[index]
                          ? "border-aldi-blue bg-aldi-blue text-white"
                          : "border-aldi-muted-light text-transparent"
                      }`}
                      aria-hidden
                    >
                      ✓
                    </span>
                    {product?.thumbnail_url && (
                      <img
                        src={product.thumbnail_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] text-aldi-text">
                      {name}
                    </span>
                    {product?.price != null && (
                      <span className="shrink-0 text-sm tabular-nums text-aldi-muted">
                        €{product.price.toFixed(2)}
                      </span>
                    )}
                    <span className="shrink-0 text-sm text-aldi-muted">
                      {r.frequency}×
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function ProductSearch({
  placeholder,
  onAdded,
  className = "",
  "aria-label": ariaLabel,
  overlayContainerRef,
}: ProductSearchProps) {
  const t = useTranslations("search");
  const { products } = useProducts();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [recentListProducts, setRecentListProducts] = useState<
    RecentListProduct[] | null | "pending"
  >(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const isCommand = trimmedQuery.length >= MIN_QUERY_LENGTH && isLastTripCommand(trimmedQuery);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await searchModule({
        query: trimmed,
        limit: 20,
        products: products.length > 0 ? products : undefined,
      });
      setResults(list);
    } finally {
      setLoading(false);
    }
  }, [products]);

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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (isCommand) {
        setResults([]);
        fetchRecentPurchases();
      } else {
        setRecentListProducts(null);
        runSearch(query);
      }
      debounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isCommand, runSearch, fetchRecentPurchases]);

  const ensureListId = useCallback(async () => {
    if (listId) return listId;
    const list = await getOrCreateActiveList();
    setListId(list.list_id);
    return list.list_id;
  }, [listId]);

  const addGeneric = useCallback(async () => {
    const name = query.trim();
    if (!name) return;
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
      });
    } catch (e) {
      console.error("[addGeneric] failed:", e);
      return;
    }
    setQuery("");
    setResults([]);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 400);
    onAdded?.();
    inputRef.current?.focus();
  }, [query, ensureListId, onAdded]);

  const addSpecific = useCallback(
    async (result: SearchResult) => {
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
        console.error("[addSpecific] failed:", e);
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
        console.error("[addProductFromBarcode] failed:", e);
        return;
      }
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 400);
      onAdded?.();
    },
    [ensureListId, onAdded]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (results.length > 0) {
          addSpecific(results[0]);
        } else {
          addGeneric();
        }
      }
    },
    [results, addSpecific, addGeneric]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setRecentListProducts(null);
    inputRef.current?.focus();
  }, []);

  const confirmRecentPurchases = useCallback(
    async (selectedProductIds: string[]) => {
      if (selectedProductIds.length === 0) return;
      const productMap = new Map(products.map((p) => [p.product_id, p]));
      try {
        const lid = await ensureListId();
        for (const product_id of selectedProductIds) {
          const product = productMap.get(product_id);
          if (!product) continue;
          await addListItem({
            list_id: lid,
            product_id: product.product_id,
            custom_name: null,
            display_name: product.name,
            category_id: product.category_id,
            quantity: 1,
          });
        }
      } catch (e) {
        console.error("[confirmRecentPurchases] failed:", e);
        return;
      }
      setQuery("");
      setResults([]);
      setRecentListProducts(null);
      onAdded?.();
      inputRef.current?.focus();
    },
    [ensureListId, onAdded, products]
  );

  const cancelRecentPurchases = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  const triggerRecentPurchases = useCallback(() => {
    setQuery("letzte einkäufe");
    inputRef.current?.focus();
  }, []);

  const triggerAktionsartikel = useCallback(() => {
    setQuery("aktionsartikel");
    inputRef.current?.focus();
  }, []);

  const showResults = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const showClear = query.length > 0;

  const recentListForPanel: RecentListProduct[] | null =
    recentListProducts === "pending" || recentListProducts === null
      ? null
      : recentListProducts;

  const resultsContent = showResults && (
    isCommand ? (
      <RecentPurchasesPanel
        recentProducts={recentListForPanel ?? []}
        products={products}
        loading={loading}
        onConfirm={confirmRecentPurchases}
        onCancel={cancelRecentPurchases}
        addCountLabel={(count) => t("lastTripAddCount", { count })}
        cancelLabel={t("lastTripCancel")}
        titleLabel={t("recentPurchasesTitle")}
        noneLabel={t("recentPurchasesNone")}
        loadingLabel={t("searching")}
      />
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
      <div
        className={`rounded-xl border-2 bg-white transition-colors duration-200 ${
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
            placeholder={placeholder}
            aria-label={ariaLabel ?? placeholder}
            autoComplete="off"
            className="min-h-touch min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:outline-none"
          />
          <button
            type="button"
            className="touch-target shrink-0 px-3 text-aldi-muted transition-colors hover:text-aldi-blue"
            onClick={() => inputRef.current?.blur()}
            aria-label={t("hideKeyboard")}
            title={t("hideKeyboard")}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          <button
            type="button"
            className="touch-target shrink-0 px-3 text-aldi-muted transition-colors hover:text-aldi-blue"
            onClick={() => setBarcodeScannerOpen(true)}
            aria-label={t("barcodeScanner")}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10a2.5 2.5 0 01-2.5 2.5" />
            </svg>
          </button>
          {showClear && (
            <button
              type="button"
              className="touch-target shrink-0 px-3 text-aldi-muted transition-colors hover:text-aldi-text"
              onClick={clearSearch}
              aria-label={t("clear")}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {showChips && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={triggerRecentPurchases}
            className="rounded-full border border-aldi-muted-light bg-white px-3 py-1.5 text-xs text-aldi-muted transition-colors hover:border-aldi-blue/50 hover:text-aldi-blue"
          >
            {t("chipRecentPurchases")}
          </button>
          <button
            type="button"
            onClick={triggerAktionsartikel}
            className="rounded-full border border-aldi-muted-light bg-white px-3 py-1.5 text-xs text-aldi-muted transition-colors hover:border-aldi-blue/50 hover:text-aldi-blue"
          >
            {t("chipAktionsartikel")}
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
        onProductNotFound={() => {}}
      />
    </div>
  );
}
