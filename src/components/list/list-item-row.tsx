"use client";

import { useState, memo, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import { QuantityWheelModal } from "./quantity-wheel-modal";
import { useSwipeActions } from "./hooks/use-swipe-actions";
import { useInlineRename } from "./hooks/use-inline-rename";
import { ItemName } from "./item-name";
import { SwipeActionButtons, HoverActionButtons } from "./item-actions";

const THUMB_SIZE = 52;

export interface ListItemRowProps {
  item: ListItemWithMeta;
  onCheck: (itemId: string, checked: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onDelete: (itemId: string) => void;
  deleteLabel: string;
  /** Called when user taps the product name to show full product details. */
  onOpenDetail?: (item: ListItemWithMeta) => void;
  /** Small category/demand-group label shown below the product name (flat walking-order mode). */
  categoryLabel?: string;
  /** Called when user swipes right to defer the item to the next trip. */
  onDefer?: (itemId: string) => void;
  /** Called when user swipes right on a manually deferred item to un-defer it. */
  onUndefer?: (itemId: string) => void;
  /** Called when user swipes right past the elsewhere threshold, or taps an elsewhere badge. */
  onBuyElsewhere?: (itemId: string) => void;
  /** Called when user long-presses a generic product name to rename it. */
  onRenameItem?: (itemId: string, newName: string) => void;
  /** When true the row plays a fade-out/collapse animation before removal. */
  isExiting?: boolean;
}

export const ListItemRow = memo(function ListItemRow({
  item,
  onCheck,
  onQuantityChange,
  onDelete,
  deleteLabel,
  onOpenDetail,
  categoryLabel,
  onDefer,
  onUndefer,
  onBuyElsewhere,
  onRenameItem,
  isExiting,
}: ListItemRowProps) {
  const t = useTranslations("list");

  const isDeferred = item.is_deferred === true;
  const isManuallyDeferred = isDeferred && item.deferred_reason === "manual";
  const isElsewhere = isDeferred && item.deferred_reason === "elsewhere";
  const canDefer = !isDeferred && !item.is_checked && !!onDefer;
  const canUndefer = isManuallyDeferred && !!onUndefer;
  const canBuyElsewhere = !isDeferred && !item.is_checked && !!onBuyElsewhere;
  const hasRightSwipe = (canDefer || canUndefer || canBuyElsewhere) && !isElsewhere;

  const {
    translateX,
    setTranslateX,
    isSnappedElsewhere,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeActions({ hasRightSwipe, canBuyElsewhere });

  const [wheelOpen, setWheelOpen] = useState(false);

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

  const renameActions = useInlineRename({ item, onRenameItem, onOpenDetail });
  const { editing } = renameActions;

  /* --- action callbacks --------------------------------------------- */
  const displayPrice = isElsewhere ? (item.competitor_price ?? null) : (item.price ?? null);
  const priceStr =
    displayPrice != null
      ? `€${(displayPrice * item.quantity).toFixed(2)}`
      : null;

  const handleDeferTap = () => {
    if (canDefer) onDefer!(item.item_id);
    else if (canUndefer) onUndefer!(item.item_id);
    setTranslateX(0);
  };

  const handleElsewhereTap = () => {
    onBuyElsewhere?.(item.item_id);
    setTranslateX(0);
  };

  const [hovered, setHovered] = useState(false);
  const showHoverActions = hovered && translateX === 0 && !item.is_checked && !editing;

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onDelete(item.item_id);
      } else if (e.key === "d" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (canDefer) onDefer?.(item.item_id);
        else if (canUndefer) onUndefer?.(item.item_id);
      } else if (e.key === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (canBuyElsewhere) onBuyElsewhere?.(item.item_id);
      } else if (e.key === " " && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onCheck(item.item_id, !item.is_checked);
      }
    },
    [editing, item.item_id, item.is_checked, canDefer, canUndefer, canBuyElsewhere, onDelete, onDefer, onUndefer, onBuyElsewhere, onCheck],
  );

  return (
    <div
      className={`group relative min-w-0 w-full overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-aldi-blue/30 focus-within:ring-offset-1${isExiting ? " animate-check-exit" : ""}`}
      tabIndex={isExiting ? -1 : 0}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SwipeActionButtons
        hasRightSwipe={hasRightSwipe}
        canUndefer={canUndefer}
        canBuyElsewhere={canBuyElsewhere}
        isSnappedElsewhere={isSnappedElsewhere}
        deleteLabel={deleteLabel}
        onDeferTap={handleDeferTap}
        onElsewhereTap={handleElsewhereTap}
        onDelete={() => onDelete(item.item_id)}
      />

      {/* Row content */}
      <div
        className={`relative z-10 flex min-h-touch min-w-0 items-center gap-1.5 rounded-lg border border-aldi-muted-light px-2 py-2 transition-[transform,background-color,opacity,box-shadow] duration-200 ease-out md:gap-2 md:px-3 md:py-2.5 lg:gap-3 lg:px-4 lg:py-3 pointer-fine:hover:shadow-md pointer-fine:hover:border-aldi-blue/20 ${isDeferred ? "bg-gray-100" : "bg-white"}`}
        style={{ transform: `translateX(${-translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Circle checkbox */}
        <div className="flex min-h-touch min-w-touch shrink-0 items-center justify-center">
          <button
            type="button"
            className={`flex h-6 w-6 min-w-6 items-center justify-center rounded-full border-2 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDeferred
                ? "border-gray-300 text-gray-300 pointer-events-none"
                : "border-aldi-blue text-aldi-blue hover:bg-aldi-blue/10 focus:ring-aldi-blue/30"
            }`}
            onClick={handleCircleClick}
            aria-checked={item.is_checked}
            role="checkbox"
            aria-label={item.is_checked ? t("uncheckItem") : t("checkItem")}
            disabled={isDeferred}
          >
            {item.is_checked ? (
              <span className="animate-check-pop text-sm font-bold leading-none text-aldi-blue">✓</span>
            ) : item.has_auto_reorder ? (
              <svg className="h-3.5 w-3.5 text-aldi-blue/50" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            ) : (
              <span className="text-transparent" aria-hidden>○</span>
            )}
          </button>
        </div>

        <ItemName
          item={item}
          isDeferred={isDeferred}
          isElsewhere={isElsewhere}
          categoryLabel={categoryLabel}
          hasOpenDetail={!!onOpenDetail}
          rename={renameActions}
        />

        {/* Thumbnail */}
        {(item.thumbnail_url || item.competitor_thumbnail_url) && (
          <div
            className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-white"
            style={{ maxWidth: 60, maxHeight: 60 }}
          >
            <Image
              src={(item.thumbnail_url || item.competitor_thumbnail_url)!}
              alt=""
              role="presentation"
              width={THUMB_SIZE}
              height={THUMB_SIZE}
              className="h-full w-full object-contain object-center"
              unoptimized
            />
          </div>
        )}

        {/* Quantity */}
        <div className="shrink-0">
          <button
            type="button"
            className={`flex min-h-touch min-w-[36px] items-center justify-center rounded-md border border-aldi-muted-light bg-gray-50 px-2 transition-colors hover:bg-aldi-muted-light/80 disabled:opacity-50 ${
              item.is_checked ? "text-aldi-muted" : "text-aldi-text"
            }`}
            onClick={handleQuantityTap}
            disabled={item.is_checked}
            aria-label={t("changeQuantity")}
          >
            <span className="text-sm font-medium tabular-nums">{item.quantity}</span>
          </button>
        </div>

        {priceStr && (
          <span
            className={`shrink-0 text-sm font-medium tabular-nums ${
              item.is_checked || isDeferred ? "text-aldi-muted" : "text-aldi-text"
            }`}
          >
            {priceStr}
          </span>
        )}

        {showHoverActions && (
          <HoverActionButtons
            canDefer={canDefer}
            canUndefer={canUndefer}
            canBuyElsewhere={canBuyElsewhere}
            deleteLabel={deleteLabel}
            onDeferTap={handleDeferTap}
            onElsewhereTap={handleElsewhereTap}
            onDelete={() => onDelete(item.item_id)}
          />
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
});
