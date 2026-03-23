"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { addCookChatMissingIngredientsToList } from "@/lib/recipe/add-to-list";
import { scaleIngredients } from "@/lib/recipe/servings-scaler";
import type { GeneratedRecipeDetail, PantryCheckResult } from "@/lib/recipe/types";
import { getOrCreateActiveList } from "@/lib/list";

function scalePantryRowsForServings(
  matches: PantryCheckResult[],
  originalServings: number,
  targetServings: number,
): PantryCheckResult[] {
  if (originalServings <= 0 || targetServings <= 0) return matches;
  const factor = targetServings / originalServings;
  return matches.map((m) => ({
    ...m,
    quantity_to_buy:
      m.quantity_to_buy > 0 ? Math.max(1, Math.ceil(m.quantity_to_buy * factor)) : m.quantity_to_buy,
  }));
}

function formatIngredientLine(ing: { name: string; amount: number | null; unit: string | null }): string {
  if (ing.amount == null) return ing.name;
  const u = ing.unit?.trim() ? ` ${ing.unit}` : "";
  return `${ing.name}, ${ing.amount}${u}`;
}

type CookRecipeDetailProps = {
  recipe: GeneratedRecipeDetail;
  onAddMissingToList: (items: PantryCheckResult[]) => void;
  onSave: () => void;
  onClose: () => void;
};

export function CookRecipeDetail({ recipe, onAddMissingToList, onSave, onClose }: CookRecipeDetailProps) {
  const t = useTranslations("cookChat");
  const [servings, setServings] = useState(() => Math.min(12, Math.max(1, recipe.servings)));
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scaledIngredients = useMemo(
    () => scaleIngredients(recipe.ingredients, recipe.servings, servings),
    [recipe.ingredients, recipe.servings, servings],
  );

  const formatRowIngredient = useCallback(
    (row: PantryCheckResult) =>
      formatIngredientLine(scaleIngredients([row.ingredient], recipe.servings, servings)[0]),
    [recipe.servings, servings],
  );

  const scaledMatches = useMemo(
    () => scalePantryRowsForServings(recipe.pantry_matches, recipe.servings, servings),
    [recipe.pantry_matches, recipe.servings, servings],
  );

  const missingRows = useMemo(
    () => scaledMatches.filter((r) => r.quantity_to_buy > 0),
    [scaledMatches],
  );

  const availableRows = useMemo(
    () => scaledMatches.filter((r) => r.quantity_to_buy <= 0),
    [scaledMatches],
  );

  const handleAddMissing = useCallback(async () => {
    try {
      const list = await getOrCreateActiveList();
      const result = await addCookChatMissingIngredientsToList(missingRows, list.list_id);
      const n = result.added_count + result.increased_count;
      setToast(t("missingIngredientsAdded", { count: n }));
      onAddMissingToList(missingRows);
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      console.error("[CookRecipeDetail] add to list:", e);
      setToast(t("addToListError"));
      setTimeout(() => setToast(null), 4000);
    }
  }, [missingRows, onAddMissingToList, t]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/recipe/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: recipe.title,
          source_url: null,
          source_name: t("aiSourceName"),
          source_type: "ai_cook",
          original_servings: recipe.servings,
          servings_label: t("servingsLabel"),
          ingredients: recipe.ingredients,
          prep_time_minutes: null,
          cook_time_minutes: recipe.time_minutes,
          difficulty: null,
          aldi_adapted: true,
        }),
      });
      if (!res.ok) {
        throw new Error("save failed");
      }
      setToast(t("recipeSaved"));
      onSave();
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      console.error("[CookRecipeDetail] save:", e);
      setToast(t("saveError"));
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [onSave, recipe.ingredients, recipe.servings, recipe.time_minutes, recipe.title, t]);

  const stepServings = (delta: number) => {
    setServings((s) => Math.min(12, Math.max(1, s + delta)));
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 id="cook-recipe-detail-title" className="pr-2 text-lg font-semibold text-aldi-text">
          {t("recipeDetailTitle")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="touch-target shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-aldi-blue"
        >
          {t("close")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-4">
        <h3 className="text-2xl font-bold leading-tight text-aldi-text">{recipe.title}</h3>
        <p className="mt-2 text-sm text-aldi-muted">
          ⏱ {recipe.time_minutes} {t("minutesShort")} · 🍽 {servings} {t("servingsLabelShort")}
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
          <h4 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">{t("ingredientsSection")}</h4>
          {availableRows.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-green-800">✅ {t("pantryAvailable")}</p>
              <ul className="mt-2 space-y-2">
                {availableRows.map((row, i) => (
                  <li key={`a-${i}`} className="text-sm text-aldi-text">
                    {formatRowIngredient(row)}
                    {row.aldi_product && (
                      <span className="mt-0.5 block text-xs text-aldi-muted">
                        {t("aldiProductLine", { name: row.aldi_product.name })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingRows.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-aldi-orange">🛒 {t("pantryMissing")}</p>
              <ul className="mt-2 space-y-2">
                {missingRows.map((row, i) => (
                  <li key={`m-${i}`} className="text-sm text-aldi-text">
                    {formatRowIngredient(row)}
                    {row.aldi_product && (
                      <span className="mt-0.5 block text-xs text-aldi-muted">
                        {t("aldiProductLine", { name: row.aldi_product.name })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scaledMatches.length === 0 && (
            <ul className="mt-3 space-y-1">
              {scaledIngredients.map((ing, i) => (
                <li key={i} className="text-sm text-aldi-text">
                  {formatIngredientLine(ing)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">{t("stepsSection")}</h4>
          <ol className="mt-4 space-y-4">
            {recipe.steps.map((step, idx) => (
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
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[70] max-w-sm -translate-x-1/2 rounded-xl bg-aldi-text px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div
        className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {missingRows.length > 0 && (
            <button
              type="button"
              onClick={() => void handleAddMissing()}
              className="touch-target flex min-h-[48px] w-full items-center justify-center rounded-xl bg-aldi-orange px-4 text-sm font-semibold text-white"
            >
              {t("addMissingToList")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="touch-target flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-aldi-blue bg-white px-4 text-sm font-semibold text-aldi-blue disabled:opacity-50"
          >
            {saving ? t("saving") : t("saveRecipe")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="touch-target min-h-[44px] w-full rounded-xl py-2 text-sm font-medium text-aldi-muted"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
