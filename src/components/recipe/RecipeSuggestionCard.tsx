"use client";

import { useTranslations } from "next-intl";
import type { RecipeSuggestion } from "@/lib/recipe/types";

const NUMBER_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

type RecipeSuggestionCardProps = {
  suggestion: RecipeSuggestion;
  index: number;
  onSelect: (index: number) => void;
};

export function RecipeSuggestionCard({ suggestion, index, onSelect }: RecipeSuggestionCardProps) {
  const t = useTranslations("cookChat");
  const num = NUMBER_EMOJI[index] ?? `${index + 1}.`;
  const missingCount = suggestion.ingredients_missing.length;
  const allLines = [
    ...suggestion.ingredients_available.map((name) => ({ kind: "avail" as const, text: name })),
    ...suggestion.ingredients_missing.map((name) => ({ kind: "miss" as const, text: name })),
  ];
  const shown = allLines.slice(0, 6);
  const extra = Math.max(0, allLines.length - 6);

  return (
    <div className="mt-2 rounded-xl border border-gray-200 bg-aldi-bg/80 px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-lg leading-none" aria-hidden>
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-aldi-text">{suggestion.title}</p>
          <p className="mt-0.5 text-sm text-aldi-muted">
            ⏱ {suggestion.time_minutes} {t("minutesShort")}
          </p>
          <p>
            {suggestion.all_available ? (
              <span className="text-sm font-medium text-green-700">{t("suggestionAllAvailable")}</span>
            ) : (
              <span className="text-sm font-medium text-aldi-orange">
                {t("suggestionMissing", { count: missingCount })}
              </span>
            )}
          </p>
          <ul className="mt-2 space-y-0.5 text-sm">
            {shown.map((row, li) => (
              <li
                key={`${row.kind}-${li}-${row.text}`}
                className={row.kind === "miss" ? "text-aldi-orange" : "text-aldi-text"}
              >
                {row.kind === "avail" ? `✅ ${row.text}` : `🛒 ${row.text}`}
              </li>
            ))}
            {extra > 0 && <li className="text-aldi-muted">+{extra} {t("moreIngredients")}</li>}
          </ul>
          <button
            type="button"
            onClick={() => onSelect(index)}
            className="mt-2 w-full rounded-lg border border-aldi-blue/30 bg-white py-2 text-sm font-semibold text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          >
            {t("showRecipe")}
          </button>
        </div>
      </div>
    </div>
  );
}
