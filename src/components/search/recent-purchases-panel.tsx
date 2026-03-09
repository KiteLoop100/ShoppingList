"use client";

import { Fragment, memo, useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Product } from "@/types";
import type { RecentListProduct, ReceiptProduct } from "@/lib/list";
import { useProductSelection } from "./use-product-selection";
import {
  sortRecentByCategory,
  computeSections,
  SECTION_ICONS,
  type CategoryGroupKey,
} from "@/lib/list/recent-purchase-categories";

function looksLikeUuid(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 32) return false;
  return /^[0-9a-f-]{32,36}$/i.test(t) && (t.includes("-") || t.length >= 32);
}

export interface RecentPurchasesPanelProps {
  recentProducts: RecentListProduct[];
  products: Product[];
  loading: boolean;
  onConfirm: (items: { product_id: string; quantity: number }[]) => void;
  onCancel: () => void;
  addCountLabel: (count: number) => string;
  cancelLabel: string;
  titleLabel: string;
  noneLabel: string;
  loadingLabel: string;
  /** When provided, receipt_name is used as fallback for items not in the product catalog. */
  receiptProducts?: ReceiptProduct[];
}

export const RecentPurchasesPanel = memo(function RecentPurchasesPanel({
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
  receiptProducts,
}: RecentPurchasesPanelProps) {
  const t = useTranslations("search");

  const productMap = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products]);

  const receiptNameMap = useMemo(() => {
    if (!receiptProducts) return null;
    const m = new Map<string, string>();
    for (const rp of receiptProducts) {
      if (rp.product_id && rp.receipt_name) m.set(rp.product_id, rp.receipt_name);
    }
    return m;
  }, [receiptProducts]);

  const sortedProducts = useMemo(() => {
    const valid = recentProducts.filter((r) => {
      const product = productMap.get(r.product_id);
      const catalogName = product?.name?.trim();
      if (catalogName && !looksLikeUuid(catalogName)) return true;
      if (receiptNameMap?.get(r.product_id)) return true;
      return false;
    });
    return sortRecentByCategory(valid, productMap);
  }, [recentProducts, productMap, receiptNameMap]);

  const sections = useMemo(
    () => computeSections(sortedProducts, productMap),
    [sortedProducts, productMap],
  );

  const sectionLabelKey: Record<CategoryGroupKey, string> = {
    produce: "recentSectionProduce",
    chilled: "recentSectionChilled",
    frozen: "recentSectionFrozen",
    dry: "recentSectionDry",
  };

  const sectionStartSet = useMemo(
    () => new Set(sections.map((s) => s.startIndex)),
    [sections],
  );

  const { effectiveSelected, effectiveQuantities, selectedCount, selectedItems, allSelected, toggle, changeQuantity, selectAll, deselectAll } =
    useProductSelection({ items: sortedProducts, initiallySelected: true });

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
      ) : sortedProducts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <svg
            className="mb-4 h-16 w-16 text-aldi-muted-light"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <p className="text-center text-sm text-aldi-muted">{noneLabel}</p>
          <Link
            href="/receipts"
            className="touch-target mt-4 flex items-center gap-2 rounded-xl border-2 border-aldi-blue bg-aldi-blue px-5 py-3 font-semibold text-white transition-colors hover:bg-aldi-blue/90"
            onClick={onCancel}
          >
            {t("recentPurchasesScanLink")}
          </Link>
          <button
            type="button"
            className="touch-target mt-3 w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-text transition-colors hover:bg-gray-50"
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
              onClick={() => onConfirm(selectedItems)}
            >
              {addCountLabel(selectedCount)}
            </button>
          </div>
          <div className="shrink-0 border-b border-aldi-muted-light bg-gray-50 px-4 py-2">
            <button
              type="button"
              className="flex items-center gap-2 py-1"
              onClick={allSelected ? deselectAll : selectAll}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                  allSelected
                    ? "border-aldi-blue bg-aldi-blue text-white"
                    : "border-aldi-muted-light bg-white text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              <span className="text-sm font-medium text-aldi-blue">
                {allSelected ? t("recentDeselectAll") : t("recentSelectAll")}
              </span>
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto" role="listbox" style={{ minHeight: 0 }}>
            {sortedProducts.map((r, index) => {
              const product = productMap.get(r.product_id);
              const name = product?.name || receiptNameMap?.get(r.product_id) || r.product_id;
              const qty = effectiveQuantities[index];
              const isSelected = effectiveSelected[index];
              const section = sectionStartSet.has(index)
                ? sections.find((s) => s.startIndex === index)
                : undefined;
              return (
                <Fragment key={r.product_id}>
                  {section && (
                    <li
                      role="presentation"
                      className="sticky top-0 z-[2] flex items-center gap-2 border-b border-aldi-muted-light bg-gray-100 px-4 py-1.5"
                    >
                      <span aria-hidden>{SECTION_ICONS[section.key]}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-aldi-muted">
                        {t(sectionLabelKey[section.key])}
                      </span>
                    </li>
                  )}
                  <li role="option" aria-selected={isSelected}>
                    <div className="flex min-h-touch w-full items-center gap-2 px-4 py-2">
                      <button
                        type="button"
                        className="flex shrink-0 items-center justify-center"
                        onClick={() => toggle(index)}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold ${
                            isSelected
                              ? "border-aldi-blue bg-aldi-blue text-white"
                              : "border-aldi-muted-light text-transparent"
                          }`}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </button>
                      {product?.thumbnail_url && (
                        <Image
                          src={product.thumbnail_url}
                          alt=""
                          role="presentation"
                          width={40}
                          height={40}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                          unoptimized
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-[15px] text-aldi-text">
                        {name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-aldi-muted-light bg-gray-50 text-sm font-bold text-aldi-text transition-colors hover:bg-aldi-muted-light/80"
                          onClick={(e) => { e.stopPropagation(); changeQuantity(index, -1); }}
                          aria-label={t("decreaseQuantity")}
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums text-aldi-text">
                          {qty}
                        </span>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-aldi-muted-light bg-gray-50 text-sm font-bold text-aldi-text transition-colors hover:bg-aldi-muted-light/80"
                          onClick={(e) => { e.stopPropagation(); changeQuantity(index, 1); }}
                          aria-label={t("increaseQuantity")}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
});
