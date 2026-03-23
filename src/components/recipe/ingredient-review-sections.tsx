"use client";

import type { Dispatch, SetStateAction } from "react";
import type { MatchIngredientsGrouped, PantryCheckResult } from "@/lib/recipe/types";
import {
  makePantryRowKey,
  type OpenedPackReviewState,
  type SubstituteReviewState,
} from "@/lib/recipe/ingredient-review-confirm";
import { IngredientRow } from "@/components/recipe/IngredientRow";

/** Minimal translator shape for `recipeImport.ingredientReview` keys. */
type IngredientReviewT = (key: string, values?: Record<string, string | number | boolean>) => string;

type PantrySectionProps = {
  t: IngredientReviewT;
  matchResults: MatchIngredientsGrouped;
  openedPack: Record<string, OpenedPackReviewState>;
  setOpenedPack: Dispatch<SetStateAction<Record<string, OpenedPackReviewState>>>;
};

export function IngredientReviewPantrySection({
  t,
  matchResults,
  openedPack,
  setOpenedPack,
}: PantrySectionProps) {
  return (
    <section role="group" aria-label={t("groupPantry")} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">{t("groupPantry")}</h3>
      {matchResults.available.map((r, i) => (
        <div key={makePantryRowKey("av", i, r)} className="animate-fade-in">
          <IngredientRow
            item={r}
            variant="available"
            footerSlot={<p className="mt-1 text-xs font-medium text-aldi-success">{t("sufficient")}</p>}
          />
        </div>
      ))}
      {matchResults.needs_confirmation.map((r, i) => {
        const k = makePantryRowKey("cf", i, r);
        const st = openedPack[k] ?? "unresolved";
        if (st === "buy") return null;
        if (st === "sufficient") {
          return (
            <div key={k} className="animate-fade-in">
              <IngredientRow
                item={r}
                variant="available"
                footerSlot={
                  <p className="mt-1 text-xs font-medium text-aldi-success">{t("sufficient")}</p>
                }
              />
            </div>
          );
        }
        return (
          <div key={k} className="animate-fade-in">
            <IngredientRow
              item={r}
              variant="needs_confirmation"
              footerSlot={<p className="mt-1 text-xs text-amber-800">{t("openedPackQuestion")}</p>}
              onAction={(action) => {
                setOpenedPack((prev) => ({
                  ...prev,
                  [k]: action === "sufficient" ? "sufficient" : "buy",
                }));
              }}
            />
          </div>
        );
      })}
    </section>
  );
}

type BuySectionProps = {
  t: IngredientReviewT;
  matchResults: MatchIngredientsGrouped;
  aldiMode: boolean;
  nerdMode: boolean;
  substitute: Record<string, SubstituteReviewState>;
  setSubstitute: Dispatch<SetStateAction<Record<string, SubstituteReviewState>>>;
  buyInclude: Record<string, boolean>;
  setBuyInclude: Dispatch<SetStateAction<Record<string, boolean>>>;
  openedPack: Record<string, OpenedPackReviewState>;
  group2HasAny: boolean;
};

