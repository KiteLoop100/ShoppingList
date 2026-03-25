"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { scaleIngredients } from "@/lib/recipe/servings-scaler";
import type { SavedRecipe } from "@/lib/recipe/types";

function formatIngredientLine(ing: {
  name: string;
  amount: number | null;
  unit: string | null;
}): string {
  if (ing.amount == null) return ing.name;
  const u = ing.unit?.trim() ? ` ${ing.unit}` : "";
  return `${ing.name}, ${ing.amount}${u}`;
}

type SavedRecipeAiOverlayProps = {
  recipe: SavedRecipe;
  onClose: () => void;
};

export function SavedRecipeAiOverlay({ recipe, onClose }: SavedRecipeAiOverlayProps) {
  const t = useTranslations("savedRecipes");
  const [servings, setServings] = useState(() =>
    Math.min(12, Math.max(1, recipe.original_servings)),
  );

  const scaledIngredients = useMemo(
    () => scaleIngredients(recipe.ingredients, recipe.original_servings, servings),
    [recipe.ingredients, recipe.original_servings, servings],
  );

  const stepServings = (delta: number) => {
    setServings((s) => Math.min(12, Math.max(1, s + delta)));
  };

  const timeLine =
    recipe.cook_time_minutes != null || recipe.prep_time_minutes != null
      ? [
          recipe.prep_time_minutes != null
            ? t("prepTimeShort", { min: recipe.prep_time_minutes })
            : null,
          recipe.cook_time_minutes != null
            ? t("cookTimeShort", { min: recipe.cook_time_minutes })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="pr-2 text-lg font-semibold text-aldi-text">{t("detailTitle")}</h2>
        <button
          type="button"
          onClick={onClose}
          className="touch-target shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-aldi-blue"
        >
          {t("close")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-aldi-blue/10 px-2.5 py-0.5 text-xs font-semibold text-aldi-blue">
            {t("source_ai_cook")}
          </span>
          {recipe.aldi_adapted && (
            <span className="inline-flex rounded-full bg-aldi-orange/15 px-2.5 py-0.5 text-xs font-semibold text-aldi-orange">
              {t("aldi_adapted_badge")}
            </span>
          )}
        </div>

        <h3 className="mt-3 text-2xl font-bold leading-tight text-aldi-text">{recipe.title}</h3>

        <p className="mt-2 text-sm text-aldi-muted">
          {timeLine ? (
            <>
              <span>{timeLine}</span>
              <span aria-hidden> · </span>
            </>
          ) : null}
          <span>
            🍽 {servings} {recipe.servings_label}
          </span>
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm font-medium text-aldi-text">{t("servingsLabel")}</span>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-aldi-bg px-2 py-1">
            <button
              type="button"
              className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold text-aldi-blue disabled:opacity-30"
              onClick={() => stepServings(-1)}
              disabled={servings <= 1}
              aria-label={t("decreaseServings")}
            >
              −
            </button>
            <span className="min-w-[2rem] text-center text-lg font-semibold">{servings}</span>
            <button
              type="button"
              className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-lg font-semibold text-aldi-blue disabled:opacity-30"
              onClick={() => stepServings(1)}
              disabled={servings >= 12}
              aria-label={t("increaseServings")}
            >
              +
            </button>
          </div>
        </div>

        <section className="mt-8">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("ingredientsSection")}
          </h4>
          <ul className="mt-3 space-y-2">
            {scaledIngredients.map((ing, i) => (
              <li key={i} className="text-sm text-aldi-text">
                {formatIngredientLine(ing)}
              </li>
            ))}
          </ul>
        </section>

        {recipe.instructions && recipe.instructions.length > 0 ? (
          <section className="mt-8">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">{t("stepsSection")}</h4>
            <ol className="mt-4 space-y-4">
              {recipe.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-3 rounded-xl border border-gray-100 bg-aldi-bg/50 px-3 py-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aldi-blue text-lg font-bold text-white"
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-aldi-text">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-gray-200 bg-aldi-bg/50 px-3 py-2 text-xs text-aldi-muted">
            {t("stepsNotStored")}
          </p>
        )}
      </div>
    </div>
  );
}
