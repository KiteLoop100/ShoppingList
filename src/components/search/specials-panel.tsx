"use client";

import { useTranslations } from "next-intl";
import { formatShortDate } from "@/lib/utils/format-date";
import type { Product } from "@/types";
import { useProductSelection } from "./use-product-selection";

export interface SpecialsPanelProps {
  specials: Product[];
  loading: boolean;
  onConfirm: (items: { product_id: string; quantity: number }[]) => void;
  onCancel: () => void;
  addCountLabel: (count: number) => string;
  cancelLabel: string;
  titleLabel: string;
  noneLabel: string;
  loadingLabel: string;
  locale: string;
}

export function SpecialsPanel({
  specials,
  loading,
  onConfirm,
  onCancel,
  addCountLabel,
  cancelLabel,
  titleLabel,
  noneLabel,
  loadingLabel,
  locale,
}: SpecialsPanelProps) {
  const t = useTranslations("search");

  const { effectiveSelected, effectiveQuantities, selectedCount, selectedItems, toggle, changeQuantity } =
    useProductSelection({ items: specials, initiallySelected: false });

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white" role="dialog" aria-label={titleLabel}>
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-aldi-muted">
          {loadingLabel}
        </div>
      ) : specials.length === 0 ? (
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
              className={`touch-target w-1/2 min-w-[120px] rounded-xl border-2 px-4 py-3 font-semibold transition-colors ${
                selectedCount > 0
                  ? "border-aldi-blue bg-aldi-blue text-white hover:bg-aldi-blue/90"
                  : "border-aldi-muted-light bg-gray-100 text-aldi-muted"
              }`}
              onClick={() => onConfirm(selectedItems)}
              disabled={selectedCount === 0}
            >
              {addCountLabel(selectedCount)}
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-auto py-2" role="listbox" style={{ minHeight: 0 }}>
            {specials.map((product, index) => {
              const qty = effectiveQuantities[index];
              const isSelected = effectiveSelected[index];
              const startDate = (product as { special_start_date?: string | null }).special_start_date;
              const dateLabel = formatShortDate(startDate, locale);
              return (
                <li key={product.product_id} role="option">
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
                    {product.thumbnail_url && (
                      <img
                        src={product.thumbnail_url}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-aldi-text">
                        {product.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {dateLabel && (
                          <span className="text-[11px] text-aldi-muted">
                            ab {dateLabel}
                          </span>
                        )}
                        {product.price != null && (
                          <span className="text-[11px] font-medium tabular-nums text-aldi-muted">
                            €{product.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
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
