"use client";

import { useCallback, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { buildManualExtractedRecipe } from "@/lib/recipe/build-manual-extracted";
import { MANUAL_INGREDIENT_UNITS, MAX_SERVINGS, MIN_SERVINGS } from "@/lib/recipe/constants";
import type { ExtractedRecipe } from "@/lib/recipe/types";

type Row = {
  id: string;
  name: string;
  amountRaw: string;
  unit: string;
};

function newRow(): Row {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    amountRaw: "",
    unit: "g",
  };
}

type ManualRecipeEntryProps = {
  onSubmit: (recipe: ExtractedRecipe) => void;
};

export function ManualRecipeEntry({ onSubmit }: ManualRecipeEntryProps) {
  const t = useTranslations("recipeImport");
  const baseId = useId();
  const [title, setTitle] = useState("");
  const [servings, setServings] = useState(4);
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [touched, setTouched] = useState(false);

  const addRow = useCallback(() => {
    setRows((r) => [...r, newRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== id)));
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<Pick<Row, "name" | "amountRaw" | "unit">>) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const parseAmount = (raw: string): number | null => {
    const s = raw.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = useCallback(() => {
    setTouched(true);
    const recipe = buildManualExtractedRecipe({
      title,
      servings,
      rows: rows.map((r) => ({
        name: r.name,
        amount: parseAmount(r.amountRaw),
        unit: r.unit.trim() || null,
      })),
    });
    if (recipe) onSubmit(recipe);
  }, [title, servings, rows, onSubmit]);

  const titleInvalid = touched && !title.trim();
  const ingredientsInvalid = touched && rows.every((r) => !r.name.trim());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-aldi-text">{t("manualFormTitle")}</h2>
        <p className="mt-1 text-sm text-aldi-muted">{t("manualFormSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${baseId}-title`} className="text-sm font-medium text-aldi-text">
          {t("manualRecipeName")}
        </label>
        <input
          id={`${baseId}-title`}
          type="text"
          autoComplete="off"
          placeholder={t("manualRecipeNamePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
          className="min-h-[48px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] text-aldi-text shadow-sm outline-none ring-aldi-blue focus:border-aldi-blue focus:ring-2 focus:ring-aldi-blue/20"
        />
        {titleInvalid && <p className="text-sm text-red-600">{t("manualRecipeNameRequired")}</p>}
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
            disabled={servings <= MIN_SERVINGS}
            onClick={() => setServings((s) => Math.max(MIN_SERVINGS, s - 1))}
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
            disabled={servings >= MAX_SERVINGS}
            onClick={() => setServings((s) => Math.min(MAX_SERVINGS, s + 1))}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-lg font-semibold text-aldi-text disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <div role="group" aria-label={t("manualIngredientsGroup")} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-aldi-text">{t("manualIngredientsGroup")}</h3>
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div className="min-w-0 flex-1 sm:max-w-[6rem]">
              <label className="sr-only" htmlFor={`${baseId}-amt-${row.id}`}>
                {t("manualAmountLabel")}
              </label>
              <input
                id={`${baseId}-amt-${row.id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("manualAmountPlaceholder")}
                value={row.amountRaw}
                onChange={(e) => updateRow(row.id, { amountRaw: e.target.value })}
                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[15px] text-aldi-text"
              />
            </div>
            <div className="min-w-0 sm:w-[7.5rem]">
              <label className="sr-only" htmlFor={`${baseId}-unit-${row.id}`}>
                {t("manualUnitLabel")}
              </label>
              <select
                id={`${baseId}-unit-${row.id}`}
                value={row.unit}
                onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[15px] text-aldi-text"
              >
                {MANUAL_INGREDIENT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 sm:min-w-[8rem]">
              <label className="sr-only" htmlFor={`${baseId}-name-${row.id}`}>
                {t("manualIngredientNameLabel")}
              </label>
              <input
                id={`${baseId}-name-${row.id}`}
                type="text"
                autoComplete="off"
                placeholder={t("manualIngredientPlaceholder")}
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[15px] text-aldi-text"
              />
            </div>
            <div className="flex shrink-0 justify-end sm:pb-0.5">
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={rows.length <= 1}
                className="min-h-touch min-w-touch rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-aldi-text disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={t("manualRemoveRow", { index: index + 1 })}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {ingredientsInvalid && (
          <p className="text-sm text-red-600">{t("manualIngredientsRequired")}</p>
        )}
        <button
          type="button"
          onClick={addRow}
          className="min-h-[44px] max-w-sm rounded-xl border border-dashed border-aldi-blue/40 bg-aldi-blue-light/20 px-4 py-2 text-sm font-semibold text-aldi-blue"
        >
          {t("manualAddIngredient")}
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-aldi-orange px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.99]"
      >
        {t("checkIngredients")}
      </button>
    </div>
  );
}
