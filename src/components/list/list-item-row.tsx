"use client";

import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import { QuantityWheelModal } from "./quantity-wheel-modal";
import { formatShortDate } from "@/lib/utils/format-date";


const SWIPE_THRESHOLD = 60;
const DELETE_WIDTH = 80;
const DEFER_WIDTH = 80;

const Z1_STYLE = { zIndex: 1 } as const;
const Z2_HIDDEN_STYLE = { zIndex: 2, pointerEvents: "none" as const, opacity: 0 } as const;
const ELSEWHERE_THRESHOLD = 100;
const ELSEWHERE_WIDTH = 120;
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
}: ListItemRowProps) {
  const locale = useLocale();
  const t = useTranslations("list");
  // Positive = swiped left (delete visible), negative = swiped right (defer visible)
  const [translateX, setTranslateX] = useState(0);
  const [wheelOpen, setWheelOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const translateXAtStart = useRef(0);
  const isDeferred = item.is_deferred === true;
  const isManuallyDeferred = isDeferred && item.deferred_reason === "manual";
  const isElsewhere = isDeferred && item.deferred_reason === "elsewhere";
  const canDefer = !isDeferred && !item.is_checked && !!onDefer;
  const canUndefer = isManuallyDeferred && !!onUndefer;
  const canBuyElsewhere = !isDeferred && !item.is_checked && !!onBuyElsewhere;
  const hasRightSwipe = (canDefer || canUndefer || canBuyElsewhere) && !isElsewhere;

  const deferredBadge = useMemo(() => {
    if (!isDeferred || !item.available_from) return null;
    if (item.available_from === "next_trip") return null;
    return formatShortDate(item.available_from, locale);
  }, [isDeferred, item.available_from, locale]);

  const reorderCountdownLabel = useMemo(() => {
    if (!isDeferred || item.deferred_reason !== "reorder" || !item.available_from) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(item.available_from + "T00:00:00");
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays <= 0) return null;
    if (diffDays <= 14) {
      return locale === "de" ? `in ${diffDays} Tag${diffDays !== 1 ? "en" : ""}` : `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    }
    const weeks = Math.ceil(diffDays / 7);
    return locale === "de" ? `in ${weeks} Woche${weeks !== 1 ? "n" : ""}` : `in ${weeks} week${weeks !== 1 ? "s" : ""}`;
  }, [isDeferred, item.deferred_reason, item.available_from, locale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    translateXAtStart.current = translateX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const curX = e.targetTouches[0].clientX;
    const curY = e.targetTouches[0].clientY;
    const deltaX = touchStartX.current - curX;
    const deltaY = touchStartY.current - curY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX >= HORIZONTAL_SLOP && absX >= absY * HORIZONTAL_RATIO) {
      const newX = translateXAtStart.current + deltaX;
      const minX = hasRightSwipe ? (canBuyElsewhere ? -ELSEWHERE_WIDTH : -DEFER_WIDTH) : 0;
      setTranslateX(Math.max(minX, Math.min(DELETE_WIDTH, newX)));
    }
  };

  const handleTouchEnd = () => {
    if (translateX >= SWIPE_THRESHOLD) {
      setTranslateX(DELETE_WIDTH);
    } else if (translateX <= -ELSEWHERE_THRESHOLD && canBuyElsewhere) {
      setTranslateX(-ELSEWHERE_WIDTH);
    } else if (translateX <= -SWIPE_THRESHOLD && hasRightSwipe) {
      setTranslateX(-DEFER_WIDTH);
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

  const isGeneric = !item.product_id && !item.competitor_product_id;
  const canRename = isGeneric && !!onRenameItem;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const startLongPress = useCallback(() => {
    if (!canRename) return;
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setEditValue(item.display_name || item.custom_name || "");
      setEditing(true);
    }, 500);
  }, [canRename, item.display_name, item.custom_name]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleNameTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (editing) return;
    if (onOpenDetail) onOpenDetail(item);
  };

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== (item.display_name || item.custom_name || "")) {
      onRenameItem?.(item.item_id, trimmed);
    }
  }, [editValue, item.display_name, item.custom_name, item.item_id, onRenameItem]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }, [commitRename]);

  const priceStr =
    item.price != null
      ? `€${(item.price * item.quantity).toFixed(2)}`
      : null;

  const handleDeferTap = () => {
    if (canDefer) {
      onDefer!(item.item_id);
    } else if (canUndefer) {
      onUndefer!(item.item_id);
    }
    setTranslateX(0);
  };

  const handleElsewhereTap = () => {
    onBuyElsewhere?.(item.item_id);
    setTranslateX(0);
  };

  const isSnappedElsewhere = translateX <= -ELSEWHERE_THRESHOLD;

  const [hovered, setHovered] = useState(false);
  const showHoverActions = hovered && translateX === 0 && !item.is_checked && !editing;

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [editing, item.item_id, item.is_checked, canDefer, canUndefer, canBuyElsewhere, onDelete, onDefer, onUndefer, onBuyElsewhere, onCheck]);

  return (
    <div
      className="group relative min-w-0 w-full overflow-hidden rounded-xl focus-within:ring-2 focus-within:ring-aldi-blue/30 focus-within:ring-offset-1"
      tabIndex={0}
      onKeyDown={handleRowKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Right-swipe background zones */}
      {hasRightSwipe && (
        <>
          {/* Blue base layer – defer / undefer */}
          <button
            type="button"
            className="absolute left-0 top-0 flex h-full w-20 items-center justify-center bg-aldi-blue text-[11px] font-medium leading-tight text-white transition-opacity duration-ui"
            style={Z1_STYLE}
            onClick={handleDeferTap}
            aria-label={canUndefer ? t("uncheckItem") : t("deferToNextTrip")}
          >
            {canUndefer ? "↩" : t("deferToNextTrip")}
          </button>

          {/* Orange overlay – "Anderswo" (buy elsewhere), visible past ELSEWHERE_THRESHOLD */}
          {canBuyElsewhere && (
            <button
              type="button"
              className="absolute left-0 top-0 flex h-full items-center justify-center bg-orange-500 text-[11px] font-semibold leading-tight text-white transition-opacity duration-200"
              style={isSnappedElsewhere
                ? { zIndex: 2, width: ELSEWHERE_WIDTH, opacity: 1, pointerEvents: "auto" as const }
                : { ...Z2_HIDDEN_STYLE, width: ELSEWHERE_WIDTH }
              }
              onClick={handleElsewhereTap}
              aria-label={t("elsewhereSwipeLabel")}
            >
              {t("elsewhereSwipeLabel")}
            </button>
          )}
        </>
      )}

      {/* Red delete zone (revealed on left-swipe) */}
      <button
        type="button"
        className="absolute right-0 top-0 flex h-full w-20 items-center justify-center bg-aldi-error text-sm font-medium text-white transition-opacity duration-ui"
        style={Z1_STYLE}
        onClick={() => onDelete(item.item_id)}
        aria-label={deleteLabel}
      >
        {deleteLabel}
      </button>

      {/* Row content */}
      <div
        className={`relative z-10 flex min-h-touch min-w-0 items-center gap-1.5 rounded-lg border border-aldi-muted-light px-2 py-2 transition-[transform,background-color,opacity] duration-200 ease-out md:gap-2 md:px-3 md:py-2.5 lg:gap-3 lg:px-4 lg:py-3 ${isDeferred ? "bg-gray-100" : "bg-white"}`}
        style={{ transform: `translateX(${-translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Circle checkbox – disabled and grey for deferred items */}
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

        {/* Product name + optional category badge + deferred date badge */}
        <button
          type="button"
          className={`min-h-touch min-w-0 flex-1 py-2 text-left transition-colors duration-200 ${
            onOpenDetail ? "cursor-pointer" : ""
          }`}
          onClick={handleNameTap}
          onDoubleClick={canRename ? (e) => {
            e.stopPropagation();
            setEditValue(item.display_name || item.custom_name || "");
            setEditing(true);
          } : undefined}
          onTouchStart={canRename ? startLongPress : undefined}
          onTouchEnd={canRename ? cancelLongPress : undefined}
          onTouchMove={canRename ? cancelLongPress : undefined}
          onContextMenu={canRename ? (e) => {
            e.preventDefault();
            setEditValue(item.display_name || item.custom_name || "");
            setEditing(true);
          } : undefined}
        >
          {editing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleEditKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="block w-full rounded-md border border-aldi-blue bg-white px-2 py-1 text-[15px] leading-tight text-aldi-text outline-none ring-1 ring-aldi-blue/30"
            />
          ) : (
          <span className={`block truncate text-[15px] leading-tight ${
            item.is_checked ? "text-aldi-muted line-through" : isDeferred ? "text-aldi-muted" : "text-aldi-text"
          } ${!item.product_id ? "italic" : ""} ${onOpenDetail ? "hover:underline" : ""}`}>
            {isGeneric && (
              <svg className="mr-1 inline-block h-3 w-3 -translate-y-px text-aldi-muted/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
            )}
            {item.display_name}
          </span>
          )}
          {isElsewhere ? (
            item.competitor_brand ? (
              <span className="block truncate text-[11px] leading-snug text-aldi-muted">
                {item.competitor_brand}
              </span>
            ) : null
          ) : isDeferred && item.deferred_reason ? (
            <span className={`mt-0.5 inline-block truncate rounded px-1 py-0.5 text-[11px] font-medium leading-snug ${
              item.deferred_reason === "special"
                ? "bg-amber-100 text-amber-800"
                : item.deferred_reason === "manual"
                  ? "bg-gray-200 text-gray-600"
                  : "bg-blue-100 text-blue-700"
            }`}>
              {item.deferred_reason === "special"
                ? t("deferredBadgeSpecial")
                : item.deferred_reason === "manual"
                  ? t("deferredBadgeManual")
                  : reorderCountdownLabel
                    ? `${t("deferredBadgeReorder")}: ${reorderCountdownLabel}`
                    : t("deferredBadgeReorder")}
            </span>
          ) : categoryLabel ? (
            <span className="block truncate text-[11px] leading-snug text-aldi-muted">
              {categoryLabel}
            </span>
          ) : null}
        </button>

        {/* Thumbnail: ALDI product or competitor product */}
        {(item.thumbnail_url || item.competitor_thumbnail_url) && (
          <div
            className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-aldi-muted-light/30"
            style={{ maxWidth: 60, maxHeight: 60 }}
          >
            <img
              src={(item.thumbnail_url || item.competitor_thumbnail_url)!}
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

        {/* Hover action buttons – visible only on pointer:fine devices */}
        {showHoverActions && (
          <div className="pointer-coarse:hidden flex shrink-0 items-center gap-0.5">
            {(canDefer || canUndefer) && (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-blue/10"
                onClick={(e) => { e.stopPropagation(); handleDeferTap(); }}
                title={canUndefer ? t("uncheckItem") : t("deferToNextTrip")}
                aria-label={canUndefer ? t("uncheckItem") : t("deferToNextTrip")}
              >
                {canUndefer ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                )}
              </button>
            )}
            {canBuyElsewhere && (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-500 transition-colors hover:bg-orange-50"
                onClick={(e) => { e.stopPropagation(); handleElsewhereTap(); }}
                title={t("elsewhereSwipeLabel")}
                aria-label={t("elsewhereSwipeLabel")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-aldi-error transition-colors hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); onDelete(item.item_id); }}
              title={deleteLabel}
              aria-label={deleteLabel}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
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
