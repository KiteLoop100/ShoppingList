"use client";

import { useEffect, useRef, useState } from "react";

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

  // When modal opens, sync selected to current value
  useEffect(() => {
    if (!open) return;
    setSelected(clampedValue);
  }, [open, clampedValue]);

  // After open (and ref attach), scroll to current value
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const index = clampedValue - MIN;
    scrollRef.current.scrollTop = PADDING_Y + index * ITEM_HEIGHT;
  }, [open, clampedValue]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const contentY = el.scrollTop - PADDING_Y;
    const index = Math.round(contentY / ITEM_HEIGHT);
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
      const contentY = el.scrollTop - PADDING_Y;
      const index = Math.round(contentY / ITEM_HEIGHT);
      const q = Math.max(MIN, Math.min(MAX, MIN + index));
      setSelected(q);
      el.scrollTo({ top: PADDING_Y + (q - MIN) * ITEM_HEIGHT, behavior: "smooth" });
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Lock body scroll when modal is open so the list underneath doesn't scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const items = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-white shadow-lg transition-transform"
        role="dialog"
        aria-modal="true"
        aria-label="Menge auswählen"
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
        <div className="relative flex h-[220px] items-center overflow-hidden">
          {/* Highlight strip */}
          <div
            className="absolute left-0 right-0 h-[40px] border-y border-aldi-muted-light bg-aldi-muted-light/20"
            style={{ top: "50%", transform: "translateY(-50%)" }}
            aria-hidden
          />
          <div
            ref={scrollRef}
            className="w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth [&::-webkit-scrollbar]:hidden"
            style={{ scrollSnapType: "y mandatory", paddingTop: PADDING_Y, paddingBottom: PADDING_Y, touchAction: "pan-y" }}
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
}
