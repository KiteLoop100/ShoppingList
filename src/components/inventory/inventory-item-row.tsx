"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

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
  const touchStartXRef = useRef(0);
  const touchDeltaRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaRef.current = e.touches[0].clientX - touchStartXRef.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const delta = touchDeltaRef.current;
    if (delta < -60) {
      onConsume(item.id);
    } else if (delta > 60 && item.status === "sealed") {
      onOpen(item.id);
    }
    touchDeltaRef.current = 0;
  }, [item.id, item.status, onConsume, onOpen]);

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
        className="group flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-all active:bg-gray-50"
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
          <p className="truncate text-[14px] font-medium text-aldi-text">
            {item.display_name}
          </p>
          <div className="flex items-center gap-2">
            {statusBadge}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowQuantityPicker(true)}
          className="shrink-0 rounded-lg border border-aldi-muted-light px-2.5 py-1 text-sm font-medium text-aldi-text transition-colors hover:border-aldi-blue hover:text-aldi-blue"
        >
          {item.quantity}x
        </button>

        <button
          type="button"
          onClick={() => onConsume(item.id)}
          className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          aria-label={t("swipeConsumed")}
        >
          {t("swipeConsumed")}
        </button>
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
              {t("statusSealed") /* reuse as "done" */}
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
