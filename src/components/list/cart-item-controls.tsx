"use client";

import { memo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

export interface CartItemControlsProps {
  item: ListItemWithMeta;
  onRemove: (itemId: string) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
}

export const CartItemControls = memo(function CartItemControls({
  item,
  onRemove,
  onQuantityChange,
}: CartItemControlsProps) {
  const t = useTranslations("list");
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    controlsRef.current?.focus();
  }, []);

  const displayPrice =
    item.price != null ? `€${(item.price * item.quantity).toFixed(2)}` : null;

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.quantity <= 1) {
      onRemove(item.item_id);
    } else {
      onQuantityChange(item.item_id, item.quantity - 1);
    }
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuantityChange(item.item_id, item.quantity + 1);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.item_id);
  };

  return (
    <div
      ref={controlsRef}
      className="animate-cart-controls-in flex items-center gap-2 border-t border-aldi-muted-light/50 px-3 py-2"
      role="toolbar"
      aria-label={t("cartControlsLabel")}
      tabIndex={-1}
    >
      <button
        type="button"
        onClick={handleDelete}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-colors hover:bg-red-100 active:bg-red-200"
        aria-label={t("cartRemoveItem")}
      >
        <svg
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          />
        </svg>
      </button>

      <div className="flex items-center gap-1 rounded-lg border border-aldi-muted-light bg-gray-50 px-1">
        <button
          type="button"
          onClick={handleMinus}
          className="flex h-9 w-9 items-center justify-center rounded-md text-aldi-text transition-colors hover:bg-gray-200 active:bg-gray-300"
          aria-label={t("cartQuantityMinus")}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>

        <span
          className="min-w-[28px] text-center text-sm font-semibold tabular-nums text-aldi-text"
          aria-label={t("cartQuantityValue", { count: item.quantity })}
        >
          {item.quantity}
        </span>

        <button
          type="button"
          onClick={handlePlus}
          className="flex h-9 w-9 items-center justify-center rounded-md text-aldi-text transition-colors hover:bg-gray-200 active:bg-gray-300"
          aria-label={t("cartQuantityPlus")}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      <span className="ml-auto shrink-0 text-sm font-medium tabular-nums text-aldi-text">
        {displayPrice ?? "—"}
      </span>
    </div>
  );
});
