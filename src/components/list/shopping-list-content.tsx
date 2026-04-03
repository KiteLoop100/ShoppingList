"use client";

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ProductDetailModal } from "./product-detail-modal";
import { GenericProductPicker } from "./generic-product-picker";
import { ListSection, DeferredSections, CheckedSection, ElsewhereSection } from "./list-section";
import { useProducts } from "@/lib/products-context";
import { canFillWithTypicalProducts, fillListWithTypicalProducts } from "@/lib/list";
import { ListSkeleton } from "@/components/ui/skeleton";
import { RetailerPickerSheet } from "./retailer-picker-sheet";
import { ElsewhereCheckoffPrompt } from "./elsewhere-checkoff-prompt";
import { CompetitorProductDetailModal } from "./competitor-product-detail-modal";
import { ProductCaptureModal } from "@/components/product-capture/product-capture-modal";
import { useCompetitorProducts } from "@/lib/competitor-products/competitor-products-context";
import { db } from "@/lib/db";
import { findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";
import { fetchAldiProductByIdFromSupabase } from "@/lib/products/fetch-aldi-product";
import { updateListItem } from "@/lib/list";
import { log } from "@/lib/utils/logger";
import { getRetailerForProduct } from "@/lib/settings/retailer-memory";
import { TripNoteSection } from "./trip-note-section";
import { ShareListButton } from "./share-list-button";
import { useListModals } from "./hooks/use-list-modals";
import { useCompetitorActions } from "./hooks/use-competitor-actions";
import { useListDerived } from "./hooks/use-list-derived";
import { ShoppingTileGrid } from "./shopping-tile-grid";
import { DualPriceFooter } from "./dual-price-footer";
import { BarcodeScannerModal } from "@/components/search/barcode-scanner-modal";
import { useArrowNavigation } from "@/hooks/use-arrow-navigation";
import { useCartScanner } from "./hooks/use-cart-scanner";
import { CartScanPricePrompt } from "./cart-scan-price-prompt";

import type { UseListDataResult } from "./use-list-data";
import type { SortMode } from "@/types";

export interface ShoppingListContentProps {
  sortMode: SortMode;
  listData: UseListDataResult;
  scanButtonVisible: boolean;
}

export const ShoppingListContent = memo(function ShoppingListContent({
  sortMode: _sortMode,
  listData,
  scanButtonVisible,
}: ShoppingListContentProps) {
  const t = useTranslations("list");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { products, refetch: refetchProducts } = useProducts();
  const { products: competitorProducts, refetch: refetchCompetitorProducts } = useCompetitorProducts();
  const {
    listId, listNotes, unchecked, checked, deferred,
    total, withoutPriceCount, cartTotal, cartWithoutPriceCount,
    loading, dataSortMode, refetch,
    setItemChecked, setItemQuantity, removeItem, uncheckItem, deferItem, undeferItem, setBuyElsewhere, updateItemComment,
  } = listData;

  const modals = useListModals();
  const { state: ms } = modals;
  const listModalRef = useRef(ms);
  listModalRef.current = ms;

  const [canFillTypical, setCanFillTypical] = useState(false);
  const [fillTypicalLoading, setFillTypicalLoading] = useState(false);

  const listIdRef = useRef(listId);
  listIdRef.current = listId;
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const removeItemRef = useRef(removeItem);
  removeItemRef.current = removeItem;
  const deferItemRef = useRef(deferItem);
  deferItemRef.current = deferItem;
  const undeferItemRef = useRef(undeferItem);
  undeferItemRef.current = undeferItem;

  const actions = useCompetitorActions({
    unchecked, checked, deferred, products, competitorProducts,
    refetch, refetchCompetitorProducts, setItemChecked, setBuyElsewhere,
    elsewherePickerItem: ms.elsewherePickerItem, checkoffPromptItem: ms.checkoffPromptItem,
    genericPickerItem: ms.genericPickerItem, competitorFormItemId: ms.competitorFormItemId,
    competitorFormDefaults: ms.competitorFormDefaults,
    openElsewherePicker: modals.openElsewherePicker, closeElsewherePicker: modals.closeElsewherePicker,
    openCheckoffPrompt: modals.openCheckoffPrompt, closeCheckoffPrompt: modals.closeCheckoffPrompt,
    openCompetitorForm: modals.openCompetitorForm, closeCompetitorForm: modals.closeCompetitorForm,
    openCompetitorDetail: modals.openCompetitorDetail,
    openGenericPicker: modals.openGenericPicker, closeGenericPicker: modals.closeGenericPicker,
    openDetail: modals.openDetail,
    openCapture: modals.openCapture,
  });

  const cartScanner = useCartScanner({
    listId, unchecked, checked, deferred,
    setItemChecked, setItemQuantity, refetch,
    openCapture: modals.openCapture,
  });

  const handleFillWithTypical = useCallback(async () => {
    const lid = listIdRef.current;
    if (!lid || fillTypicalLoading) return;
    setFillTypicalLoading(true);
    try { await fillListWithTypicalProducts(lid); await refetchRef.current(); }
    finally { setFillTypicalLoading(false); }
  }, [fillTypicalLoading]);

  const handleDelete = useCallback(async (itemId: string) => { await removeItemRef.current(itemId); }, []);
  const handleDefer = useCallback(async (itemId: string) => { await deferItemRef.current(itemId); }, []);
  const handleUndefer = useCallback(async (itemId: string) => { await undeferItemRef.current(itemId); }, []);
  const handleDeferredCheck = useCallback((_itemId: string, _checked: boolean) => {}, []);

  const listEmpty = unchecked.length === 0 && checked.length === 0 && deferred.length === 0;
  useEffect(() => {
    if (!listEmpty) return;
    let cancelled = false;
    canFillWithTypicalProducts().then((ok) => { if (!cancelled) setCanFillTypical(ok); });
    return () => { cancelled = true; };
  }, [listEmpty]);

  const { uncheckedSorted, deferredByDate, elsewhereByRetailer, formatDeferredDate } =
    useListDerived(unchecked, deferred, competitorProducts, locale, t("deferredSectionNextTrip"));

  const { containerRef: arrowNavRef, handleKeyDown: arrowNavKeyDown } = useArrowNavigation();

  if (loading && !ms.detailProduct && !ms.captureOpen) {
    return <div className="flex-1 px-1 pt-2"><ListSkeleton rows={8} /></div>;
  }

  const allRegularChecked = unchecked.length === 0 && checked.length > 0 && deferred.length > 0;
  const hasAnyItems = !listEmpty;

  const deferredCbs = { onCheck: handleDeferredCheck, onQuantityChange: setItemQuantity,
    onDelete: handleDelete, deleteLabel: t("delete"), onOpenDetail: actions.handleOpenDetail,
    onUndefer: handleUndefer, onRenameItem: actions.handleRenameItem };

  const checkedCbs = { onCheck: setItemChecked, onQuantityChange: setItemQuantity,
    onDelete: handleDelete, deleteLabel: t("delete"), onOpenDetail: actions.handleOpenDetail,
    onRenameItem: actions.handleRenameItem };

  const elsewhereCbs = { onCheck: actions.handleElsewhereCheck, onQuantityChange: setItemQuantity,
    onDelete: handleDelete, deleteLabel: t("delete"), onOpenDetail: actions.handleOpenDetail,
    onBuyElsewhere: actions.handleBuyElsewhere };

  return (
    <>
      <div ref={arrowNavRef} onKeyDown={arrowNavKeyDown} className="min-h-0 flex-1 space-y-8 overflow-auto overscroll-contain pb-2">
        {listEmpty ? (
          <div className="flex flex-col items-center py-10 space-y-6 lg:py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light lg:h-20 lg:w-20">
              <svg className="h-8 w-8 text-aldi-blue lg:h-10 lg:w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            </div>
            <p className="max-w-sm text-center text-[15px] text-aldi-muted leading-relaxed lg:max-w-md lg:text-base">{t("emptyListHint")}</p>
            {canFillTypical && (
              <div className="flex justify-center">
                <button type="button" onClick={handleFillWithTypical} disabled={fillTypicalLoading}
                  className="touch-target min-w-[200px] rounded-xl border-2 border-aldi-blue bg-white px-5 py-3 text-sm font-semibold text-aldi-blue transition-colors duration-200 pointer-fine:hover:bg-aldi-blue pointer-fine:hover:text-white disabled:opacity-50 lg:min-w-[240px] lg:px-6 lg:py-3.5 lg:text-base">
                  {fillTypicalLoading ? tCommon("loading") : t("fillWithTypicalProducts")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {listId && hasAnyItems && (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <TripNoteSection listId={listId} initialNotes={listNotes} compact />
                </div>
                <div className="shrink-0">
                  <ShareListButton
                    unchecked={unchecked}
                    checked={checked}
                    deferred={deferred}
                    locale={locale}
                  />
                </div>
              </div>
            )}
            {dataSortMode === "shopping-order-tiles" ? (
              <ShoppingTileGrid
                items={unchecked}
                products={products}
                onCheck={setItemChecked}
                onDelete={handleDelete}
                onDefer={handleDefer}
                onBuyElsewhere={actions.handleBuyElsewhere}
              />
            ) : (
              <ListSection items={dataSortMode === "shopping-order" ? unchecked : uncheckedSorted}
                grouped={dataSortMode === "shopping-order"} onCheck={setItemChecked} onQuantityChange={setItemQuantity}
                onDelete={handleDelete} deleteLabel={t("delete")} onOpenDetail={actions.handleOpenDetail}
                onDefer={handleDefer} onBuyElsewhere={actions.handleBuyElsewhere} onRenameItem={actions.handleRenameItem} />
            )}
            {allRegularChecked && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold">✓</span>
                {t("allRegularChecked")}
              </div>
            )}
            <DeferredSections deferredByDate={deferredByDate} formatDeferredDate={formatDeferredDate}
              deferredSectionLabel={t("deferredSection", { date: "{date}" })}
              deferredSectionNextTripLabel={t("deferredSectionNextTrip")} callbacks={deferredCbs} />
            <CheckedSection items={checked} open={ms.checkedOpen} onToggle={modals.toggleCheckedSection}
              label={t("checked")} callbacks={checkedCbs} onUncheckItem={uncheckItem} />
            <ElsewhereSection elsewhereByRetailer={elsewhereByRetailer} sectionLabel={t("buyElsewhereSection")}
              addButtonLabel={t("competitorProductTitle")} onAddCompetitor={() => modals.openCapture({ mode: "create" })}
              callbacks={elsewhereCbs} />
          </>
        )}
      </div>

      {cartScanner.toast && (
        <div className={`fixed left-4 right-4 bottom-20 z-30 animate-fade-in rounded-xl px-4 py-3 text-center text-sm font-medium shadow-lg text-white ${
          cartScanner.toast.type === "success" ? "bg-green-600" : cartScanner.toast.type === "info" ? "bg-aldi-blue" : "bg-yellow-500"
        }`} role="status" aria-live="polite">
          {cartScanner.toast.message}
        </div>
      )}

      {hasAnyItems && (
        <DualPriceFooter
          listTotal={total}
          listWithoutPriceCount={withoutPriceCount}
          listItemCount={unchecked.length + checked.length + deferred.filter(i => i.deferred_reason !== "elsewhere").length}
          cartTotal={cartTotal}
          cartWithoutPriceCount={cartWithoutPriceCount}
          cartItemCount={checked.length}
          onScanPress={scanButtonVisible ? () => cartScanner.setScannerOpen(true) : undefined}
          showCartColumn={scanButtonVisible || checked.length > 0}
        />
      )}

      <ProductDetailModal product={ms.detailProduct} onClose={modals.closeDetail}
        onEdit={(p) => modals.detailToEdit(p)} onReorderChanged={() => { refetch({ forceReorder: true }); }}
        itemId={ms.detailListItemId} comment={ms.detailListItemComment}
        onCommentChange={updateItemComment} />
      {ms.genericPickerItem && (
        <GenericProductPicker genericName={ms.genericPickerItem.display_name || ms.genericPickerItem.custom_name || ""}
          onSelect={actions.handleGenericProductSelected} onClose={modals.closeGenericPicker}
          onCreateProduct={() => {
            const name = ms.genericPickerItem?.display_name || ms.genericPickerItem?.custom_name || "";
            modals.closeGenericPicker();
            modals.openCapture({ mode: "create", initialValues: { name } });
          }}
        />
      )}
      <RetailerPickerSheet open={ms.elsewherePickerItem !== null}
        itemName={ms.elsewherePickerItem?.display_name ?? ms.elsewherePickerItem?.custom_name ?? ""}
        suggestedRetailer={ms.elsewherePickerItem
          ? getRetailerForProduct(
              ms.elsewherePickerItem.product_id ?? null,
              ms.elsewherePickerItem.display_name,
            )
          : null}
        onSelect={actions.handleRetailerSelected} onClose={modals.closeElsewherePicker} />
      <ElsewhereCheckoffPrompt open={ms.checkoffPromptItem !== null}
        itemName={ms.checkoffPromptItem?.display_name ?? ms.checkoffPromptItem?.custom_name ?? ""}
        retailer={ms.checkoffPromptItem?.buy_elsewhere_retailer ?? ""}
        onDone={actions.handleCheckoffDone} onSkip={actions.handleCheckoffSkip} />
      <ProductCaptureModal
        open={ms.captureOpen}
        mode={ms.captureConfig?.mode ?? "create"}
        onClose={modals.closeCapture}
        onGalleryPhotosChanged={async () => {
          await refetchProducts();
          await refetchCompetitorProducts();
          await refetch();
          const s = listModalRef.current;
          const pid = s.detailProduct?.product_id;
          if (pid) {
            const fresh = await fetchAldiProductByIdFromSupabase(pid);
            if (fresh) {
              try {
                await db.products.put(fresh);
              } catch (e) {
                log.warn("[shopping-list] IndexedDB put after gallery change failed:", e);
              }
              modals.openDetail(fresh, s.detailListItemId, s.detailListItemComment);
            }
          }
          const cid = s.detailCompetitorProduct?.product_id;
          if (cid) {
            const cp = await findCompetitorProductById(cid);
            if (cp) modals.openCompetitorDetail(cp, s.detailCompetitorRetailer);
          }
        }}
        onSaved={async (productId, productType, name) => {
          const itemId = ms.captureConfig?.itemId;
          if (itemId) {
            const linkField = productType === "aldi" ? "product_id" : "competitor_product_id";
            try { await updateListItem(itemId, { [linkField]: productId }); }
            catch (e) { console.warn("[shopping-list] link after capture failed:", e); }
          }
          if (productType === "aldi") {
            const isEdit = ms.captureConfig?.mode === "edit" && ms.captureConfig?.editAldiProduct != null;
            if (isEdit) {
              const allItems = [...unchecked, ...checked, ...deferred];
              const linkedItems = allItems.filter(
                (it) => it.product_id === productId && it.custom_name == null,
              );
              await Promise.all(
                linkedItems.map((it) =>
                  updateListItem(it.item_id, { display_name: name }).catch((e) =>
                    console.warn("[shopping-list] display_name sync failed:", e),
                  ),
                ),
              );
            }
            await refetchProducts();
          } else {
            await refetchCompetitorProducts();
          }
          await refetch();
        }}
        initialValues={ms.captureConfig?.initialValues}
        hiddenFields={ms.captureConfig?.hiddenFields}
        editAldiProduct={ms.captureConfig?.editAldiProduct}
        editCompetitorProduct={ms.captureConfig?.editCompetitorProduct}
      />
      <CompetitorProductDetailModal product={ms.detailCompetitorProduct} retailer={ms.detailCompetitorRetailer}
        onClose={modals.closeCompetitorDetail} onEdit={(cp) => modals.editFromCompetitorDetail(cp)} />
      <BarcodeScannerModal
        open={cartScanner.scannerOpen}
        onClose={() => cartScanner.setScannerOpen(false)}
        onProductAdded={cartScanner.onCartProductScanned}
        onCompetitorProductAdded={cartScanner.onCartCompetitorScanned}
        onProductNotFound={cartScanner.onScanNotFound}
        onCreateProduct={cartScanner.onScanCreateProduct}
      />
      {cartScanner.pricePrompt && (
        <CartScanPricePrompt
          productName={cartScanner.pricePrompt.product.name}
          onSubmit={cartScanner.handlePriceSubmit}
          onSkip={cartScanner.handlePriceSkip}
        />
      )}
    </>
  );
});
