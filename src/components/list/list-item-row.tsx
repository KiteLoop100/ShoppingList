"use client";

import { useState, useRef } from "react";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 80;

export interface ListItemRowProps {
  item: ListItemWithMeta;
  onCheck: (itemId: string, checked: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onDelete: (itemId: string) => void;
  deleteLabel: string;
}

export function ListItemRow({
  item,
  onCheck,
  onQuantityChange,
  onDelete,
  deleteLabel,
}: ListItemRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const current = e.targetTouches[0].clientX;
    const diff = touchStartX.current - current;
    if (diff > 0) {
      setTranslateX(Math.min(diff, DELETE_WIDTH));
    } else {
      setTranslateX(Math.max(0, DELETE_WIDTH + diff));
    }
  };

  const handleTouchEnd = () => {
    if (translateX >= SWIPE_THRESHOLD) {
      setTranslateX(DELETE_WIDTH);
    } else {
      setTranslateX(0);
    }
  };

  const handleCircleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheck(item.item_id, !item.is_checked);
  };

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.is_checked) return;
    const next = Math.max(0, item.quantity - 1);
    onQuantityChange(item.item_id, next);
    if (next === 0) onDelete(item.item_id);
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.is_checked) return;
    onQuantityChange(item.item_id, item.quantity + 1);
  };

  const priceStr =
    item.price != null
      ? `€${(item.price * item.quantity).toFixed(2)}`
      : null;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red delete zone (revealed on swipe) */}
      <button
        type="button"
        className="absolute right-0 top-0 flex h-full w-20 items-center justify-center bg-aldi-error text-sm font-medium text-white transition-opacity duration-ui"
        style={{ zIndex: 1 }}
        onClick={() => onDelete(item.item_id)}
        aria-label={deleteLabel}
      >
        {deleteLabel}
      </button>

      {/* Row content (slides left on swipe, transition <300ms) */}
      <div
        className="relative z-10 flex min-h-touch items-center gap-2 rounded-lg border border-aldi-muted-light bg-white px-3 py-2 transition-[transform,background-color] duration-200 ease-out"
        style={{ transform: `translateX(-${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Circle checkbox – 44px tap area, checkmark animates */}
        <div className="flex min-h-touch min-w-touch shrink-0 items-center justify-center">
          <button
            type="button"
            className="flex h-6 w-6 min-w-6 items-center justify-center rounded-full border-2 border-aldi-blue text-aldi-blue transition-colors duration-200 hover:bg-aldi-blue/10 focus:outline-none focus:ring-2 focus:ring-aldi-blue/30 focus:ring-offset-2"
            onClick={handleCircleClick}
            aria-checked={item.is_checked}
            role="checkbox"
            aria-label={item.is_checked ? "Abhaken rückgängig" : "Abhaken"}
          >
            {item.is_checked ? (
              <span className="animate-check-pop text-sm font-bold leading-none text-aldi-blue">✓</span>
            ) : (
              <span className="text-transparent" aria-hidden>○</span>
            )}
          </button>
        </div>

        {/* Product name */}
        <span
          className={`min-h-touch flex-1 truncate py-2 text-[15px] leading-tight transition-colors duration-200 ${
            item.is_checked
              ? "text-aldi-muted line-through"
              : "text-aldi-text"
          }`}
        >
          {item.display_name}
        </span>

        {/* Quantity: 44px touch targets */}
        <div className="flex shrink-0 items-center rounded-lg border border-aldi-muted-light bg-gray-50">
          <button
            type="button"
            className="flex min-h-touch min-w-touch items-center justify-center text-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/80 disabled:opacity-50"
            onClick={handleMinus}
            disabled={item.is_checked}
            aria-label="Menge verringern"
          >
            −
          </button>
          <span
            className={`min-w-[2.25rem] text-center text-sm font-medium ${
              item.is_checked ? "text-aldi-muted" : "text-aldi-text"
            }`}
          >
            {item.quantity}
          </span>
          <button
            type="button"
            className="flex min-h-touch min-w-touch items-center justify-center text-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/80 disabled:opacity-50"
            onClick={handlePlus}
            disabled={item.is_checked}
            aria-label="Menge erhöhen"
          >
            +
          </button>
        </div>

        {priceStr && (
          <span
            className={`shrink-0 text-sm font-medium tabular-nums ${
              item.is_checked ? "text-aldi-muted" : "text-aldi-text"
            }`}
          >
            {priceStr}
          </span>
        )}
      </div>
    </div>
  );
}
