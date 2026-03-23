"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { MatchIngredientsGrouped, PantryCheckResult } from "@/lib/recipe/types";
import {
  buildReviewConfirmItems,
  countShoppingListPreview,
  hasUnresolvedOpenedPacks,
  makePantryRowKey,
  type OpenedPackReviewState,
  type SubstituteReviewState,
} from "@/lib/recipe/ingredient-review-confirm";
import {
  IngredientReviewBuySection,
  IngredientReviewPantrySection,
  IngredientReviewUnavailableSection,
} from "@/components/recipe/ingredient-review-sections";

export type IngredientReviewProps = {
  matchResults: MatchIngredientsGrouped;
  servings: number;
  aldiMode: boolean;
  /** When true, show pantry groups (Vorrätig / opened-pack checks). */
  nerdMode: boolean;
  onConfirm: (selectedItems: PantryCheckResult[]) => void | Promise<void>;
  onBack: () => void;
};

function initOpenedPackState(needs_confirmation: PantryCheckResult[]): Record<string, OpenedPackReviewState> {
  const o: Record<string, OpenedPackReviewState> = {};
  for (let i = 0; i < needs_confirmation.length; i++) {
    o[makePantryRowKey("cf", i, needs_confirmation[i])] = "unresolved";
  }
  return o;
}

function initSubstituteState(to_buy: PantryCheckResult[]): Record<string, SubstituteReviewState> {
  const s: Record<string, SubstituteReviewState> = {};
  for (let i = 0; i < to_buy.length; i++) {
    const r = to_buy[i];
    if (r.is_substitute) {
      s[makePantryRowKey("buy", i, r)] = "aldi";
    }
  }
  return s;
}

function initBuyInclude(to_buy: PantryCheckResult[]): Record<string, boolean> {
  const b: Record<string, boolean> = {};
  for (let i = 0; i < to_buy.length; i++) {
    const r = to_buy[i];
    if (!r.is_substitute) {
      b[makePantryRowKey("buy", i, r)] = true;
    }
  }
  return b;
}

export function IngredientReview({
  matchResults,
  servings,
  aldiMode,
  nerdMode,
  onConfirm,
  onBack,
}: IngredientReviewProps) {
  const t = useTranslations("recipeImport.ingredientReview");
  const tFlow = useTranslations("recipeImport");

  const [openedPack, setOpenedPack] = useState(() => initOpenedPackState(matchResults.needs_confirmation));
  const [substitute, setSubstitute] = useState(() => initSubstituteState(matchResults.to_buy));
  const [buyInclude, setBuyInclude] = useState(() => initBuyInclude(matchResults.to_buy));
  const [unavailableFreeText, setUnavailableFreeText] = useState<Record<string, boolean>>({});

  const listCount = useMemo(
    () =>
      countShoppingListPreview(matchResults, openedPack, substitute, buyInclude, unavailableFreeText),
    [matchResults, openedPack, substitute, buyInclude, unavailableFreeText],
  );

  const confirmBlocked = hasUnresolvedOpenedPacks(matchResults.needs_confirmation, openedPack);

  const handleConfirm = useCallback(async () => {
    await onConfirm(
      buildReviewConfirmItems(matchResults, openedPack, substitute, buyInclude, unavailableFreeText),
    );
  }, [matchResults, openedPack, substitute, buyInclude, unavailableFreeText, onConfirm]);

  const group1Visible =
    nerdMode &&
    (matchResults.available.length > 0 ||
      matchResults.needs_confirmation.some((r, i) => {
        const k = makePantryRowKey("cf", i, r);
        return openedPack[k] !== "buy";
      }));

  const group3Items = useMemo(() => {
    const fromBuy: { row: PantryCheckResult; key: string }[] = [];
    for (let i = 0; i < matchResults.to_buy.length; i++) {
      const r = matchResults.to_buy[i];
      const k = makePantryRowKey("buy", i, r);
      if (r.is_substitute && substitute[k] === "original") {
        fromBuy.push({ row: r, key: k });
      }
    }
    return fromBuy;
  }, [matchResults.to_buy, substitute]);

  const group3HasEntries =
    matchResults.unavailable.length > 0 || group3Items.length > 0;

  const group2HasAny = useMemo(() => {
    const hasBuy = matchResults.to_buy.some((r, i) => {
      const k = makePantryRowKey("buy", i, r);
      if (r.is_substitute && substitute[k] === "original") return false;
      return true;
    });
    const hasCfBuy = matchResults.needs_confirmation.some((r, i) => {
      const k = makePantryRowKey("cf", i, r);
      return openedPack[k] === "buy";
    });
    return hasBuy || hasCfBuy;
  }, [matchResults.to_buy, matchResults.needs_confirmation, substitute, openedPack]);

  return (
    <div className="flex max-h-[calc(100dvh-9rem)] flex-col gap-0">
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-touch rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-aldi-text"
          aria-label={tFlow("back")}
        >
          {tFlow("back")}
        </button>
        <h2 className="text-lg font-semibold text-aldi-text">{tFlow("step3Title", { count: servings })}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className="flex flex-col gap-6 pb-4">
          {group1Visible && (
            <IngredientReviewPantrySection
              t={t}
              matchResults={matchResults}
              openedPack={openedPack}
              setOpenedPack={setOpenedPack}
            />
          )}

          <IngredientReviewBuySection
            t={t}
            matchResults={matchResults}
            aldiMode={aldiMode}
            nerdMode={nerdMode}
            substitute={substitute}
            setSubstitute={setSubstitute}
            buyInclude={buyInclude}
            setBuyInclude={setBuyInclude}
            openedPack={openedPack}
            group2HasAny={group2HasAny}
          />

          {group3HasEntries && (
            <IngredientReviewUnavailableSection
              t={t}
              matchResults={matchResults}
              group3Items={group3Items}
              setSubstitute={setSubstitute}
              unavailableFreeText={unavailableFreeText}
              setUnavailableFreeText={setUnavailableFreeText}
            />
          )}
        </div>
      </div>

      <footer
        className="shrink-0 border-t border-gray-200 bg-white/95 px-1 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <p className="mb-2 text-center text-sm text-aldi-text">
          {t("summaryLine", { count: listCount })}
        </p>
        {confirmBlocked && (
          <p className="mb-2 text-center text-xs text-amber-800" role="status">
            {t("confirmOpenedFirst")}
          </p>
        )}
        <button
          type="button"
          disabled={confirmBlocked}
          onClick={handleConfirm}
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-aldi-orange px-4 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t("addToListAria", { count: listCount })}
        >
          {t("addToList", { count: listCount })}
        </button>
      </footer>
    </div>
  );
}
