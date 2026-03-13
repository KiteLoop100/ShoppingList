"use client";

import { useCallback, useRef } from "react";

/**
 * Enables Arrow Up/Down keyboard navigation within a container.
 * Moves focus between focusable children (elements with tabIndex >= 0).
 * Home/End jump to first/last item.
 */
export function useArrowNavigation() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const isArrowUp = e.key === "ArrowUp";
    const isArrowDown = e.key === "ArrowDown";
    const isHome = e.key === "Home";
    const isEnd = e.key === "End";

    if (!isArrowUp && !isArrowDown && !isHome && !isEnd) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>("[tabindex='0']"),
    );
    if (focusable.length === 0) return;

    const activeEl = document.activeElement as HTMLElement | null;
    const currentIdx = activeEl ? focusable.indexOf(activeEl) : -1;

    let nextIdx: number;
    if (isHome) {
      nextIdx = 0;
    } else if (isEnd) {
      nextIdx = focusable.length - 1;
    } else if (isArrowDown) {
      nextIdx = currentIdx < focusable.length - 1 ? currentIdx + 1 : 0;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : focusable.length - 1;
    }

    e.preventDefault();
    focusable[nextIdx]?.focus();
  }, []);

  return { containerRef, handleKeyDown };
}
