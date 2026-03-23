"use client";

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { loadSettings } from "@/lib/settings/settings-sync";
import { useCurrentCountry } from "@/lib/current-country-context";
import { addRecipeIngredientsToList, type AddToListResult } from "@/lib/recipe/add-to-list";
import { scaleIngredients } from "@/lib/recipe/servings-scaler";
import { savedRecipeToExtracted } from "@/lib/recipe/saved-recipe-mapper";
import type {
  ExtractedRecipe,
  MatchIngredientsGrouped,
  PantryCheckResult,
  SavedRecipe,
} from "@/lib/recipe/types";
import { getOrCreateActiveList } from "@/lib/list";
import { log } from "@/lib/utils/logger";
import { ManualRecipeEntry } from "@/components/recipe/ManualRecipeEntry";
import { UrlInput } from "@/components/recipe/UrlInput";
import { RecipePreview } from "@/components/recipe/RecipePreview";
import { IngredientReview } from "@/components/recipe/IngredientReview";
import { ImportConfirmation } from "@/components/recipe/ImportConfirmation";

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const t = useTranslations("recipeImport");
  const labels = [1, 2, 3, 4] as const;
  return (
    <div
      className="mb-6 flex items-center justify-center gap-0 px-2"
      role="group"
      aria-label={t("stepIndicatorLabel")}
    >
      {labels.map((n) => (
        <Fragment key={n}>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              n <= step ? "bg-aldi-blue text-white" : "bg-gray-200 text-gray-500"
            }`}
          >
            {n}
          </div>
          {n < 4 && (
            <div
              className={`mx-1 h-0.5 min-w-[12px] flex-1 rounded ${n < step ? "bg-aldi-blue" : "bg-gray-200"}`}
              aria-hidden
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

function RecipeImportFlowInner() {
  const t = useTranslations("recipeImport");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useCurrentCountry();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [step1Mode, setStep1Mode] = useState<"url" | "manual">("url");
  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [servings, setServings] = useState(4);
  const [aldiMode, setAldiMode] = useState(true);
  const [importSourceType, setImportSourceType] = useState<"url_import" | "ai_cook">("url_import");
  const [loadingSavedRecipe, setLoadingSavedRecipe] = useState(false);
  const [savedRecipeLoadError, setSavedRecipeLoadError] = useState<string | null>(null);
  const [matchGrouped, setMatchGrouped] = useState<MatchIngredientsGrouped | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [checkPantry, setCheckPantry] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const lastFailedItemsRef = useRef<PantryCheckResult[] | null>(null);
  const [addToListResult, setAddToListResult] = useState<AddToListResult | null>(null);
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => setCheckPantry(s.enable_inventory));
  }, []);

  const applySavedRecipe = useCallback((recipe: SavedRecipe) => {
    setExtractedRecipe(savedRecipeToExtracted(recipe));
    setServings(Math.max(1, Math.min(12, recipe.original_servings || 4)));
    setAldiMode(recipe.aldi_adapted);
    setImportSourceType(recipe.source_type);
    setMatchGrouped(null);
    setMatchError(null);
    setConfirmError(null);
    setAddToListResult(null);
    setRecipeSaved(false);
    setSaveWarning(false);
    setStep1Mode(recipe.source_url?.trim() ? "url" : "manual");
    setStep(2);
  }, []);

  const recipeIdFromUrl = searchParams.get("recipe_id");

  useEffect(() => {
    if (!recipeIdFromUrl) return;
    let cancelled = false;
    setLoadingSavedRecipe(true);
    setSavedRecipeLoadError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/recipe/saved?id=${encodeURIComponent(recipeIdFromUrl)}`,
        );
        const body = (await res.json()) as { recipe?: SavedRecipe; error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        if (!body.recipe) {
          throw new Error("Missing recipe");
        }
        if (cancelled) return;
        applySavedRecipe(body.recipe);
        void fetch("/api/recipe/saved", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recipeIdFromUrl }),
        }).catch((e) => {
          log.warn("[RecipeImportFlow] touch last_used_at failed:", e);
        });
        router.replace("/recipe-import");
      } catch (e) {
        if (!cancelled) {
          log.warn("[RecipeImportFlow] load saved recipe:", e);
          setSavedRecipeLoadError(t("loadSavedRecipeError"));
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedRecipe(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipeIdFromUrl, applySavedRecipe, router, t]);

  const onExtracted = useCallback((recipe: ExtractedRecipe) => {
    setExtractedRecipe(recipe);
    setServings(Math.max(1, Math.min(12, recipe.servings || 4)));
    setImportSourceType("url_import");
    setStep1Mode(recipe.source_url?.trim() ? "url" : "manual");
    setMatchGrouped(null);
    setMatchError(null);
    setConfirmError(null);
    setAddToListResult(null);
    setRecipeSaved(false);
    setSaveWarning(false);
    setStep(2);
  }, []);

  const [matchSlowHint, setMatchSlowHint] = useState(false);
  useEffect(() => {
    if (!matching) {
      setMatchSlowHint(false);
      return;
    }
    const id = window.setTimeout(() => setMatchSlowHint(true), 3000);
    return () => window.clearTimeout(id);
  }, [matching]);

  const runMatch = useCallback(async () => {
    if (!extractedRecipe) return;
    setMatching(true);
    setMatchError(null);
    const original = Math.max(1, extractedRecipe.servings || 1);
    const scaled = scaleIngredients(extractedRecipe.ingredients, original, servings);
    const countryCode = country === "AT" ? "AT" : "DE";
    try {
      const ingredientsPayload = scaled.map((i) => ({
        ...i,
        category: i.category ?? "",
      }));
      const res = await fetch("/api/recipe/match-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredientsPayload,
          aldi_mode: aldiMode,
          country: countryCode,
          check_pantry: checkPantry,
        }),
      });
      const data = (await res.json()) as MatchIngredientsGrouped & { error?: string };
      if (!res.ok) {
        setMatchError(t("matchError"));
        return;
      }
      setMatchGrouped({
        available: data.available ?? [],
        to_buy: data.to_buy ?? [],
        unavailable: data.unavailable ?? [],
        needs_confirmation: data.needs_confirmation ?? [],
      });
      setStep(3);
    } catch {
      setMatchError(t("matchError"));
    } finally {
      setMatching(false);
    }
  }, [extractedRecipe, servings, aldiMode, country, checkPantry, t]);

  const handleReviewConfirm = useCallback(
    async (items: PantryCheckResult[]) => {
      if (!extractedRecipe) return;
      setConfirming(true);
      setConfirmError(null);
      lastFailedItemsRef.current = items;
      try {
        const list = await getOrCreateActiveList();
        const original = Math.max(1, extractedRecipe.servings || 1);
        const scaledIngredients = scaleIngredients(extractedRecipe.ingredients, original, servings).map(
          (i) => ({
            ...i,
            category: i.category ?? "",
          }),
        );

        const saveBody = {
          title: extractedRecipe.title,
          source_url:
            extractedRecipe.source_url?.trim() ? extractedRecipe.source_url.trim() : null,
          source_name: extractedRecipe.source_name,
          source_type: importSourceType,
          original_servings: original,
          servings_label: extractedRecipe.servings_label,
          ingredients: scaledIngredients,
          prep_time_minutes: extractedRecipe.prep_time_minutes,
          cook_time_minutes: extractedRecipe.cook_time_minutes,
          difficulty: extractedRecipe.difficulty,
          aldi_adapted: aldiMode,
        };

        const [addSettled, saveSettled] = await Promise.allSettled([
          addRecipeIngredientsToList(items, list.list_id),
          fetch("/api/recipe/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saveBody),
          }).then(async (res) => {
            if (!res.ok) {
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            return res.json() as Promise<{ id: string }>;
          }),
        ]);

        if (addSettled.status === "rejected") {
          throw addSettled.reason;
        }

        setAddToListResult(addSettled.value);
        setRecipeSaved(saveSettled.status === "fulfilled");
        setSaveWarning(saveSettled.status === "rejected");
        setStep(4);
      } catch (e) {
        log.error("[RecipeImportFlow] confirm failed:", e);
        setConfirmError(t("confirmFailedGeneric"));
      } finally {
        setConfirming(false);
      }
    },
    [extractedRecipe, servings, aldiMode, importSourceType, t],
  );

  const retryConfirm = useCallback(() => {
    const items = lastFailedItemsRef.current;
    if (items) void handleReviewConfirm(items);
  }, [handleReviewConfirm]);

  return (
    <div className="flex flex-col px-4 pb-8 pt-2">
      <StepIndicator step={step} />

      {step === 1 && recipeIdFromUrl && loadingSavedRecipe && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-aldi-muted">
          {t("loadingSavedRecipe")}
        </div>
      )}

      {step === 1 && savedRecipeLoadError && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
          {savedRecipeLoadError}
        </div>
      )}

      {step === 1 && !(recipeIdFromUrl && loadingSavedRecipe) && (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <p className="text-sm text-aldi-muted">{t("subtitle")}</p>
            <div
              role="tablist"
              aria-label={t("step1SourceTabs")}
              className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
            >
              <button
                type="button"
                role="tab"
                aria-selected={step1Mode === "url"}
                id="recipe-import-tab-url"
                className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
                  step1Mode === "url"
                    ? "bg-aldi-blue text-white"
                    : "bg-transparent text-aldi-muted"
                }`}
                onClick={() => setStep1Mode("url")}
              >
                {t("tabUrlImport")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={step1Mode === "manual"}
                id="recipe-import-tab-manual"
                className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-semibold transition ${
                  step1Mode === "manual"
                    ? "bg-aldi-blue text-white"
                    : "bg-transparent text-aldi-muted"
                }`}
                onClick={() => setStep1Mode("manual")}
              >
                {t("tabManualEntry")}
              </button>
            </div>
          </div>
          <div
            role="tabpanel"
            id={step1Mode === "url" ? "recipe-import-tab-url-panel" : "recipe-import-tab-manual-panel"}
            aria-labelledby={step1Mode === "url" ? "recipe-import-tab-url" : "recipe-import-tab-manual"}
          >
            {step1Mode === "url" ? (
              <UrlInput
                embedded
                onExtracted={onExtracted}
                onChooseManual={() => setStep1Mode("manual")}
              />
            ) : (
              <ManualRecipeEntry onSubmit={onExtracted} />
            )}
          </div>
        </>
      )}

      {step === 2 && extractedRecipe && (
        <>
          {matchError && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p>{matchError}</p>
              <button
                type="button"
                onClick={() => void runMatch()}
                className="self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-900"
              >
                {t("matchRetry")}
              </button>
            </div>
          )}
          {matching && matchSlowHint && (
            <p className="mb-3 text-center text-xs text-aldi-muted" role="status">
              {t("matchingSlowHint")}
            </p>
          )}
          <RecipePreview
            recipe={extractedRecipe}
            servings={servings}
            onServingsChange={setServings}
            aldiMode={aldiMode}
            onAldiModeChange={setAldiMode}
            onBack={() => {
              setStep(1);
              setMatchError(null);
              setStep1Mode(extractedRecipe.source_url?.trim() ? "url" : "manual");
            }}
            onCheckIngredients={runMatch}
            matching={matching}
          />
        </>
      )}

      {step === 3 && matchGrouped && (
        <>
          {confirming ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-2 text-center">
              <p className="text-aldi-muted">{t("confirmingLoading")}</p>
            </div>
          ) : (
            <>
              {confirmError && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <p>{confirmError}</p>
                  <button
                    type="button"
                    onClick={retryConfirm}
                    className="self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-900"
                  >
                    {t("confirmRetry")}
                  </button>
                </div>
              )}
              <IngredientReview
                matchResults={matchGrouped}
                servings={servings}
                aldiMode={aldiMode}
                nerdMode={checkPantry}
                onConfirm={handleReviewConfirm}
                onBack={() => setStep(2)}
              />
            </>
          )}
        </>
      )}

      {step === 4 && addToListResult && extractedRecipe && (
        <ImportConfirmation
          result={addToListResult}
          recipe={extractedRecipe}
          recipeSaved={recipeSaved}
          saveWarning={saveWarning}
          onGoToList={() => {
            router.push("/");
          }}
          onImportAnother={() => {
            setStep(1);
            setStep1Mode("url");
            setExtractedRecipe(null);
            setMatchGrouped(null);
            setAddToListResult(null);
            setRecipeSaved(false);
            setSaveWarning(false);
            setConfirmError(null);
          }}
        />
      )}
    </div>
  );
}

export function RecipeImportFlow() {
  const tCommon = useTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-aldi-muted">
          {tCommon("loading")}
        </div>
      }
    >
      <RecipeImportFlowInner />
    </Suspense>
  );
}
