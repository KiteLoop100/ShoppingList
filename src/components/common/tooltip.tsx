"use client";

import { useState, useRef, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom";
}

/**
 * Simple tooltip that appears on hover for pointer:fine devices.
 * Hidden on touch devices to avoid sticky tooltips.
 */
export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 400);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  };

  const posClass = position === "bottom"
    ? "top-full mt-1.5"
    : "bottom-full mb-1.5";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          className={`pointer-coarse:hidden absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-aldi-text px-2 py-1 text-[11px] font-medium text-white shadow-lg ${posClass}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}
