"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 100;

interface InventoryItemRowProps {
  item: InventoryItem;
  onConsume: (id: string) => void;
  onOpen: (id: string) => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
}

export function InventoryItemRow({
  item,
  onConsume,
  onOpen,
  onQuantityChange,
  onDelete,
}: InventoryItemRowProps) {
  const t = useTranslations("inventory");
  const [showActions, setShowActions] = useState(false);
  const [showQuantityPicker, setShowQuantityPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;

    if (isHorizontalRef.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontalRef.current) return;

    const canSwipeRight = item.status === "sealed";
    let clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
    if (!canSwipeRight && clamped > 0) clamped = 0;
    setSwipeX(clamped);
  }, [item.status]);

  const handleTouchEnd = useCallback(() => {
    if (swipeX < -SWIPE_THRESHOLD) {
      onConsume(item.id);
    } else if (swipeX > SWIPE_THRESHOLD && item.status === "sealed") {
      onOpen(item.id);
    }
    setSwipeX(0);
    setSwiping(false);
    isHorizontalRef.current = null;
  }, [swipeX, item.id, item.status, onConsume, onOpen]);

  const pastThreshold = Math.abs(swipeX) >= SWIPE_THRESHOLD;
  const swipingLeft = swipeX < 0;
  const swipingRight = swipeX > 0;

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
      <div className="relative overflow-hidden rounded-xl">
        {/* Swipe action indicators behind the row */}
        {swiping && swipingRight && (
          <div className={`absolute inset-0 flex items-center justify-start rounded-xl px-4 transition-colors ${
            pastThreshold ? "bg-amber-500" : "bg-amber-100"
          }`}>
            <span className={`text-xs font-semibold ${pastThreshold ? "text-white" : "text-amber-700"}`}>
              {t("swipeOpened")}
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
          className="relative flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] active:bg-gray-50"
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
              <span className="truncate text-[14px] font-medium text-aldi-text">
                {item.display_name}
              </span>
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
            </div>
          </div>

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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setShowActions(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-aldi-muted-light px-4 py-3">
              <p className="text-sm font-medium text-aldi-text">{item.display_name}</p>
            </div>
            {item.status === "sealed" && (
              <button
                type="button"
                onClick={() => { onOpen(item.id); setShowActions(false); }}
                className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
              >
                {t("swipeOpened")}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowActions(false); setShowQuantityPicker(true); }}
              className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
            >
              {t("changeQuantity")}
            </button>
            <button
              type="button"
              onClick={() => { onConsume(item.id); setShowActions(false); }}
              className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
            >
              {t("swipeConsumed")}
            </button>
            <button
              type="button"
              onClick={() => { onDelete(item.id); setShowActions(false); }}
              className="w-full border-t border-aldi-muted-light px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              {t("delete")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
