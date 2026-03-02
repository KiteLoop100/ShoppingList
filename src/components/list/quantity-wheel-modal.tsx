"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

const MIN = 1;
const MAX = 99;
const ITEM_HEIGHT = 40;
const PADDING_Y = 90;

const HIGHLIGHT_STYLE = { top: "50%", transform: "translateY(-50%)" } as const;
const DIALOG_STYLE = { touchAction: "manipulation" } as const;
const SNAP_ALIGN_STYLE = { scrollSnapAlign: "center" } as const;

export interface QuantityWheelModalProps {
  open: boolean;
  value: number;
  onSelect: (quantity: number) => void;
  onClose: () => void;
}

export function QuantityWheelModal({
  open,
  value,
  onSelect,
  onClose,
}: QuantityWheelModalProps) {
  const t = useTranslations("list");
  const clampedValue = Math.max(MIN, Math.min(MAX, value));
  const [selected, setSelected] = useState(clampedValue);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(clampedValue);
  }, [open, clampedValue]);

  // Set scroll so the selected number is centred in the highlight strip (not at the top edge)
  useLayoutEffect(() => {
    if (!open) return;
    const index = clampedValue - MIN;
    const targetScroll = index * ITEM_HEIGHT;
    const apply = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.style.scrollBehavior = "auto";
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = Math.min(targetScroll, maxScroll);
      el.style.scrollBehavior = "";
    };
    apply();
    const t1 = setTimeout(apply, 0);
    const t2 = setTimeout(apply, 100);
    const t3 = setTimeout(apply, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [open, clampedValue]);

  const handleSelect = (q: number) => {
    onSelect(q);
    onClose();
  };

  const rafRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const q = Math.max(MIN, Math.min(MAX, MIN + index));
      setSelected(q);
    });

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollTimeoutRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const q = Math.max(MIN, Math.min(MAX, MIN + index));
      setSelected(q);
      el.scrollTo({ top: (q - MIN) * ITEM_HEIGHT, behavior: "smooth" });
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef<number>(0);

  // Lock body scroll and block touch events on overlay with passive: false (so preventDefault takes effect)
  useEffect(() => {
    if (!open) return;
    scrollTopRef.current = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollTopRef.current}px`;
    body.style.width = "100%";

    const preventTouch = (e: TouchEvent) => {
      e.preventDefault();
    };
    let overlayEl: HTMLDivElement | null = null;
    const t = setTimeout(() => {
      overlayEl = overlayRef.current;
      if (overlayEl) {
        overlayEl.addEventListener("touchmove", preventTouch, { passive: false });
        overlayEl.addEventListener("touchstart", preventTouch, { passive: false });
      }
    }, 0);
    return () => {
      clearTimeout(t);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollTopRef.current);
      if (overlayEl) {
        overlayEl.removeEventListener("touchmove", preventTouch);
        overlayEl.removeEventListener("touchstart", preventTouch);
      }
    };
  }, [open]);

  if (!open) return null;

  const items = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

  const modalContent = (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 touch-none bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-lg flex-col rounded-t-2xl bg-white shadow-lg sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("selectQuantity")}
        style={DIALOG_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <span className="text-sm font-medium text-aldi-muted">{t("quantityLabel")}</span>
          <button
            type="button"
            className="touch-target rounded-lg px-3 py-1.5 text-sm font-semibold text-aldi-blue"
            onClick={() => handleSelect(selected)}
          >
            {t("doneButton")}
          </button>
        </div>
        <div className="relative h-[220px] overflow-hidden">
          <div
            className="absolute left-0 right-0 h-[40px] border-y border-aldi-muted-light bg-aldi-muted-light/20"
            style={HIGHLIGHT_STYLE}
            aria-hidden
          />
          <div
            ref={scrollRef}
            className="h-full w-full overflow-y-auto overflow-x-hidden overscroll-contain [&::-webkit-scrollbar]:hidden"
            style={{
              scrollSnapType: "y mandatory",
              paddingTop: PADDING_Y,
              paddingBottom: PADDING_Y,
              touchAction: "pan-y",
            }}
            onScroll={handleScroll}
          >
            {items.map((q) => (
              <button
                key={q}
                type="button"
                className="flex h-10 w-full flex-shrink-0 items-center justify-center text-lg font-medium text-aldi-text transition-colors hover:bg-aldi-muted-light/30"
                style={SNAP_ALIGN_STYLE}
                onClick={() => handleSelect(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
