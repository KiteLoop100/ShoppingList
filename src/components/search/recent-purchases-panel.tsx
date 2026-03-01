"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";
import type { RecentListProduct } from "@/lib/list";
import { useProductSelection } from "./use-product-selection";

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
}

export function RecentPurchasesPanel({
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
}: RecentPurchasesPanelProps) {
  const t = useTranslations("search");

  const productMap = useMemo(() => new Map(products.map((p) => [p.product_id, p])), [products]);

  const validRecentProducts = useMemo(
    () =>
      recentProducts.filter((r) => {
        const product = productMap.get(r.product_id);
        const name = product?.name?.trim();
        return !!name && !looksLikeUuid(name);
      }),
    [recentProducts, productMap],
  );

  const { effectiveSelected, effectiveQuantities, selectedCount, selectedItems, toggle, changeQuantity } =
    useProductSelection({ items: validRecentProducts, initiallySelected: true });

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
              onClick={() => onConfirm(selectedItems)}
            >
              {addCountLabel(selectedCount)}
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto py-2" role="listbox" style={{ minHeight: 0 }}>
            {validRecentProducts.map((r, index) => {
              const product = productMap.get(r.product_id);
              const name = product?.name ?? r.product_id;
              const qty = effectiveQuantities[index];
              const isSelected = effectiveSelected[index];
              return (
                <li key={r.product_id} role="option">
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
                      <img
                        src={product.thumbnail_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
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
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
