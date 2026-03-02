"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const MD_QUERY = "(min-width: 768px)";
const LG_QUERY = "(min-width: 1024px)";

function getBreakpoint(): Breakpoint {
  if (window.matchMedia(LG_QUERY).matches) return "desktop";
  if (window.matchMedia(MD_QUERY).matches) return "tablet";
  return "mobile";
}

/**
 * Returns the current breakpoint ("mobile" | "tablet" | "desktop").
 * Always returns "mobile" on the initial server/hydration render to
 * avoid hydration mismatches, then updates via useEffect.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>("mobile");

  useEffect(() => {
    setBp(getBreakpoint());

    const lgMql = window.matchMedia(LG_QUERY);
    const mdMql = window.matchMedia(MD_QUERY);

    const update = () => setBp(getBreakpoint());

    lgMql.addEventListener("change", update);
    mdMql.addEventListener("change", update);
    return () => {
      lgMql.removeEventListener("change", update);
      mdMql.removeEventListener("change", update);
    };
  }, []);

  return bp;
}
