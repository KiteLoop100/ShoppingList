"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import { getExpiryColor, formatBestBefore } from "@/lib/inventory/expiry-color";
import { InventoryActionsSheet } from "./inventory-actions-sheet";

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 100;
const LONG_PRESS_MS = 500;

interface InventoryItemRowProps {
  item: InventoryItem;
  /** Brief highlight after locating a row via barcode scan on the inventory list. */
  highlighted?: boolean;
  onConsume: (id: string) => void;
  onConsumeAndAddToList: (id: string) => void;
  onOpen: (id: string) => void;
  onSeal: (id: string) => void;
  onFreeze: (id: string) => void;
  onThaw: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
  onItemClick?: (item: InventoryItem) => void;
  onEditBestBefore?: (item: InventoryItem) => void;
}

export function InventoryItemRow({
  item,
  highlighted = false,
  onConsume,
  onConsumeAndAddToList,
  onOpen,
  onSeal,
  onFreeze,
  onThaw,
  onQuantityChange,
  onDelete,
  onItemClick,
  onEditBestBefore,
}: InventoryItemRowProps) {
  const t = useTranslations("inventory");
  const [showActions, setShowActions] = useState(false);
  const [showQuantityPicker, setShowQuantityPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    longPressFiredRef.current = false;
    setSwiping(true);

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setShowActions(true);
      setSwipeX(0);
      setSwiping(false);
    }, LONG_PRESS_MS);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      cancelLongPress();
    }

    if (isHorizontalRef.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontalRef.current) return;

    const canSwipeRight = item.status === "sealed" || item.status === "opened";
    let clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
    if (!canSwipeRight && clamped > 0) clamped = 0;
    setSwipeX(clamped);
  }, [item.status, cancelLongPress]);

  const handleTouchEnd = useCallback(() => {
    cancelLongPress();

    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      setSwipeX(0);
      setSwiping(false);
      isHorizontalRef.current = null;
      return;
    }

    if (swipeX < -SWIPE_THRESHOLD) {
      onConsume(item.id);
    } else if (swipeX > SWIPE_THRESHOLD) {
      if (item.status === "sealed") {
        onOpen(item.id);
      } else if (item.status === "opened") {
        onSeal(item.id);
      }
    }
    setSwipeX(0);
    setSwiping(false);
    isHorizontalRef.current = null;
  }, [swipeX, item.id, item.status, onConsume, onOpen, onSeal, cancelLongPress]);

  const pastThreshold = Math.abs(swipeX) >= SWIPE_THRESHOLD;
  const swipingLeft = swipeX < 0;
  const swipingRight = swipeX > 0;

  const expiryColor = useMemo(
    () => getExpiryColor(item.best_before, item.purchase_date ?? item.added_at.split("T")[0]),
    [item.best_before, item.purchase_date, item.added_at],
  );
  const formattedMhd = useMemo(() => formatBestBefore(item.best_before), [item.best_before]);

  const EXPIRY_STYLES: Record<string, string> = {
    default: "text-aldi-muted",
    warning: "text-amber-600 font-medium",
    danger: "text-red-600 font-semibold",
  };

  const statusBadge = item.status === "opened" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {t("statusOpened")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {t("statusSealed")}
    </span>
  );

  return (
    <>
      <div
        id={`inventory-item-${item.id}`}
        className={`relative overflow-hidden rounded-xl transition-shadow duration-300 ${
          highlighted ? "ring-2 ring-aldi-orange ring-offset-2 ring-offset-white" : ""
        }`}
      >
        {/* Swipe action indicators behind the row */}
        {swiping && swipingRight && (
          <div className={`absolute inset-0 flex items-center justify-start rounded-xl px-4 transition-colors ${
            pastThreshold
              ? (item.status === "opened" ? "bg-green-500" : "bg-amber-500")
              : (item.status === "opened" ? "bg-green-100" : "bg-amber-100")
          }`}>
            <span className={`text-xs font-semibold ${
              pastThreshold ? "text-white" : (item.status === "opened" ? "text-green-700" : "text-amber-700")
            }`}>
              {t(item.status === "opened" ? "swipeSealed" : "swipeOpened")}
            </span>
          </div>
        )}
        {swiping && swipingLeft && (
          <div className={`absolute inset-0 flex items-center justify-end rounded-xl px-4 transition-colors ${
            pastThreshold ? "bg-red-500" : "bg-red-100"
          }`}>
            <span className={`text-xs font-semibold ${pastThreshold ? "text-white" : "text-red-700"}`}>
              {t("swipeConsumed")}
            </span>
          </div>
        )}

        {/* Foreground row */}
        <div
          className="relative flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:bg-gray-50 transition-shadow pointer-fine:hover:shadow-md"
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: swiping ? "none" : "transform 0.25s ease-out",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowActions(true);
          }}
        >
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aldi-muted-light text-aldi-muted">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }}
                className="truncate text-left text-[14px] font-medium text-aldi-text underline-offset-2 hover:underline"
              >
                {item.display_name}
              </button>
              {item.quantity > 1 && (
                <button
                  type="button"
                  onClick={() => setShowQuantityPicker(true)}
                  className="shrink-0 rounded-full bg-aldi-blue-light px-1.5 py-0.5 text-[11px] font-semibold leading-none text-aldi-blue"
                >
                  {item.quantity}×
                </button>
              )}
            </span>
            <div className="flex items-center gap-2">
              {statusBadge}
              {item.is_frozen && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  {t("frozenBadge")}
                </span>
              )}
              {formattedMhd && (
                <span className={`text-[10px] ${EXPIRY_STYLES[expiryColor]}`}>
                  MHD {formattedMhd}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowActions(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-aldi-muted transition-colors hover:bg-gray-100"
            aria-label={t("moreActions")}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onConsumeAndAddToList(item.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-aldi-blue transition-colors hover:bg-blue-100"
            aria-label={t("consumeAndAddToListAction")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onConsume(item.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100"
            aria-label={t("swipeConsumed")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        </div>
      </div>

      {showQuantityPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setShowQuantityPicker(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-center text-sm font-medium text-aldi-text">{item.display_name}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={item.quantity <= 1}
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-aldi-muted-light text-lg font-bold text-aldi-text transition-colors hover:border-aldi-blue disabled:opacity-30"
              >
                −
              </button>
              <span className="w-12 text-center text-2xl font-bold text-aldi-text">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-aldi-muted-light text-lg font-bold text-aldi-text transition-colors hover:border-aldi-blue"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowQuantityPicker(false)}
              className="mt-3 w-full rounded-xl bg-aldi-blue px-4 py-2.5 text-sm font-medium text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showActions && (
        <InventoryActionsSheet
          item={item}
          onClose={() => setShowActions(false)}
          onOpen={onOpen}
          onSeal={onSeal}
          onFreeze={onFreeze}
          onThaw={onThaw}
          onConsume={onConsume}
          onConsumeAndAddToList={onConsumeAndAddToList}
          onDelete={onDelete}
          onEditBestBefore={onEditBestBefore}
          onShowQuantityPicker={() => setShowQuantityPicker(true)}
        />
      )}
    </>
  );
}
