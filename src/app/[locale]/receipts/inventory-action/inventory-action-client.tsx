"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { useProducts } from "@/lib/products-context";
import { useCurrentCountry } from "@/lib/current-country-context";
import { useSearchExecution, MIN_QUERY_LENGTH } from "@/components/search/hooks/use-search-execution";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { loadInventory, upsertInventoryItem, consumeInventoryItem, openInventoryItem, productToInventoryInput, competitorProductToInventoryInput } from "@/lib/inventory/inventory-service";
import { findInventoryItemByProductId } from "@/lib/inventory/inventory-freeze";
import { filterInventoryByName } from "@/lib/inventory/inventory-search";
import type { InventoryItem, InventoryUpsertInput } from "@/lib/inventory/inventory-types";
import type { Product, CompetitorProduct, SearchResult } from "@/types";
import type { RetailerProductResult } from "@/lib/competitor-products/competitor-product-service";

const BarcodeScannerModal = dynamic(
  () => import("@/components/search/barcode-scanner-modal").then((m) => m.BarcodeScannerModal),
  { ssr: false },
);

type ActionMode = "add" | "consume" | "open";

const MODE_TITLE_KEYS: Record<ActionMode, string> = {
  add: "addProduct",
  consume: "consumeProduct",
  open: "openProduct",
};

