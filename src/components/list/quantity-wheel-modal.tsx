"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN = 1;
const MAX = 99;
const ITEM_HEIGHT = 40;
const PADDING_Y = 90;

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
  const clampedValue = Math.max(MIN, Math.min(MAX, value));
  const [selected, setSelected] = useState(clampedValue);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(clampedValue);
  }, [open, clampedValue]);

  // Scroll so setzen, dass die gewählte Zahl in der Mitte des Highlight-Streifens liegt (nicht am oberen Rand)
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

  // Aus scrollTop die Menge lesen: Mitte des Viewports (110px) = Mitte des aktuellen Items
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / ITEM_HEIGHT);
    const q = Math.max(MIN, Math.min(MAX, MIN + index));
    setSelected(q);
  };

  const handleSelect = (q: number) => {
    onSelect(q);
    onClose();
  };

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScrollDebounced = () => {
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
    };
  }, []);

  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef<number>(0);

  // Body-Scroll sperren und Touch auf Overlay mit passive: false blockieren (damit preventDefault wirkt)
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
        className="fixed inset-0 z-40 bg-black/40"
        style={{ touchAction: "none" }}
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Menge auswählen"
        style={{ touchAction: "manipulation" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <span className="text-sm font-medium text-aldi-muted">Menge</span>
          <button
            type="button"
            className="touch-target rounded-lg px-3 py-1.5 text-sm font-semibold text-aldi-blue"
            onClick={() => handleSelect(selected)}
          >
            Fertig
          </button>
        </div>
        <div className="relative h-[220px] overflow-hidden">
          <div
            className="absolute left-0 right-0 h-[40px] border-y border-aldi-muted-light bg-aldi-muted-light/20"
            style={{ top: "50%", transform: "translateY(-50%)" }}
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
            onScroll={() => {
              handleScroll();
              handleScrollDebounced();
            }}
          >
            {items.map((q) => (
              <button
                key={q}
                type="button"
                className="flex h-10 w-full flex-shrink-0 items-center justify-center text-lg font-medium text-aldi-text transition-colors hover:bg-aldi-muted-light/30"
                style={{ scrollSnapAlign: "center" }}
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
