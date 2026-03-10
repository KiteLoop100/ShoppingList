"use client";

import { useTranslations } from "next-intl";
import { SECTION_ICONS, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";

export type InventoryFilter = "all" | "opened" | CategoryGroupKey;

const SECTION_LABEL_KEYS: Record<CategoryGroupKey, string> = {
  produce: "sectionProduce",
  chilled: "sectionChilled",
  frozen: "sectionFrozen",
  dry: "sectionDry",
};

interface InventoryFiltersProps {
  active: InventoryFilter;
  onChange: (filter: InventoryFilter) => void;
  openedCount: number;
  categoryChips: { code: CategoryGroupKey; count: number }[];
}

export function InventoryFilters({
  active,
  onChange,
  openedCount,
  categoryChips,
}: InventoryFiltersProps) {
  const t = useTranslations("inventory");

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
          active === "all"
            ? "bg-aldi-blue text-white"
            : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        }`}
      >
        {t("filterAll")}
      </button>
      {openedCount > 0 && (
        <button
          type="button"
          onClick={() => onChange("opened")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            active === "opened"
              ? "bg-aldi-orange text-white"
              : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          }`}
        >
          {t("filterOpened")}
          <span className="ml-1 opacity-60">{openedCount}</span>
        </button>
      )}
      {categoryChips.map((chip) => (
        <button
          key={chip.code}
          type="button"
          onClick={() => onChange(chip.code)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            active === chip.code
              ? "bg-aldi-blue text-white"
              : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          }`}
        >
          <span className="mr-1">{SECTION_ICONS[chip.code]}</span>
          {t(SECTION_LABEL_KEYS[chip.code])}
          <span className="ml-1 opacity-60">{chip.count}</span>
        </button>
      ))}
    </div>
  );
}