export function InventoryActionClient() {
  const t = useTranslations("inventory");
  const tSearch = useTranslations("search");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { products } = useProducts();
  const { country } = useCurrentCountry();

  const rawMode = searchParams.get("mode");
  const mode: ActionMode = rawMode === "consume" || rawMode === "open" ? rawMode : "add";

  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [freezeOnAdd, setFreezeOnAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInventoryMode = mode === "consume" || mode === "open";

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (!isInventoryMode) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const userId = getCurrentUserId();
    loadInventory(supabase, userId).then(setInventoryItems);
  }, [isInventoryMode]);

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, []);

  const { results, isSearching, trimmedQuery, retailerProducts } = useSearchExecution({
    query: isInventoryMode ? "" : query,
    products,
    country,
  });

  const inventoryResults = useMemo(() => {
    if (!isInventoryMode || !query.trim()) return [];
    return filterInventoryByName(inventoryItems, query);
  }, [isInventoryMode, inventoryItems, query]);

  const handleAdd = useCallback(async (input: InventoryUpsertInput) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const userId = getCurrentUserId();
    const finalInput = freezeOnAdd
      ? { ...input, is_frozen: true, frozen_at: new Date().toISOString() }
      : input;
    const result = await upsertInventoryItem(supabase, userId, finalInput);
    if (result) {
      showToastMsg(t("restockedToast", { name: input.display_name, count: String(result.quantity) }));
      setTimeout(() => router.replace("/receipts?tab=inventory" as never), 800);
    }
  }, [showToastMsg, t, router, freezeOnAdd]);

  const handleSelectSearchResult = useCallback((r: SearchResult) => {
    const input: InventoryUpsertInput = {
      product_id: r.product_id,
      competitor_product_id: null,
      display_name: r.name,
      demand_group_code: r.demand_group_code,
      thumbnail_url: r.thumbnail_url ?? r.product?.thumbnail_url ?? null,
      quantity: 1,
      source: "manual",
    };
    handleAdd(input);
  }, [handleAdd]);

  const handleSelectRetailerProduct = useCallback((r: RetailerProductResult) => {
    const input: InventoryUpsertInput = {
      product_id: null,
      competitor_product_id: r.product_id,
      display_name: r.name,
      demand_group_code: r.demand_group_code ?? null,
      thumbnail_url: r.thumbnail_url ?? null,
      quantity: 1,
      source: "manual",
    };
    handleAdd(input);
  }, [handleAdd]);

  const handleInventoryAction = useCallback(async (item: InventoryItem) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const ok = mode === "consume"
      ? await consumeInventoryItem(supabase, item.id)
      : await openInventoryItem(supabase, item.id);
    if (ok) {
      const toastKey = mode === "consume" ? "consumedToast" : "openedToast";
      showToastMsg(t(toastKey, { name: item.display_name }));
      setTimeout(() => router.replace("/receipts?tab=inventory" as never), 800);
    }
  }, [mode, showToastMsg, t, router]);

  const handleBarcodeProduct = useCallback(async (product: Product) => {
    if (isInventoryMode) {
      const supabase = createClientIfConfigured();
      if (!supabase) return;
      const userId = getCurrentUserId();
      const item = await findInventoryItemByProductId(supabase, userId, product.product_id, null);
      if (item) {
        handleInventoryAction(item);
      } else {
        showToastMsg(t("notInInventory"));
        setShowScanner(false);
      }
    } else {
      handleAdd(productToInventoryInput(product, "barcode"));
    }
  }, [isInventoryMode, handleAdd, handleInventoryAction, showToastMsg, t]);

  const handleBarcodeCompetitor = useCallback(async (product: CompetitorProduct) => {
    if (isInventoryMode) {
      const supabase = createClientIfConfigured();
      if (!supabase) return;
      const userId = getCurrentUserId();
      const item = await findInventoryItemByProductId(supabase, userId, null, product.product_id);
      if (item) {
        handleInventoryAction(item);
      } else {
        showToastMsg(t("notInInventory"));
        setShowScanner(false);
      }
    } else {
      handleAdd(competitorProductToInventoryInput(product, "barcode"));
    }
  }, [isInventoryMode, handleAdd, handleInventoryAction, showToastMsg, t]);

  const handleBarcodeNotFound = useCallback(() => {
    showToastMsg(tSearch("barcodeNotFound"));
    setShowScanner(false);
  }, [showToastMsg, tSearch]);

  const showResults = mode === "add"
    ? trimmedQuery.length >= MIN_QUERY_LENGTH
    : query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex flex-col gap-2 border-b border-aldi-muted-light px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.replace("/receipts?tab=inventory" as never)} className="touch-target rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text" aria-label={tSearch("close")}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 className="flex-1 text-base font-semibold text-aldi-text">{t(MODE_TITLE_KEYS[mode])}</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-aldi-blue px-4 py-2.5 text-sm font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
          </svg>
          {t("scanBarcode")}
        </button>
        <input
          ref={inputRef}
          type="search"
          className="w-full rounded-xl border border-aldi-muted-light bg-gray-50 px-4 py-2.5 text-[15px] text-aldi-text outline-none placeholder:text-aldi-muted focus:border-aldi-blue focus:ring-1 focus:ring-aldi-blue"
          placeholder={isInventoryMode ? t("searchInventory") : t("addProduct")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {mode === "add" && (
          <label className="flex cursor-pointer items-center gap-2">
            <div
              className={`relative h-6 w-11 rounded-full transition-colors ${freezeOnAdd ? "bg-blue-500" : "bg-gray-300"}`}
              onClick={() => setFreezeOnAdd((v) => !v)}
            >
              <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${freezeOnAdd ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-aldi-text">{t("freezeOnAdd")}</span>
          </label>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!showResults && (
          <p className="p-6 text-center text-sm text-aldi-muted">
            {isInventoryMode ? t("searchInventoryHint") : tSearch("searchHint")}
          </p>
        )}

        {showResults && isSearching && !isInventoryMode && (
          <p className="p-4 text-center text-sm text-aldi-muted">{tSearch("searching")}</p>
        )}

        {mode === "add" && showResults && !isSearching && results.length === 0 && retailerProducts.length === 0 && (
          <p className="p-4 text-center text-sm text-aldi-muted">{tSearch("noResults")}</p>
        )}

        {mode === "add" && showResults && results.length > 0 && (
          <ul className="py-1">
            {results.map((r) => (
              <ProductRow key={r.product_id} name={r.name} category={r.demand_group_name} thumbnail={r.thumbnail_url ?? r.product?.thumbnail_url} price={r.price} onClick={() => handleSelectSearchResult(r)} />
            ))}
          </ul>
        )}

        {mode === "add" && showResults && retailerProducts.length > 0 && (
          <>
            {results.length > 0 && <div className="mx-4 border-t border-aldi-muted-light" />}
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-aldi-muted">{tSearch("retailerOtherProducts")}</p>
            <ul className="py-1">
              {retailerProducts.map((r) => (
                <ProductRow key={r.product_id} name={r.name} category={r.brand} thumbnail={r.thumbnail_url} price={r.latest_price} onClick={() => handleSelectRetailerProduct(r)} />
              ))}
            </ul>
          </>
        )}

        {isInventoryMode && showResults && inventoryResults.length === 0 && (
          <p className="p-4 text-center text-sm text-aldi-muted">{t("searchNoResults")}</p>
        )}

        {isInventoryMode && showResults && inventoryResults.length > 0 && (
          <ul className="py-1">
            {inventoryResults.map((item) => (
              <ProductRow key={item.id} name={item.display_name} category={null} thumbnail={item.thumbnail_url} badge={item.status === "opened" ? t("statusOpened") : undefined} qty={item.quantity} onClick={() => handleInventoryAction(item)} />
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-sm animate-fade-in rounded-xl bg-aldi-text px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onProductAdded={handleBarcodeProduct} onProductNotFound={handleBarcodeNotFound} onCompetitorProductFound={handleBarcodeCompetitor} />
    </div>
  );
}

function ProductRow({ name, category, thumbnail, price, badge, qty, onClick }: {
  name: string;
  category: string | null;
  thumbnail: string | null | undefined;
  price?: number | null;
  badge?: string;
  qty?: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-aldi-muted-light/40" onClick={onClick}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          {thumbnail ? (
            <Image src={thumbnail} alt="" role="presentation" width={40} height={40} className="rounded object-contain" unoptimized />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded bg-aldi-muted-light text-xs text-aldi-muted">?</span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          <span className="truncate text-[15px] font-medium text-aldi-text">{name}</span>
          {category && <span className="truncate text-xs text-aldi-muted">{category}</span>}
          {badge && <span className="inline-block w-fit rounded-full bg-aldi-orange/10 px-2 py-0.5 text-[10px] font-semibold text-aldi-orange">{badge}</span>}
        </span>
        {qty != null && qty > 1 && (
          <span className="shrink-0 text-sm font-semibold text-aldi-muted">{qty}x</span>
        )}
        {price != null && (
          <span className="shrink-0 text-sm font-semibold text-aldi-blue">{price.toFixed(2)}&nbsp;&euro;</span>
        )}
      </button>
    </li>
  );
}
