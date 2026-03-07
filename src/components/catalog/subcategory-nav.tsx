"use client";

import { useTranslations, useLocale } from "next-intl";
import type { DemandGroupRow } from "@/lib/categories/category-service";

interface SubcategoryNavProps {
  groups: DemandGroupRow[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  variant: "sidebar" | "chips";
}

export function SubcategoryNav({ groups, selected, onSelect, variant }: SubcategoryNavProps) {
  const t = useTranslations("catalog");
  const locale = useLocale();

  const getLabel = (g: DemandGroupRow) =>
    locale === "en" && g.name_en ? g.name_en : g.name;

  if (variant === "sidebar") {
    return (
      <nav className="w-48 shrink-0 overflow-y-auto border-r border-aldi-muted-light bg-white py-2">
        <button
          onClick={() => onSelect(null)}
          className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
            selected === null
              ? "bg-aldi-blue/10 text-aldi-blue"
              : "text-aldi-text hover:bg-gray-50"
          }`}
        >
          {t("all")}
        </button>
        {groups.map((g) => (
          <button
            key={g.code}
            onClick={() => onSelect(g.code)}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
              selected === g.code
                ? "bg-aldi-blue/10 font-medium text-aldi-blue"
                : "text-aldi-text hover:bg-gray-50"
            }`}
          >
            {getLabel(g)}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <div className="sticky top-0 z-10 flex shrink-0 gap-1.5 overflow-x-auto bg-white px-4 py-2 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
          selected === null
            ? "bg-aldi-blue text-white"
            : "bg-gray-100 text-aldi-text hover:bg-gray-200"
        }`}
      >
        {t("all")}
      </button>
      {groups.map((g) => (
        <button
          key={g.code}
          onClick={() => onSelect(g.code)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
            selected === g.code
              ? "bg-aldi-blue text-white"
              : "bg-gray-100 text-aldi-text hover:bg-gray-200"
          }`}
        >
          {getLabel(g)}
        </button>
      ))}
    </div>
  );
}
