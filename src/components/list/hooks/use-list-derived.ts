"use client";

import { useMemo, useCallback } from "react";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { CompetitorProduct } from "@/types";

export function groupByKey<T>(items: T[], keyFn: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function useListDerived(
  unchecked: ListItemWithMeta[],
  deferred: ListItemWithMeta[],
  competitorProducts: CompetitorProduct[],
  locale: string,
  tDeferredNextTrip: string,
) {
  const uncheckedSorted = useMemo(
    () => [...unchecked].sort((a, b) => a.sort_position - b.sort_position), [unchecked]);

  const deferredRegular = useMemo(
    () => deferred.filter(i => i.deferred_reason !== "elsewhere"), [deferred]);

  const deferredElsewhere = useMemo(
    () => deferred.filter(i => i.deferred_reason === "elsewhere").map(item => {
      if (!item.competitor_product_id) return item;
      const cp = competitorProducts.find(p => p.product_id === item.competitor_product_id);
      if (!cp) return item;
      return { ...item, display_name: cp.name,
        ...(cp.thumbnail_url ? { competitor_thumbnail_url: cp.thumbnail_url } : {}),
        ...(cp.brand ? { competitor_brand: cp.brand } : {}),
      };
    }), [deferred, competitorProducts]);

  const deferredByDate = useMemo(
    () => groupByKey(deferredRegular, i => i.available_from ?? "unknown"), [deferredRegular]);

  const elsewhereByRetailer = useMemo(
    () => groupByKey(deferredElsewhere, i => i.buy_elsewhere_retailer ?? "?"), [deferredElsewhere]);

  const formatDeferredDate = useCallback((dateStr: string) => {
    if (dateStr === "unknown") return "";
    if (dateStr === "next_trip") return tDeferredNextTrip;
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
      weekday: "short", day: "2-digit", month: "2-digit",
    });
  }, [locale, tDeferredNextTrip]);

  return { uncheckedSorted, deferredByDate, elsewhereByRetailer, formatDeferredDate };
}
