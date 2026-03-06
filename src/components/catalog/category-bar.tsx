"use client";

import { useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import type { DemandGroupRow } from "@/lib/categories/category-service";

interface CategoryBarProps {
  categories: DemandGroupRow[];
  selected: string | null;
  onSelect: (code: string) => void;
}

export function CategoryBar({ categories, selected, onSelect }: CategoryBarProps) {
  const locale = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const chip = selectedRef.current;
      const left = chip.offsetLeft - container.offsetLeft - 16;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-aldi-muted-light bg-white px-4 py-2.5 scrollbar-hide"
    >
      {categories.map((cat) => {
        const isActive = cat.code === selected;
        const label = locale === "en" && cat.name_en ? cat.name_en : cat.name;
        return (
          <button
            key={cat.code}
            ref={isActive ? selectedRef : undefined}
            onClick={() => onSelect(cat.code)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "bg-aldi-blue text-white shadow-sm"
                : "bg-gray-100 text-aldi-text hover:bg-gray-200"
            }`}
          >
            {cat.icon && <span className="text-base">{cat.icon}</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}
