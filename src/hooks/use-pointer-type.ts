"use client";

import { useState, useEffect } from "react";

type PointerType = "fine" | "coarse";

const QUERY = "(pointer: fine)";

/**
 * Returns the current primary pointer type ("fine" for mouse/trackpad,
 * "coarse" for touch). Reacts live to changes (e.g. iPad connecting a
 * trackpad/keyboard). Always returns "coarse" on the initial
 * server/hydration render to avoid hydration mismatches.
 */
export function usePointerType(): PointerType {
  const [pointer, setPointer] = useState<PointerType>("coarse");

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setPointer(mql.matches ? "fine" : "coarse");

    const handler = (e: MediaQueryListEvent) => {
      setPointer(e.matches ? "fine" : "coarse");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return pointer;
}
