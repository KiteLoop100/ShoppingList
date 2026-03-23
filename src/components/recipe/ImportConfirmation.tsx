"use client";

import { useTranslations } from "next-intl";
import type { AddToListResult } from "@/lib/recipe/add-to-list";
import type { ExtractedRecipe } from "@/lib/recipe/types";

export type ImportConfirmationProps = {
  result: AddToListResult;
  recipe: ExtractedRecipe;
  recipeSaved: boolean;
  saveWarning: boolean;
  onGoToList: () => void;
  onImportAnother: () => void;
};

export function ImportConfirmation({
  result,
  recipe,
  recipeSaved,
  saveWarning,
  onGoToList,
  onImportAnother,
}: ImportConfirmationProps) {
  const t = useTranslations("recipeImport.confirmation");

  const totalLines = result.added_count + result.increased_count;

  return (
    <div className="flex flex-col items-center gap-5 px-1 text-center">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        aria-hidden
      >
        <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-aldi-muted">{recipe.title}</p>
        <p className="text-lg font-semibold text-aldi-text">
          {t("productsOnList", { count: totalLines })}
        </p>
        {result.increased_count > 0 && (
          <p className="text-sm text-aldi-muted">{t("quantitiesIncreased", { count: result.increased_count })}</p>
        )}
      </div>

      <div className="w-full max-w-sm space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-left text-sm">
        {recipeSaved && (
          <p className="flex items-start gap-2 text-aldi-text">
            <span className="mt-0.5 text-emerald-600" aria-hidden>
              ✓
            </span>
            <span>{t("recipeSaved")}</span>
          </p>
        )}
        {saveWarning && (
          <p className="text-amber-800" role="status">
            {t("saveFailed")}
          </p>
        )}
      </div>

      <div className="mt-2 flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onGoToList}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-aldi-blue px-6 py-3 text-[15px] font-semibold text-white"
        >
          {t("goToList")}
        </button>
        <button
          type="button"
          onClick={onImportAnother}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-aldi-blue bg-white px-6 py-3 text-[15px] font-semibold text-aldi-blue"
        >
          {t("importAnother")}
        </button>
      </div>
    </div>
  );
}
