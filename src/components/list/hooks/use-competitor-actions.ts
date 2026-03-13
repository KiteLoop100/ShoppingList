"use client";

import { useCallback, useRef, useMemo } from "react";
import { updateListItem } from "@/lib/list";
import { setRetailerForProduct } from "@/lib/settings/retailer-memory";
import { db } from "@/lib/db";
import { findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { Product, CompetitorProduct } from "@/types";
import type { CaptureModalConfig } from "./use-list-modals";

interface CompetitorFormDefaults {
  name?: string; retailer?: string; ean?: string; brand?: string;
}

export interface UseCompetitorActionsArgs {
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  products: Product[];
  competitorProducts: CompetitorProduct[];
  refetch: (opts?: { forceReorder?: boolean }) => Promise<void>;
  refetchCompetitorProducts: () => Promise<void>;
  setItemChecked: (itemId: string, checked: boolean) => Promise<void>;
  setBuyElsewhere: (itemId: string, retailer: string) => Promise<void>;
  elsewherePickerItem: ListItemWithMeta | null;
  checkoffPromptItem: ListItemWithMeta | null;
  genericPickerItem: ListItemWithMeta | null;
  competitorFormItemId: string | null;
  competitorFormDefaults: CompetitorFormDefaults;
  openElsewherePicker: (item: ListItemWithMeta) => void;
  closeElsewherePicker: () => void;
  openCheckoffPrompt: (item: ListItemWithMeta) => void;
  closeCheckoffPrompt: () => void;
  openCompetitorForm: (defaults: CompetitorFormDefaults, itemId: string | null) => void;
  closeCompetitorForm: () => void;
  openCompetitorDetail: (product: CompetitorProduct, retailer: string | null) => void;
  openGenericPicker: (item: ListItemWithMeta) => void;
  closeGenericPicker: () => void;
  openDetail: (product: Product, itemId?: string | null, itemComment?: string | null) => void;
  openCapture?: (config: CaptureModalConfig) => void;
}

export function useCompetitorActions(args: UseCompetitorActionsArgs) {
  const {
    unchecked, checked, deferred, products, competitorProducts,
    refetch, refetchCompetitorProducts, setItemChecked, setBuyElsewhere,
    elsewherePickerItem, checkoffPromptItem, genericPickerItem,
    competitorFormItemId, competitorFormDefaults,
    openElsewherePicker, closeElsewherePicker,
    openCheckoffPrompt, closeCheckoffPrompt,
    openCompetitorForm, closeCompetitorForm,
    openCompetitorDetail, openGenericPicker, closeGenericPicker, openDetail,
    openCapture,
  } = args;

  const allItemsRef = useRef<ListItemWithMeta[]>([]);
  allItemsRef.current = useMemo(() => [...unchecked, ...checked, ...deferred], [unchecked, checked, deferred]);
  const productsRef = useRef(products);
  productsRef.current = products;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handleBuyElsewhere = useCallback((itemId: string) => {
    const item = allItemsRef.current.find(i => i.item_id === itemId);
    if (item) openElsewherePicker(item);
  }, [openElsewherePicker]);

  const handleRetailerSelected = useCallback(async (retailerName: string) => {
    if (!elsewherePickerItem) return;
    await setBuyElsewhere(elsewherePickerItem.item_id, retailerName);
    setRetailerForProduct(
      elsewherePickerItem.product_id ?? null,
      elsewherePickerItem.display_name,
      retailerName,
    );
    closeElsewherePicker();
  }, [elsewherePickerItem, setBuyElsewhere, closeElsewherePicker]);

  const handleOpenCompetitorForm = useCallback((item: ListItemWithMeta) => {
    openCompetitorForm(
      { name: item.display_name || item.custom_name || "", retailer: item.buy_elsewhere_retailer || "" },
      item.item_id
    );
  }, [openCompetitorForm]);

  const handleCompetitorFormSaved = useCallback(async (productId: string) => {
    closeCompetitorForm();
    const cp = await findCompetitorProductById(productId);
    if (competitorFormItemId) {
      try {
        await updateListItem(competitorFormItemId, {
          competitor_product_id: productId, ...(cp ? { display_name: cp.name } : {}),
        });
      } catch (e) { console.warn("[competitor-actions] link failed:", e); }
    }
    await refetchCompetitorProducts();
    await refetchRef.current();
    if (cp) openCompetitorDetail(cp, competitorFormDefaults.retailer || null);
  }, [closeCompetitorForm, refetchCompetitorProducts, competitorFormItemId, competitorFormDefaults.retailer, openCompetitorDetail]);

  const handleElsewhereCheck = useCallback((itemId: string, isChecked: boolean) => {
    if (!isChecked) return;
    const item = allItemsRef.current.find(i => i.item_id === itemId);
    if (item && item.deferred_reason === "elsewhere") { openCheckoffPrompt(item); return; }
    setItemChecked(itemId, isChecked);
  }, [setItemChecked, openCheckoffPrompt]);

  const handleCheckoffDone = useCallback(async (competitorProductId: string | null) => {
    if (!checkoffPromptItem) return;
    if (competitorProductId) {
      try { await updateListItem(checkoffPromptItem.item_id, { competitor_product_id: competitorProductId }); }
      catch (e) { console.warn("[competitor-actions] checkoff link failed:", e); }
    }
    await setItemChecked(checkoffPromptItem.item_id, true);
    closeCheckoffPrompt();
    await refetchCompetitorProducts();
  }, [checkoffPromptItem, setItemChecked, closeCheckoffPrompt, refetchCompetitorProducts]);

  const handleCheckoffSkip = useCallback(async () => {
    if (!checkoffPromptItem) return;
    await setItemChecked(checkoffPromptItem.item_id, true);
    closeCheckoffPrompt();
  }, [checkoffPromptItem, setItemChecked, closeCheckoffPrompt]);

  const handleOpenDetail = useCallback(async (item: ListItemWithMeta) => {
    if (item.deferred_reason === "elsewhere") {
      if (item.competitor_product_id) {
        const cp = competitorProducts.find(p => p.product_id === item.competitor_product_id)
          ?? await findCompetitorProductById(item.competitor_product_id);
        if (cp) { openCompetitorDetail(cp, item.buy_elsewhere_retailer || null); return; }
      }
      if (openCapture) {
        openCapture({
          mode: "create",
          initialValues: { name: item.display_name || item.custom_name || "", retailer: item.buy_elsewhere_retailer || "" },
          itemId: item.item_id,
        });
      } else {
        openCompetitorForm(
          { name: item.display_name || item.custom_name || "", retailer: item.buy_elsewhere_retailer || "" },
          item.item_id);
      }
      return;
    }
    if (!item.product_id) { openGenericPicker(item); return; }
    let p: Product | undefined = productsRef.current.find((x) => x.product_id === item.product_id);
    if (!p) {
      const fromDb = await db.products.where("product_id").equals(item.product_id).first();
      if (fromDb) p = fromDb as Product;
    }
    if (p && item.thumbnail_url && !p.thumbnail_url) p = { ...p, thumbnail_url: item.thumbnail_url };
    if (p) openDetail(p, item.item_id, item.comment ?? null);
  }, [competitorProducts, openCompetitorDetail, openCompetitorForm, openCapture, openGenericPicker, openDetail]);

  const handleRenameItem = useCallback(async (itemId: string, newName: string) => {
    await updateListItem(itemId, { display_name: newName, custom_name: newName });
    await refetchRef.current();
  }, []);

  const handleGenericProductSelected = useCallback(async (product: Product) => {
    if (!genericPickerItem) return;
    await updateListItem(genericPickerItem.item_id, {
      product_id: product.product_id, display_name: product.name,
      custom_name: null, demand_group_code: product.demand_group_code,
    });
    closeGenericPicker();
    await refetchRef.current();
  }, [genericPickerItem, closeGenericPicker]);

  return {
    handleBuyElsewhere, handleRetailerSelected, handleOpenCompetitorForm,
    handleCompetitorFormSaved, handleElsewhereCheck, handleCheckoffDone,
    handleCheckoffSkip, handleOpenDetail, handleRenameItem, handleGenericProductSelected,
  };
}
