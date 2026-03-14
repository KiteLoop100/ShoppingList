"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useProducts } from "@/lib/products-context";
import { useCompetitorProducts } from "@/lib/competitor-products/competitor-products-context";
import { handleCartScan, type CartScanResult } from "@/lib/cart/scan-to-cart";
import { addListItem, splitAndCheckoff } from "@/lib/list";
import { playScanFeedback } from "@/lib/utils/scan-beep";
import type { Product, CompetitorProduct } from "@/types";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

const TOAST_DURATION_MS = 3000;

interface UseCartScannerDeps {
  listId: string | null;
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  setItemChecked: (itemId: string, checked: boolean) => Promise<void>;
  setItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  refetch: (opts?: { forceReorder?: boolean }) => Promise<void>;
  openCapture: (config: { mode: "create"; initialValues?: Record<string, string> }) => void;
}

export interface CartScanToast {
  message: string;
  type: "success" | "info" | "warning";
}

export interface PricePromptState {
  product: Product;
  ean: string;
}

export function useCartScanner(deps: UseCartScannerDeps) {
  const { listId, unchecked, checked, deferred, setItemChecked, setItemQuantity, refetch, openCapture } = deps;
  const t = useTranslations("list");
  const { products } = useProducts();
  const { products: competitorProducts } = useCompetitorProducts();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [toast, setToast] = useState<CartScanToast | null>(null);
  const [pricePrompt, setPricePrompt] = useState<PricePromptState | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: CartScanToast["type"] = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message: msg, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const allItems = [...unchecked, ...checked, ...deferred];

  const handleScanResult = useCallback(
    async (result: CartScanResult) => {
      if (!listId) return;

      switch (result.type) {
        case "checked_off":
          if (result.itemId) {
            await setItemChecked(result.itemId, true);
            playScanFeedback();
            showToast(t("scanCheckedOff", { name: result.productName ?? "" }));
          }
          break;

        case "partial_checkoff": {
          if (!result.itemId || !result.product || result.remainingQuantity == null) break;
          const product = result.product;
          const existingChecked = checked.find(
            (i) => i.product_id === product.product_id && i.is_checked,
          );

          await splitAndCheckoff(
            result.itemId,
            existingChecked?.item_id ?? null,
            listId,
            product.product_id,
            product.name,
            product.demand_group_code,
            result.remainingQuantity,
          );

          playScanFeedback();
          showToast(t("scanPartialCheckoff", {
            name: result.productName ?? "",
            remaining: result.remainingQuantity,
          }));
          await refetch();
          break;
        }

        case "duplicate_incremented":
          if (result.itemId && result.newQuantity) {
            await setItemQuantity(result.itemId, result.newQuantity);
            playScanFeedback();
            showToast(
              t("scanDuplicateIncremented", {
                name: result.productName ?? "",
                count: result.newQuantity,
              }),
              "info"
            );
          }
          break;

        case "extra_added": {
          const product = result.product;
          const competitor = result.competitorProduct;
          const displayName = product?.name ?? competitor?.name ?? result.ean;
          const demandGroupCode = product?.demand_group_code ?? competitor?.demand_group_code ?? "AK";

          await addListItem({
            list_id: listId,
            product_id: product?.product_id ?? null,
            custom_name: null,
            display_name: displayName,
            demand_group_code: demandGroupCode,
            quantity: 1,
            is_extra_scan: true,
            is_checked: true,
            competitor_product_id: competitor?.product_id ?? null,
          });
          playScanFeedback();
          showToast(t("scanExtraAdded", { name: displayName }));
          await refetch();
          break;
        }

        case "needs_price":
          if (result.product) {
            setPricePrompt({ product: result.product, ean: result.ean });
          }
          break;

        case "product_not_found":
          break;
      }
    },
    [listId, checked, setItemChecked, setItemQuantity, refetch, showToast, t]
  );

  const onCartProductScanned = useCallback(
    async (product: Product) => {
      const ean = product.ean_barcode ?? "";
      const result = await handleCartScan(ean, allItems, products, competitorProducts, product);
      await handleScanResult(result);
      setScannerOpen(false);
    },
    [allItems, products, competitorProducts, handleScanResult]
  );

  const onCartCompetitorScanned = useCallback(
    async (competitor: CompetitorProduct) => {
      const ean = competitor.ean_barcode ?? "";
      const result = await handleCartScan(ean, allItems, products, competitorProducts);
      await handleScanResult(result);
      setScannerOpen(false);
    },
    [allItems, products, competitorProducts, handleScanResult]
  );

  const onCartScanDetected = useCallback(
    async (ean: string) => {
      const result = await handleCartScan(ean, allItems, products, competitorProducts);
      await handleScanResult(result);
    },
    [allItems, products, competitorProducts, handleScanResult]
  );

  const onScanNotFound = useCallback(
    (ean: string) => {
      setScannerOpen(false);
      openCapture({ mode: "create", initialValues: { ean } });
    },
    [openCapture]
  );

  const onScanCreateProduct = useCallback(
    (ean: string, offData?: { name?: string; brand?: string }) => {
      setScannerOpen(false);
      openCapture({ mode: "create", initialValues: { ean, name: offData?.name ?? "" } });
    },
    [openCapture]
  );

  const handlePriceSubmit = useCallback(
    async (price: number | null) => {
      if (!pricePrompt || !listId) return;
      const { product } = pricePrompt;
      const displayName = product.name;

      await addListItem({
        list_id: listId,
        product_id: product.product_id,
        custom_name: null,
        display_name: displayName,
        demand_group_code: product.demand_group_code,
        quantity: 1,
        is_extra_scan: true,
        is_checked: true,
      });
      playScanFeedback();
      showToast(t("scanExtraAdded", { name: displayName }));
      setPricePrompt(null);
      await refetch();
    },
    [pricePrompt, listId, refetch, showToast, t]
  );

  const handlePriceSkip = useCallback(() => {
    setPricePrompt(null);
  }, []);

  return {
    scannerOpen,
    setScannerOpen,
    toast,
    pricePrompt,
    onCartProductScanned,
    onCartCompetitorScanned,
    onCartScanDetected,
    onScanNotFound,
    onScanCreateProduct,
    handlePriceSubmit,
    handlePriceSkip,
    handleScanResult,
  };
}
