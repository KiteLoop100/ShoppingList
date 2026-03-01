"use client";

import { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ListItemRow } from "./list-item-row";
import { ProductDetailModal } from "./product-detail-modal";
import { EditProductModal } from "./edit-product-modal";
import { GenericProductPicker } from "./generic-product-picker";
import { useProducts } from "@/lib/products-context";
import { updateListItem, canFillWithTypicalProducts, fillListWithTypicalProducts } from "@/lib/list";
import { db } from "@/lib/db";
import { translateCategoryName } from "@/lib/i18n/category-translations";
import { getCategoryColor } from "@/lib/categories/category-colors";

import { RetailerPickerSheet } from "./retailer-picker-sheet";
import { getRetailerByName } from "@/lib/retailers/retailers";
import { ElsewhereCheckoffPrompt } from "./elsewhere-checkoff-prompt";
import { CompetitorProductFormModal } from "./competitor-product-form-modal";
import { CompetitorProductDetailModal } from "./competitor-product-detail-modal";
import { useCompetitorProducts } from "@/lib/competitor-products/competitor-products-context";
import { getLatestPriceForRetailer, findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";

import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { UseListDataResult } from "./use-list-data";
import type { SortMode, CompetitorProduct } from "@/types";
import type { Product } from "@/types";

export interface ShoppingListContentProps {
  /** "my-order" = flat add-order; "shopping-order" = grouped by category / demand group. */
  sortMode: SortMode;
  listData: UseListDataResult;
}

export const ShoppingListContent = memo(function ShoppingListContent({
  sortMode,
  listData,
}: ShoppingListContentProps) {
  const t = useTranslations("list");
  const locale = useLocale();
  const { products, refetch: refetchProducts } = useProducts();
  const { products: competitorProducts, refetch: refetchCompetitorProducts } = useCompetitorProducts();
  const {
    listId,
    unchecked,
    checked,
    deferred,
    total,
    withoutPriceCount,
    loading,
    dataSortMode,
    refetch,
    setItemChecked,
    setItemQuantity,
    removeItem,
    deferItem,
    undeferItem,
    setBuyElsewhere,
  } = listData;

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [genericPickerItem, setGenericPickerItem] = useState<ListItemWithMeta | null>(null);
  const [canFillTypical, setCanFillTypical] = useState(false);
  const [fillTypicalLoading, setFillTypicalLoading] = useState(false);
  const [elsewherePickerItem, setElsewherePickerItem] = useState<ListItemWithMeta | null>(null);
  const [checkoffPromptItem, setCheckoffPromptItem] = useState<ListItemWithMeta | null>(null);
  const [competitorFormOpen, setCompetitorFormOpen] = useState(false);
  const [competitorFormDefaults, setCompetitorFormDefaults] = useState<{
    name?: string; retailer?: string; ean?: string; brand?: string;
  }>({});
  const [competitorFormItemId, setCompetitorFormItemId] = useState<string | null>(null);
  const [competitorFormEditProduct, setCompetitorFormEditProduct] = useState<CompetitorProduct | null>(null);
  const [detailCompetitorProduct, setDetailCompetitorProduct] = useState<CompetitorProduct | null>(null);

  // Refs for stable callback references (prevents breaking React.memo on ListItemRow)
  const allItemsRef = useRef<ListItemWithMeta[]>([]);
  allItemsRef.current = useMemo(() => [...unchecked, ...checked, ...deferred], [unchecked, checked, deferred]);
  const productsRef = useRef(products);
  productsRef.current = products;
  const listIdRef = useRef(listId);
  listIdRef.current = listId;
  const removeItemRef = useRef(removeItem);
  removeItemRef.current = removeItem;
  const deferItemRef = useRef(deferItem);
  deferItemRef.current = deferItem;
  const undeferItemRef = useRef(undeferItem);
  undeferItemRef.current = undeferItem;
  const setBuyElsewhereRef = useRef(setBuyElsewhere);
  setBuyElsewhereRef.current = setBuyElsewhere;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const handleFillWithTypical = useCallback(async () => {
    const lid = listIdRef.current;
    if (!lid || fillTypicalLoading) return;
    setFillTypicalLoading(true);
    try {
      await fillListWithTypicalProducts(lid);
      await refetchRef.current();
    } finally {
      setFillTypicalLoading(false);
    }
  }, [fillTypicalLoading]);

  const handleDelete = useCallback(
    async (itemId: string) => {
      await removeItemRef.current(itemId);
    },
    []
  );

  const handleDefer = useCallback(
    async (itemId: string) => {
      await deferItemRef.current(itemId);
    },
    []
  );

  const handleUndefer = useCallback(
    async (itemId: string) => {
      await undeferItemRef.current(itemId);
    },
    []
  );

  const handleBuyElsewhere = useCallback(
    (itemId: string) => {
      const item = allItemsRef.current.find(i => i.item_id === itemId);
      if (item) setElsewherePickerItem(item);
    },
    []
  );

  const handleRetailerSelected = useCallback(
    async (retailerName: string) => {
      if (!elsewherePickerItem) return;
      await setBuyElsewhereRef.current(elsewherePickerItem.item_id, retailerName);
      setElsewherePickerItem(null);
    },
    [elsewherePickerItem]
  );

  const handleOpenCompetitorForm = useCallback(
    (item: ListItemWithMeta) => {
      setCompetitorFormDefaults({
        name: item.display_name || item.custom_name || "",
        retailer: item.buy_elsewhere_retailer || "",
      });
      setCompetitorFormItemId(item.item_id);
      setCompetitorFormOpen(true);
    },
    []
  );

  const handleCompetitorFormSaved = useCallback(
    async (productId: string) => {
      setCompetitorFormOpen(false);
      setCompetitorFormEditProduct(null);
      if (competitorFormItemId) {
        try {
          await updateListItem(competitorFormItemId, { competitor_product_id: productId });
        } catch { /* best effort */ }
      }
      setCompetitorFormItemId(null);
      await refetchCompetitorProducts();
      await refetchRef.current();

      const cp = await findCompetitorProductById(productId);
      if (cp) setDetailCompetitorProduct(cp);
    },
    [refetchCompetitorProducts, competitorFormItemId]
  );

  const handleElsewhereCheck = useCallback(
    (itemId: string, isChecked: boolean) => {
      if (!isChecked) return;
      const item = allItemsRef.current.find(i => i.item_id === itemId);
      if (item && item.deferred_reason === "elsewhere") {
        setCheckoffPromptItem(item);
        return;
      }
      setItemChecked(itemId, isChecked);
    },
    [setItemChecked]
  );

  const handleCheckoffDone = useCallback(
    async (competitorProductId: string | null) => {
      if (!checkoffPromptItem) return;
      if (competitorProductId) {
        try {
          await updateListItem(checkoffPromptItem.item_id, { competitor_product_id: competitorProductId });
        } catch { /* best effort */ }
      }
      await setItemChecked(checkoffPromptItem.item_id, true);
      setCheckoffPromptItem(null);
      await refetchCompetitorProducts();
    },
    [checkoffPromptItem, setItemChecked, refetchCompetitorProducts]
  );

  const handleCheckoffSkip = useCallback(
    async () => {
      if (!checkoffPromptItem) return;
      await setItemChecked(checkoffPromptItem.item_id, true);
      setCheckoffPromptItem(null);
    },
    [checkoffPromptItem, setItemChecked]
  );

  const handleOpenDetail = useCallback(
    async (item: ListItemWithMeta) => {
      if (item.deferred_reason === "elsewhere") {
        if (item.competitor_product_id) {
          const cp = competitorProducts.find(p => p.product_id === item.competitor_product_id)
            ?? await findCompetitorProductById(item.competitor_product_id);
          if (cp) {
            setDetailCompetitorProduct(cp);
            return;
          }
        }
        setCompetitorFormDefaults({
          name: item.display_name || item.custom_name || "",
          retailer: item.buy_elsewhere_retailer || "",
        });
        setCompetitorFormItemId(item.item_id);
        setCompetitorFormOpen(true);
        return;
      }

      if (!item.product_id) {
        setGenericPickerItem(item);
        return;
      }

      let p: Product | undefined;
      p = productsRef.current.find((x) => x.product_id === item.product_id);
      if (!p) {
        const fromDb = await db.products.where("product_id").equals(item.product_id).first();
        if (fromDb) p = fromDb as Product;
      }
      if (p && item.thumbnail_url && !p.thumbnail_url) {
        p = { ...p, thumbnail_url: item.thumbnail_url };
      }
      if (p) {
        setDetailProduct(p);
      }
    },
    [competitorProducts]
  );

  const handleRenameItem = useCallback(
    async (itemId: string, newName: string) => {
      await updateListItem(itemId, {
        display_name: newName,
        custom_name: newName,
      });
      await refetchRef.current();
    },
    []
  );

  const handleGenericProductSelected = useCallback(
    async (product: Product) => {
      if (!genericPickerItem) return;
      await updateListItem(genericPickerItem.item_id, {
        product_id: product.product_id,
        display_name: product.name,
        custom_name: null,
        category_id: product.category_id,
      });
      setGenericPickerItem(null);
      await refetchRef.current();
    },
    [genericPickerItem]
  );

  const listEmpty = unchecked.length === 0 && checked.length === 0 && deferred.length === 0;
  useEffect(() => {
    if (!listEmpty) return;
    let cancelled = false;
    canFillWithTypicalProducts().then((ok) => {
      if (!cancelled) setCanFillTypical(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [listEmpty]);

  const uncheckedSorted = useMemo(
    () => [...unchecked].sort((a, b) => a.sort_position - b.sort_position),
    [unchecked]
  );

  const deferredRegular = useMemo(
    () => deferred.filter(i => i.deferred_reason !== "elsewhere"),
    [deferred]
  );
  const deferredElsewhere = useMemo(
    () => deferred.filter(i => i.deferred_reason === "elsewhere").map(item => {
      if (!item.competitor_product_id) return item;
      const cp = competitorProducts.find(p => p.product_id === item.competitor_product_id);
      if (!cp) return item;
      return {
        ...item,
        display_name: cp.name,
        ...(cp.thumbnail_url ? { competitor_thumbnail_url: cp.thumbnail_url } : {}),
      };
    }),
    [deferred, competitorProducts]
  );

  const deferredByDate = useMemo(() => {
    const map = new Map<string, ListItemWithMeta[]>();
    for (const item of deferredRegular) {
      const dateKey = item.available_from ?? "unknown";
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [deferredRegular]);

  const elsewhereByRetailer = useMemo(() => {
    const map = new Map<string, ListItemWithMeta[]>();
    for (const item of deferredElsewhere) {
      const retailer = item.buy_elsewhere_retailer ?? "?";
      if (!map.has(retailer)) map.set(retailer, []);
      map.get(retailer)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [deferredElsewhere]);

  const handleDeferredCheck = useCallback(
    (_itemId: string, _checked: boolean) => {
      // Deferred items cannot be checked — no-op
    },
    []
  );

  const tCommon = useTranslations("common");
  if (loading && !detailProduct && !editProduct) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-aldi-muted">
        {tCommon("loading")}
      </div>
    );
  }

  const formatDeferredDate = (dateStr: string) => {
    if (dateStr === "unknown") return "";
    if (dateStr === "next_trip") return t("deferredSectionNextTrip");
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const allRegularChecked = unchecked.length === 0 && checked.length > 0 && deferred.length > 0;
  const hasAnyItems = unchecked.length > 0 || checked.length > 0 || deferred.length > 0;
  const priceFormatted = total.toFixed(2).replace(".", ",");

  return (
    <>
      <div className="min-h-0 flex-1 space-y-8 overflow-auto overscroll-contain pb-2">
        {unchecked.length === 0 && checked.length === 0 && deferred.length === 0 ? (
          <div className="py-10 space-y-6">
            <p className="text-center text-[15px] text-aldi-muted leading-relaxed">
              {t("emptyListHint")}
            </p>
            {canFillTypical && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleFillWithTypical}
                  disabled={fillTypicalLoading}
                  className="touch-target min-w-[200px] rounded-xl border-2 border-aldi-blue bg-white px-5 py-3 text-sm font-semibold text-aldi-blue transition-colors duration-200 hover:bg-aldi-blue hover:text-white disabled:opacity-50"
                >
                  {fillTypicalLoading ? tCommon("loading") : t("fillWithTypicalProducts")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ul className="space-y-1">
              {(dataSortMode === "my-order" ? uncheckedSorted : unchecked).map((item) => (
                <li key={item.item_id}>
                  <ListItemRow
                    item={item}
                    onCheck={setItemChecked}
                    onQuantityChange={setItemQuantity}
                    onDelete={handleDelete}
                    deleteLabel={t("delete")}
                    onOpenDetail={handleOpenDetail}
                    categoryLabel={translateCategoryName(item.demand_group || item.category_name, locale)}
                    categoryColor={dataSortMode === "shopping-order" ? getCategoryColor(item.demand_group || item.category_name) : undefined}
                    onDefer={handleDefer}
                    onBuyElsewhere={handleBuyElsewhere}
                    onRenameItem={handleRenameItem}
                  />
                </li>
              ))}
            </ul>
            {allRegularChecked && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold">✓</span>
                {t("allRegularChecked")}
              </div>
            )}
            {deferredByDate.length > 0 && (
              <section className="mt-6">
                {deferredByDate.map(([dateStr, items]) => (
                  <div key={dateStr} className="mb-4">
                    <h2 className="mb-3 text-category font-semibold uppercase tracking-wider text-aldi-muted">
                      {dateStr === "next_trip" ? (
                        <svg className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      ) : (
                        <svg className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                      )}
                      {dateStr === "next_trip" ? t("deferredSectionNextTrip") : t("deferredSection", { date: formatDeferredDate(dateStr) })}
                    </h2>
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.item_id}>
                          <ListItemRow
                            item={item}
                            onCheck={handleDeferredCheck}
                            onQuantityChange={setItemQuantity}
                            onDelete={handleDelete}
                            deleteLabel={t("delete")}
                            onOpenDetail={handleOpenDetail}
                            onUndefer={handleUndefer}
                            onRenameItem={handleRenameItem}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
            {checked.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-category font-semibold uppercase tracking-wider text-aldi-muted">
                  ✓ {t("checked")}
                </h2>
                <ul className="space-y-3">
                  {checked.map((item) => (
                    <li key={item.item_id}>
                      <ListItemRow
                        item={item}
                        onCheck={setItemChecked}
                        onQuantityChange={setItemQuantity}
                        onDelete={handleDelete}
                        deleteLabel={t("delete")}
                        onOpenDetail={handleOpenDetail}
                        onRenameItem={handleRenameItem}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {elsewhereByRetailer.length > 0 && (
              <section className="mt-6">
                <div className="mb-3 border-t border-dashed border-gray-300 pt-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-category font-semibold uppercase tracking-wider text-aldi-muted">
                      <span className="mr-1">🏪</span>
                      {t("buyElsewhereSection")}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setCompetitorFormDefaults({});
                        setCompetitorFormItemId(null);
                        setCompetitorFormOpen(true);
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-aldi-muted transition-colors hover:text-aldi-blue"
                    >
                      + {t("competitorProductTitle")}
                    </button>
                  </div>
                </div>
                {elsewhereByRetailer.map(([retailerName, items]) => {
                  const config = getRetailerByName(retailerName);
                  const bgClass = config?.bgColor ?? "bg-orange-50/30";
                  return (
                    <div key={retailerName} className={`mb-3 rounded-xl ${bgClass} px-2 py-2`}>
                      <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {retailerName}
                      </h3>
                      <ul className="space-y-1">
                        {items.map((item) => (
                          <li key={item.item_id}>
                            <ListItemRow
                              item={item}
                              onCheck={handleElsewhereCheck}
                              onQuantityChange={setItemQuantity}
                              onDelete={handleDelete}
                              deleteLabel={t("delete")}
                              onOpenDetail={handleOpenDetail}
                              onBuyElsewhere={handleBuyElsewhere}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      {hasAnyItems && (
        <footer className="border-t border-aldi-muted-light bg-gray-50/50 px-4 py-4" role="region" aria-label={t("estimatedTotal", { price: `€${priceFormatted}` })}>
          <p className="text-base font-semibold text-aldi-text">
            {t("estimatedTotal", { price: `€${priceFormatted}` })}
          </p>
          {withoutPriceCount > 0 && (
            <p className="mt-0.5 text-sm text-aldi-muted">
              {t("productsWithoutPrice", { count: withoutPriceCount })}
            </p>
          )}
      </footer>
      )}

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onEdit={(p) => {
          setDetailProduct(null);
          setEditProduct(p);
        }}
        onReorderChanged={() => { refetch({ forceReorder: true }); }}
      />

      {genericPickerItem && (
        <GenericProductPicker
          genericName={genericPickerItem.display_name || genericPickerItem.custom_name || ""}
          onSelect={handleGenericProductSelected}
          onClose={() => setGenericPickerItem(null)}
        />
      )}

      {editProduct && (
        <EditProductModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={async () => {
            await refetchProducts();
            await refetch();
          }}
        />
      )}

      <RetailerPickerSheet
        open={elsewherePickerItem !== null}
        itemName={elsewherePickerItem?.display_name ?? elsewherePickerItem?.custom_name ?? ""}
        onSelect={handleRetailerSelected}
        onClose={() => setElsewherePickerItem(null)}
      />

      <ElsewhereCheckoffPrompt
        open={checkoffPromptItem !== null}
        itemName={checkoffPromptItem?.display_name ?? checkoffPromptItem?.custom_name ?? ""}
        retailer={checkoffPromptItem?.buy_elsewhere_retailer ?? ""}
        onDone={handleCheckoffDone}
        onSkip={handleCheckoffSkip}
      />

      <CompetitorProductFormModal
        open={competitorFormOpen}
        onClose={() => { setCompetitorFormOpen(false); setCompetitorFormEditProduct(null); }}
        onSaved={handleCompetitorFormSaved}
        initialName={competitorFormDefaults.name}
        initialRetailer={competitorFormDefaults.retailer}
        initialEan={competitorFormDefaults.ean}
        initialBrand={competitorFormDefaults.brand}
        editProduct={competitorFormEditProduct}
      />

      <CompetitorProductDetailModal
        product={detailCompetitorProduct}
        onClose={() => setDetailCompetitorProduct(null)}
        onEdit={(cp) => {
          setDetailCompetitorProduct(null);
          setCompetitorFormEditProduct(cp);
          setCompetitorFormDefaults({});
          setCompetitorFormItemId(null);
          setCompetitorFormOpen(true);
        }}
      />
    </>
  );
});
