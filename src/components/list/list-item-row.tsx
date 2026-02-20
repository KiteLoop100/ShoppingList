"use client";

import { useState, useRef } from "react";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import { QuantityWheelModal } from "./quantity-wheel-modal";

const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 80;
const THUMB_SIZE = 52;
/** Min horizontal movement (px) before we treat as swipe – avoids drift during vertical scroll */
const HORIZONTAL_SLOP = 18;
/** Require horizontal movement to dominate: |dx| >= |dy| * ratio so vertical scroll doesn't trigger swipe */
const HORIZONTAL_RATIO = 1.4;

export interface ListItemRowProps {
  item: ListItemWithMeta;
  onCheck: (itemId: string, checked: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onDelete: (itemId: string) => void;
  deleteLabel: string;
  /** Called when user taps the product name to show full product details. */
  onOpenDetail?: (item: ListItemWithMeta) => void;
}

export function ListItemRow({
  item,
  onCheck,
  onQuantityChange,
  onDelete,
  deleteLabel,
  onOpenDetail,
}: ListItemRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [wheelOpen, setWheelOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const curX = e.targetTouches[0].clientX;
    const curY = e.targetTouches[0].clientY;
    const deltaX = touchStartX.current - curX;
    const deltaY = touchStartY.current - curY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    // Only treat as horizontal swipe if movement is clearly horizontal (reduces accidental swipe when scrolling)
    if (absX >= HORIZONTAL_SLOP && absX >= absY * HORIZONTAL_RATIO) {
      if (deltaX > 0) {
        setTranslateX(Math.min(deltaX, DELETE_WIDTH));
      } else {
        setTranslateX(Math.max(0, DELETE_WIDTH + deltaX));
      }
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

  const handleQuantityTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.is_checked) return;
    setWheelOpen(true);
  };

  const handleWheelSelect = (q: number) => {
    onQuantityChange(item.item_id, q);
    if (q === 0) onDelete(item.item_id);
  };

  const handleNameTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenDetail) onOpenDetail(item);
  };

  const priceStr =
    item.price != null
      ? `€${(item.price * item.quantity).toFixed(2)}`
      : null;

  return (
    <div className="relative min-w-0 w-full overflow-hidden rounded-xl">
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

      {/* Row content: min-w-0 so flex can shrink and price stays visible when thumbnail is present */}
      <div
        className="relative z-10 flex min-h-touch min-w-0 items-center gap-1.5 rounded-lg border border-aldi-muted-light bg-white px-2 py-2 transition-[transform,background-color] duration-200 ease-out"
        style={{ transform: `translateX(-${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Circle checkbox – less padding */}
        <div className="flex min-h-touch min-w-9 shrink-0 items-center justify-center">
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

        {/* Product name – tappable, truncate; underlined when additional info available */}
        <button
          type="button"
          className={`min-h-touch min-w-0 flex-1 truncate py-2 text-left text-[15px] leading-tight transition-colors duration-200 ${
            item.is_checked
              ? "text-aldi-muted line-through"
              : "text-aldi-text"
          } ${item.has_additional_info ? "underline" : ""} ${onOpenDetail ? "cursor-pointer hover:underline" : ""}`}
          onClick={handleNameTap}
        >
          {item.display_name}
        </button>

        {/* Only front thumbnail on list (thumbnail_url = Vorderseite) */}
        {item.thumbnail_url && (
          <div
            className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-aldi-muted-light/30"
            style={{ maxWidth: 60, maxHeight: 60 }}
          >
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-full w-full object-cover object-center"
              width={THUMB_SIZE}
              height={THUMB_SIZE}
            />
          </div>
        )}

        {/* Quantity – tap opens wheel picker */}
        <div className="shrink-0">
          <button
            type="button"
            className={`flex min-h-8 min-w-8 items-center justify-center rounded-md border border-aldi-muted-light bg-gray-50 px-2 transition-colors hover:bg-aldi-muted-light/80 disabled:opacity-50 ${
              item.is_checked ? "text-aldi-muted" : "text-aldi-text"
            }`}
            onClick={handleQuantityTap}
            disabled={item.is_checked}
            aria-label="Menge ändern"
          >
            <span className="text-sm font-medium tabular-nums">{item.quantity}</span>
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

      <QuantityWheelModal
        key={wheelOpen ? `${item.item_id}-${item.quantity}` : item.item_id}
        open={wheelOpen}
        value={item.quantity}
        onSelect={(q) => {
          if (q >= 1) handleWheelSelect(q);
        }}
        onClose={() => setWheelOpen(false)}
      />
    </div>
  );
}
