"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

interface TileActionMenuProps {
  onDefer?: () => void;
  onBuyElsewhere?: () => void;
  onDelete?: () => void;
}

export function TileActionMenu({
  onDefer,
  onBuyElsewhere,
  onDelete,
}: TileActionMenuProps) {
  const t = useTranslations("list");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  const handleAction = useCallback(
    (action: (() => void) | undefined) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      action?.();
    },
    [],
  );

  const hasAny = !!onDefer || !!onBuyElsewhere || !!onDelete;
  if (!hasAny) return null;

  return (
    <div ref={menuRef} className="absolute left-1.5 top-1.5 z-20">
      <button
        type="button"
        onClick={toggle}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors active:bg-black/40"
        aria-label="Aktionen"
        aria-expanded={open}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-8 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {onDefer && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-aldi-text transition-colors active:bg-gray-100"
              onClick={handleAction(onDefer)}
            >
              <svg className="h-4 w-4 shrink-0 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              {t("deferToNextTrip")}
            </button>
          )}
          {onBuyElsewhere && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-aldi-text transition-colors active:bg-gray-100"
              onClick={handleAction(onBuyElsewhere)}
            >
              <svg className="h-4 w-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              {t("elsewhereSwipeLabel")}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-aldi-error transition-colors active:bg-gray-100"
              onClick={handleAction(onDelete)}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              {t("delete")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
