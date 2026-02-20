"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ListItemRow } from "./list-item-row";
import { UndoBar } from "./undo-bar";
import { useListData } from "./use-list-data";
import { addListItem, canFillWithTypicalProducts, fillListWithTypicalProducts } from "@/lib/list";
import { reportSortingError } from "@/lib/errors/report-sorting-error";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { SortMode } from "./sort-mode-tabs";

const UNDO_DURATION_MS = 3000;

export interface ShoppingListContentProps {
  /** "my-order" = flat add-order; "shopping-order" = grouped by category / demand group. */
  sortMode: SortMode;
  /** Called with listId when the last item is checked (so the list can be archived as a trip). */
  onLastItemChecked?: (listId: string) => void;
}

export function ShoppingListContent({
  sortMode,
  onLastItemChecked,
}: ShoppingListContentProps) {
  const t = useTranslations("list");
  const {
    listId,
    unchecked,
    checked,
    total,
    withoutPriceCount,
    loading,
    refetch,
    setItemChecked,
    setItemQuantity,
    removeItem,
  } = useListData(sortMode);

  const [deletedForUndo, setDeletedForUndo] = useState<ListItemWithMeta | null>(
    null
  );
  const [showUndo, setShowUndo] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [reportNoStore, setReportNoStore] = useState(false);
  const [canFillTypical, setCanFillTypical] = useState(false);
  const [fillTypicalLoading, setFillTypicalLoading] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReportError = useCallback(async () => {
    const sent = await reportSortingError();
    setReportDialogOpen(false);
    if (sent) {
      setReportSent(true);
      setTimeout(() => setReportSent(false), 3000);
    } else {
      setReportNoStore(true);
      setTimeout(() => setReportNoStore(false), 5000);
    }
  }, []);

  const handleFillWithTypical = useCallback(async () => {
    if (!listId || fillTypicalLoading) return;
    setFillTypicalLoading(true);
    try {
      await fillListWithTypicalProducts(listId);
      await refetch();
    } finally {
      setFillTypicalLoading(false);
    }
  }, [listId, fillTypicalLoading, refetch]);

  const handleDelete = useCallback(
    async (itemId: string) => {
      const item = [...unchecked, ...checked].find((i) => i.item_id === itemId);
      if (!item || !listId) return;
      setDeletedForUndo(item);
      setShowUndo(true);
      await removeItem(itemId);

      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => {
        setShowUndo(false);
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, UNDO_DURATION_MS);
    },
    [unchecked, checked, listId, removeItem]
  );

  const handleUndo = useCallback(async () => {
    if (!deletedForUndo || !listId) return;
    await addListItem({
      list_id: listId,
      product_id: deletedForUndo.product_id,
      custom_name: deletedForUndo.custom_name,
      display_name: deletedForUndo.display_name,
      category_id: deletedForUndo.category_id,
      quantity: deletedForUndo.quantity,
    });
    setDeletedForUndo(null);
    setShowUndo(false);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    await refetch();
  }, [deletedForUndo, listId, refetch]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  // Last item checked -> completion (F03): transition from "has unchecked" to "all checked"
  const prevUncheckedRef = useRef<number | null>(null);
  useEffect(() => {
    const hadUnchecked = prevUncheckedRef.current !== null && prevUncheckedRef.current > 0;
    const nowAllChecked = unchecked.length === 0 && checked.length > 0;
    if (hadUnchecked && nowAllChecked && listId) {
      onLastItemChecked?.(listId);
    }
    prevUncheckedRef.current = unchecked.length;
  }, [unchecked.length, checked.length, listId, onLastItemChecked]);

  // F01: Show "fill with typical products" only when list empty and ≥3 trips
  const listEmpty = unchecked.length === 0 && checked.length === 0;
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

  const tCommon = useTranslations("common");
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-aldi-muted">
        {tCommon("loading")}
      </div>
    );
  }

  const hasAnyItems = unchecked.length > 0 || checked.length > 0;
  const priceFormatted = total.toFixed(2).replace(".", ",");

  return (
    <>
      <div className="min-h-0 flex-1 space-y-8 overflow-auto pb-2">
        {unchecked.length === 0 && checked.length === 0 ? (
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
        ) : sortMode === "my-order" ? (
          <>
            <ul className="space-y-1">
              {[...unchecked]
                .sort((a, b) => a.sort_position - b.sort_position)
                .map((item) => (
                  <li key={item.item_id}>
                    <ListItemRow
                      item={item}
                      onCheck={setItemChecked}
                      onQuantityChange={setItemQuantity}
                      onDelete={handleDelete}
                      deleteLabel={t("delete")}
                    />
                  </li>
                ))}
            </ul>
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
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <>
            {(() => {
              const groups = new Map<string, ListItemWithMeta[]>();
              for (const item of unchecked) {
                const key = item.category_id;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
              }
              const sortedCategories = Array.from(groups.entries()).sort(
                (a, b) =>
                  (a[1][0]?.category_sort_position ?? 0) -
                  (b[1][0]?.category_sort_position ?? 0)
              );
              return (
                <>
                  {sortedCategories.map(([_, items]) => (
                    <section key={items[0].category_id}>
                      <h2 className="mb-1.5 text-category font-semibold uppercase tracking-wider text-aldi-blue">
                        {items[0].category_name}
                      </h2>
                      <ul className="space-y-1">
                        {items.map((item) => (
                          <li key={item.item_id}>
                            <ListItemRow
                              item={item}
                              onCheck={setItemChecked}
                              onQuantityChange={setItemQuantity}
                              onDelete={handleDelete}
                              deleteLabel={t("delete")}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {checked.length > 0 && (
                    <section>
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
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              );
            })()}
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
          {reportDialogOpen ? (
            <div className="mt-3 rounded-xl border border-aldi-muted-light bg-white p-3 text-sm">
              <p className="text-aldi-text">{t("reportErrorMessage")}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleReportError}
                  className="touch-target min-w-[100px] rounded-lg bg-aldi-blue px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90"
                >
                  {t("sendFeedback")}
                </button>
                <button
                  type="button"
                  onClick={() => setReportDialogOpen(false)}
                  className="touch-target min-w-[80px] rounded-lg border border-aldi-muted-light bg-white px-3 py-2 text-sm font-medium text-aldi-text transition-colors hover:bg-gray-50"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </div>
          ) : reportSent ? (
            <p className="mt-2 text-sm font-medium text-aldi-success">{t("thankYouFeedback")}</p>
          ) : reportNoStore ? (
            <p className="mt-2 text-sm text-aldi-muted">{t("reportSelectStoreFirst")}</p>
          ) : (
            <button
              type="button"
              className="mt-2 min-h-touch text-sm text-aldi-muted transition-colors hover:text-aldi-error"
              aria-label={t("reportError")}
              onClick={() => setReportDialogOpen(true)}
            >
              {t("reportError")}
            </button>
          )}
      </footer>
      )}

      {showUndo && (
        <UndoBar
          message={t("removedMessage")}
          undoLabel={t("undo")}
          onUndo={handleUndo}
          onDismiss={() => {
            setShowUndo(false);
            setDeletedForUndo(null);
            if (undoTimeoutRef.current) {
              clearTimeout(undoTimeoutRef.current);
              undoTimeoutRef.current = null;
            }
          }}
        />
      )}
    </>
  );
}