export function IngredientReviewBuySection({
  t,
  matchResults,
  aldiMode,
  nerdMode,
  substitute,
  setSubstitute,
  buyInclude,
  setBuyInclude,
  openedPack,
  group2HasAny,
}: BuySectionProps) {
  const emptyBuyCopy =
    nerdMode && matchResults.available.length > 0 && !group2HasAny
      ? t("groupBuyAllPantry")
      : t("groupBuyEmpty");

  return (
    <section role="group" aria-label={t("groupBuy")} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">{t("groupBuy")}</h3>
      {!group2HasAny && (
        <p className="text-sm text-aldi-muted" role="status">
          {emptyBuyCopy}
        </p>
      )}
      {matchResults.to_buy.map((r, i) => {
        const k = makePantryRowKey("buy", i, r);
        if (r.is_substitute && substitute[k] === "original") {
          return null;
        }
        if (r.is_substitute) {
          return (
            <div key={k} className="animate-fade-in">
              <IngredientRow
                item={r}
                variant="buy"
                footerSlot={
                  <p className="mt-1 text-xs italic text-aldi-text-secondary">
                    {aldiMode ? t("substituteNoteAldi") : t("substituteNoteGeneric")}
                  </p>
                }
                rightSlot={
                  <div className="flex max-w-[220px] flex-col gap-2 sm:max-w-none sm:flex-row">
                    <button
                      type="button"
                      className="min-h-touch rounded-lg border-2 border-aldi-success bg-white px-3 py-2 text-xs font-semibold text-aldi-success"
                      onClick={() => setSubstitute((prev) => ({ ...prev, [k]: "aldi" }))}
                      aria-label={t("acceptSubstituteAria")}
                    >
                      {t("acceptSubstitute")}
                    </button>
                    <button
                      type="button"
                      className="min-h-touch rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-aldi-text"
                      onClick={() => setSubstitute((prev) => ({ ...prev, [k]: "original" }))}
                      aria-label={t("keepOriginalAria")}
                    >
                      {t("keepOriginal")}
                    </button>
                  </div>
                }
              />
            </div>
          );
        }
        return (
          <div key={k} className="animate-fade-in">
            <IngredientRow
              item={r}
              variant="buy"
              footerSlot={<p className="mt-1 text-xs text-aldi-muted">{t("autoMatched")}</p>}
              showToggle
              toggleChecked={buyInclude[k] !== false}
              onToggleChange={(checked) => setBuyInclude((prev) => ({ ...prev, [k]: checked }))}
            />
          </div>
        );
      })}
      {matchResults.needs_confirmation.map((r, i) => {
        const k = makePantryRowKey("cf", i, r);
        if (openedPack[k] !== "buy") return null;
        return (
          <div key={`${k}-buy`} className="animate-fade-in">
            <IngredientRow
              item={r}
              variant="buy"
              footerSlot={<p className="mt-1 text-xs text-aldi-muted">{t("rebuyFromPantry")}</p>}
            />
          </div>
        );
      })}
    </section>
  );
}

type UnavailSectionProps = {
  t: IngredientReviewT;
  matchResults: MatchIngredientsGrouped;
  group3Items: { row: PantryCheckResult; key: string }[];
  setSubstitute: Dispatch<SetStateAction<Record<string, SubstituteReviewState>>>;
  unavailableFreeText: Record<string, boolean>;
  setUnavailableFreeText: Dispatch<SetStateAction<Record<string, boolean>>>;
};

export function IngredientReviewUnavailableSection({
  t,
  matchResults,
  group3Items,
  setSubstitute,
  unavailableFreeText,
  setUnavailableFreeText,
}: UnavailSectionProps) {
  return (
    <section role="group" aria-label={t("groupUnavailable")} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-aldi-muted">
        {t("groupUnavailable")}
      </h3>
      {group3Items.map(({ row: r, key }) => (
        <div key={key} className="animate-fade-in">
          <IngredientRow
            item={r}
            variant="unavailable"
            footerSlot={<p className="mt-1 text-xs text-aldi-error">{t("buyElsewhere")}</p>}
            rightSlot={
              <div className="flex max-w-[220px] flex-col gap-2 sm:max-w-none sm:flex-row">
                <button
                  type="button"
                  className="min-h-touch rounded-lg border-2 border-aldi-success bg-white px-3 py-2 text-xs font-semibold text-aldi-success"
                  onClick={() => setSubstitute((prev) => ({ ...prev, [key]: "aldi" }))}
                  aria-label={t("acceptSubstituteAria")}
                >
                  {t("acceptSubstitute")}
                </button>
                <button
                  type="button"
                  className="min-h-touch rounded-lg border-2 border-aldi-orange bg-white px-3 py-2 text-xs font-semibold text-aldi-orange"
                  aria-pressed="true"
                  aria-label={t("keepOriginalAria")}
                >
                  {t("keepOriginal")}
                </button>
              </div>
            }
          />
        </div>
      ))}
      {matchResults.unavailable.map((r, i) => {
        const k = makePantryRowKey("un", i, r);
        return (
          <div key={k} className="animate-fade-in">
            <IngredientRow
              item={r}
              variant="unavailable"
              footerSlot={
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-xs text-aldi-error">{t("buyElsewhere")}</p>
                  <label className="flex min-h-touch cursor-pointer items-center gap-2 text-sm text-aldi-text">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-gray-300 text-aldi-blue focus:ring-aldi-blue"
                      checked={unavailableFreeText[k] === true}
                      onChange={(e) =>
                        setUnavailableFreeText((prev) => ({
                          ...prev,
                          [k]: e.target.checked,
                        }))
                      }
                      aria-label={t("freeTextListAria")}
                    />
                    <span>{t("addAsFreeText")}</span>
                  </label>
                </div>
              }
            />
          </div>
        );
      })}
    </section>
  );
}
