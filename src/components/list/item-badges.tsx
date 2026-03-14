"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

export interface ItemBadgesProps {
  item: ListItemWithMeta;
  isDeferred: boolean;
  isElsewhere: boolean;
  categoryLabel?: string;
}

export function ItemBadges({
  item,
  isDeferred,
  isElsewhere,
  categoryLabel,
}: ItemBadgesProps) {
  const locale = useLocale();
  const t = useTranslations("list");

  const reorderCountdownLabel = useMemo(() => {
    if (!isDeferred || item.deferred_reason !== "reorder" || !item.available_from)
      return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(item.available_from + "T00:00:00");
    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays <= 0) return null;
    if (diffDays <= 14) {
      return locale === "de"
        ? `in ${diffDays} Tag${diffDays !== 1 ? "en" : ""}`
        : `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
    }
    const weeks = Math.ceil(diffDays / 7);
    return locale === "de"
      ? `in ${weeks} Woche${weeks !== 1 ? "n" : ""}`
      : `in ${weeks} week${weeks !== 1 ? "s" : ""}`;
  }, [isDeferred, item.deferred_reason, item.available_from, locale]);

  if (isElsewhere) {
    return item.competitor_brand ? (
      <span className="block truncate text-[11px] leading-snug text-aldi-muted">
        {item.competitor_brand}
      </span>
    ) : null;
  }

  if (isDeferred && item.deferred_reason) {
    return (
      <span
        className={`mt-0.5 inline-block truncate rounded px-1 py-0.5 text-[11px] font-medium leading-snug ${
          item.deferred_reason === "special"
            ? "bg-amber-100 text-amber-800"
            : item.deferred_reason === "manual"
              ? "bg-gray-200 text-gray-600"
              : "bg-blue-100 text-blue-700"
        }`}
      >
        {item.deferred_reason === "special"
          ? t("deferredBadgeSpecial")
          : item.deferred_reason === "manual"
            ? t("deferredBadgeManual")
            : reorderCountdownLabel
              ? `${t("deferredBadgeReorder")}: ${reorderCountdownLabel}`
              : t("deferredBadgeReorder")}
      </span>
    );
  }

  if (item.is_checked && item.is_extra_scan) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium leading-snug bg-[#F37D1E]/15 text-[#F37D1E]">
        + {t("extraBadge")}
      </span>
    );
  }

  if (categoryLabel) {
    return (
      <span className="block truncate text-[11px] leading-snug text-aldi-muted">
        {categoryLabel}
      </span>
    );
  }

  return null;
}
