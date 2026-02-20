"use client";

import { useTranslations } from "next-intl";

export type SortMode = "my-order" | "shopping-order";

export interface SortModeTabsProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  className?: string;
}

export function SortModeTabs({ value, onChange, className = "" }: SortModeTabsProps) {
  const t = useTranslations("list");

  return (
    <div
      role="tablist"
      aria-label={t("sortModeMyOrder") + " / " + t("sortModeShoppingOrder")}
      className={`flex shrink-0 gap-0 rounded-lg border border-aldi-muted-light bg-gray-50/80 p-0.5 ${className}`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "my-order"}
        tabIndex={value === "my-order" ? 0 : -1}
        onClick={() => onChange("my-order")}
        className={`min-h-touch flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          value === "my-order"
            ? "bg-white text-aldi-blue shadow-sm"
            : "text-aldi-muted hover:text-aldi-text"
        }`}
      >
        {t("sortModeMyOrder")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "shopping-order"}
        tabIndex={value === "shopping-order" ? 0 : -1}
        onClick={() => onChange("shopping-order")}
        className={`min-h-touch flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          value === "shopping-order"
            ? "bg-white text-aldi-blue shadow-sm"
            : "text-aldi-muted hover:text-aldi-text"
        }`}
      >
        {t("sortModeShoppingOrder")}
      </button>
    </div>
  );
}
