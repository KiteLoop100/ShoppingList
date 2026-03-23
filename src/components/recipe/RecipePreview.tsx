"use client";

import { useTranslations } from "next-intl";
import type { ExtractedRecipe } from "@/lib/recipe/types";
import { MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/constants";

function sourceHostLabel(url: string | null): string {
  if (url == null || !url.trim()) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

type RecipePreviewProps = {
  recipe: ExtractedRecipe;
  servings: number;
  onServingsChange: (n: number) => void;
  aldiMode: boolean;
  onAldiModeChange: (v: boolean) => void;
  onBack: () => void;
  onCheckIngredients: () => void | Promise<void>;
  matching: boolean;
};

export function RecipePreview({
  recipe,
  servings,
  onServingsChange,
  aldiMode,
  onAldiModeChange,
  onBack,
  onCheckIngredients,
  matching,
}: RecipePreviewProps) {
  const t = useTranslations("recipeImport");
  const host = sourceHostLabel(recipe.source_url);
  const hasSourceUrl = recipe.source_url != null && recipe.source_url.trim() !== "";

  const prep = recipe.prep_time_minutes;
  const cook = recipe.cook_time_minutes;
  const timeParts: string[] = [];
  if (prep != null && prep > 0) {
    timeParts.push(t("prepTime", { min: prep }));
  }
  if (cook != null && cook > 0) {
    timeParts.push(t("cookTime", { min: cook }));
  }

  const diffKey = recipe.difficulty;
  const difficultyLabel =
    diffKey === "einfach" || diffKey === "normal" || diffKey === "anspruchsvoll"
      ? t(`difficulty.${diffKey}`)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] font-bold leading-tight text-aldi-text">{recipe.title}</h2>
        <p className="mt-2 text-sm text-aldi-muted">
          {t("sourcePrefix")}{" "}
          {hasSourceUrl ? (
            <a
              href={recipe.source_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-aldi-blue underline"
            >
              {host || recipe.source_name}
            </a>
          ) : (
            <span className="font-medium text-aldi-text">{recipe.source_name}</span>
          )}
        </p>
        {timeParts.length > 0 && (
          <p className="mt-2 text-sm text-aldi-text">
            <span aria-hidden>⏱ </span>
            {timeParts.join(" · ")}
          </p>
        )}
        {difficultyLabel && (
          <p className="mt-1 text-sm text-aldi-muted">
            {t("difficultyLabel")}: {difficultyLabel}
          </p>
        )}
      </div>

      <div
        className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        role="group"
        aria-label={t("servings")}
      >
        <p className="text-sm font-medium text-aldi-text">{t("servings")}</p>
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            aria-label={t("servingsDecrease")}
            disabled={servings <= MIN_SERVINGS || matching}
            onClick={() => onServingsChange(Math.max(MIN_SERVINGS, servings - 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-lg font-semibold text-aldi-text disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-xl font-semibold tabular-nums text-aldi-text">
            {servings}
          </span>
          <button
            type="button"
            aria-label={t("servingsIncrease")}
            disabled={servings >= MAX_SERVINGS || matching}
            onClick={() => onServingsChange(Math.min(MAX_SERVINGS, servings + 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-lg font-semibold text-aldi-text disabled:opacity-40"
          >
            +
          </button>
        </div>
        <p className="mt-2 text-xs text-aldi-muted">
          {t("originalServings", { count: recipe.servings })}
        </p>
      </div>

      <div
        className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        role="radiogroup"
        aria-label={t("aldiModeTitle")}
      >
        <p className="text-sm font-medium text-aldi-text">{t("aldiModeTitle")}</p>
        <div className="mt-3 flex flex-col gap-3">
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
              !aldiMode ? "border-aldi-blue bg-aldi-blue-light/30" : "border-gray-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="aldi-mode"
              className="mt-1 h-4 w-4 border-gray-300 text-aldi-orange focus:ring-aldi-blue"
              checked={!aldiMode}
              onChange={() => onAldiModeChange(false)}
              disabled={matching}
            />
            <span>
              <span className="block text-[15px] font-medium text-aldi-text">{t("modeOriginal")}</span>
              <span className="mt-0.5 block text-xs text-aldi-muted">{t("modeOriginalHint")}</span>
            </span>
          </label>
          <label
            className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
              aldiMode ? "border-aldi-blue bg-aldi-blue-light/30" : "border-gray-200 bg-white"
            }`}
          >
            <input
              type="radio"
              name="aldi-mode"
              className="mt-1 h-4 w-4 border-gray-300 text-aldi-orange focus:ring-aldi-blue"
              checked={aldiMode}
              onChange={() => onAldiModeChange(true)}
              disabled={matching}
            />
            <span>
              <span className="block text-[15px] font-medium text-aldi-text">{t("modeAldi")}</span>
              <span className="mt-0.5 block text-xs text-aldi-muted">{t("modeAldiHint")}</span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={matching}
          className="order-2 min-h-[48px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-[15px] font-medium text-aldi-text shadow-sm sm:order-1"
        >
          {t("back")}
        </button>
        <button
          type="button"
          disabled={matching}
          onClick={() => void onCheckIngredients()}
          className="order-1 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-aldi-orange px-4 py-3 text-[15px] font-semibold text-white shadow-sm disabled:opacity-60 sm:order-2 sm:min-w-[220px]"
        >
          {matching ? (
            <>
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden
              />
              {t("matching")}
            </>
          ) : (
            t("checkIngredients")
          )}
        </button>
      </div>
    </div>
  );
}
