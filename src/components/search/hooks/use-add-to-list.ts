"use client";

import { useState, useCallback, useRef } from "react";
import { log } from "@/lib/utils/logger";
import { getOrCreateActiveList, addListItem, addListItemsBatch } from "@/lib/list";
import { assignDemandGroup, CategoryAssignmentError } from "@/lib/category/assign-category";
import { detectRetailerPrefix, type RetailerPrefixResult } from "@/lib/search";
import type { Product, SearchResult } from "@/types";
import type { RetailerProductResult } from "@/lib/competitor-products/competitor-product-service";

const FLASH_DURATION_MS = 400;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export interface UseAddToListOptions {
  query: string;
  country: string | null;
  retailerPrefix: RetailerPrefixResult | null;
  products: Product[];
  onAdded?: () => void;
  resetSearch: () => void;
  focusInput: () => void;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useAddToList(opts: UseAddToListOptions) {
  const { query, country, retailerPrefix, onAdded, resetSearch, focusInput, t } = opts;
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const productsRef = useRef(opts.products);
  productsRef.current = opts.products;

  const flashAdded = useCallback(() => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), FLASH_DURATION_MS);
    onAdded?.();
  }, [onAdded]);

  const addGeneric = useCallback(async () => {
    const raw = query.trim();
    if (!raw) return;
    const rp = detectRetailerPrefix(raw, country ?? "DE");
    const name = rp ? rp.productQuery : raw;
    if (!name) return;
    setErrorMsg(null);
    setAdding(true);
    try {
      const list = await getOrCreateActiveList();
      const { demand_group_code } = await assignDemandGroup(name);
      await addListItem({
        list_id: list.list_id,
        product_id: null,
        custom_name: name,
        display_name: name,
        demand_group_code,
        quantity: 1,
        buy_elsewhere_retailer: rp ? rp.retailer.name : null,
      });
    } catch (e) {
      log.error("[addGeneric] failed:", e);
      setAdding(false);
      setErrorMsg(
        e instanceof CategoryAssignmentError
          ? t("categoryAssignmentFailed")
          : errorMessage(e),
      );
      return;
    }
    setAdding(false);
    resetSearch();
    flashAdded();
    focusInput();
  }, [query, country, resetSearch, flashAdded, focusInput, t]);
  const addSpecific = useCallback(
    async (result: SearchResult) => {
      setErrorMsg(null);
      try {
        const list = await getOrCreateActiveList();
        await addListItem({
          list_id: list.list_id,
          product_id: result.product_id,
          custom_name: null,
          display_name: result.name,
          demand_group_code: result.demand_group_code,
          quantity: 1,
        });
      } catch (e) {
        log.error("[addSpecific] failed:", e);
        setErrorMsg(errorMessage(e));
        return;
      }
      resetSearch();
      flashAdded();
      focusInput();
    },
    [resetSearch, flashAdded, focusInput],
  );
  const addCompetitorProduct = useCallback(
    async (product: RetailerProductResult) => {
      if (!retailerPrefix) return;
      setErrorMsg(null);
      setAdding(true);
      try {
        const list = await getOrCreateActiveList();
        const demandGroupCode =
          product.category_id ??
          (await assignDemandGroup(product.name)).demand_group_code;
        await addListItem({
          list_id: list.list_id,
          product_id: null,
          custom_name: product.name,
          display_name: product.name,
          demand_group_code: demandGroupCode,
          quantity: 1,
          buy_elsewhere_retailer: retailerPrefix.retailer.name,
          competitor_product_id: product.product_id,
        });
      } catch (e) {
        log.error("[addCompetitorProduct] failed:", e);
        setAdding(false);
        setErrorMsg(errorMessage(e));
        return;
      }
      setAdding(false);
      resetSearch();
      flashAdded();
      focusInput();
    },
    [retailerPrefix, resetSearch, flashAdded, focusInput],
  );
  const addFromBarcode = useCallback(
    async (product: Product) => {
      setErrorMsg(null);
      try {
        const list = await getOrCreateActiveList();
        await addListItem({
          list_id: list.list_id,
          product_id: product.product_id,
          custom_name: null,
          display_name: product.name,
          demand_group_code: product.demand_group_code,
          quantity: 1,
        });
      } catch (e) {
        log.error("[addFromBarcode] failed:", e);
        setErrorMsg(t("unexpectedError", { message: errorMessage(e) }));
        return;
      }
      flashAdded();
    },
    [flashAdded, t],
  );
  /** Returns `true` on success, `false` on error. */
  const confirmBatchAdd = useCallback(
    async (selectedItems: { product_id: string; quantity: number }[]): Promise<boolean> => {
      if (selectedItems.length === 0) return true;
      setErrorMsg(null);
      try {
        const productMap = new Map(productsRef.current.map((p) => [p.product_id, p]));
        const list = await getOrCreateActiveList();
        const params = selectedItems
          .map(({ product_id, quantity }) => {
            const p = productMap.get(product_id);
            if (!p) return null;
            return {
              list_id: list.list_id,
              product_id: p.product_id,
              custom_name: null,
              display_name: p.name,
              demand_group_code: p.demand_group_code,
              quantity,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        await addListItemsBatch(params);
      } catch (e) {
        log.error("[confirmBatchAdd] failed:", e);
        setErrorMsg(t("unexpectedError", { message: errorMessage(e) }));
        return false;
      }
      resetSearch();
      flashAdded();
      return true;
    },
    [resetSearch, flashAdded, t],
  );

  const clearError = useCallback(() => setErrorMsg(null), []);

  return {
    adding, errorMsg, justAdded, clearError,
    setError: setErrorMsg,
    addGeneric, addSpecific, addCompetitorProduct, addFromBarcode, confirmBatchAdd,
  };
}
