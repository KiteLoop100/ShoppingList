"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { formatRelativeTimePast } from "@/lib/utils/format-relative-time";
import { log } from "@/lib/utils/logger";
import type { SavedRecipe } from "@/lib/recipe/types";
import { SavedRecipeAiOverlay } from "@/components/recipe/SavedRecipeAiOverlay";

const PAGE_SIZE = 20;

function hostnameFromUrl(url: string | null): string {
  if (!url?.trim()) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

type SavedRecipesListProps = {
  onSelectRecipe?: (recipe: SavedRecipe) => void;
  /** Called when the user chooses “import” from the empty state (in addition to navigation). */
  onImportNew?: () => void;
};

export function SavedRecipesList({ onSelectRecipe, onImportNew }: SavedRecipesListProps) {
  const t = useTranslations("savedRecipes");
  const locale = useLocale();
  const router = useRouter();

  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [aiOverlayRecipe, setAiOverlayRecipe] = useState<SavedRecipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedRecipe | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      if (append) {
        setLoadMoreLoading(true);
      } else {
        setLoading(true);
      }
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/recipe/saved?limit=${PAGE_SIZE}&offset=${start}`,
        );
        const body = (await res.json()) as {
          recipes?: SavedRecipe[];
          total?: number;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const next = body.recipes ?? [];
        const count = body.total ?? next.length;
        setTotal(count);
        setOffset(start + next.length);
        setRecipes((prev) => (append ? [...prev, ...next] : next));
      } catch (e) {
        log.error("[SavedRecipesList] fetch failed:", e);
        setFetchError(e instanceof Error ? e.message : t("loadError"));
      } finally {
        setLoading(false);
        setLoadMoreLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const hasMore = recipes.length < total;

  const handleRecipeTap = useCallback(
    (recipe: SavedRecipe) => {
      onSelectRecipe?.(recipe);
      if (recipe.source_type === "url_import") {
        router.push(`/recipe-import?recipe_id=${encodeURIComponent(recipe.id)}`);
        return;
      }
      void fetch("/api/recipe/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recipe.id }),
      }).catch((e) => log.warn("[SavedRecipesList] touch failed:", e));
      setAiOverlayRecipe(recipe);
    },
    [onSelectRecipe, router],
  );

  const requestDelete = useCallback((e: React.MouseEvent, recipe: SavedRecipe) => {
    e.stopPropagation();
    setConfirmDelete(recipe);
  }, []);

  const performDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setDeletingId(id);
    const snapshot = recipes;
    const snapshotTotal = total;
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setTotal((n) => Math.max(0, n - 1));
    setConfirmDelete(null);

    try {
      const res = await fetch(`/api/recipe/saved?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      log.error("[SavedRecipesList] delete failed:", e);
      setRecipes(snapshot);
      setTotal(snapshotTotal);
      setFetchError(e instanceof Error ? e.message : t("deleteError"));
    } finally {
      setDeletingId(null);
    }
  }, [confirmDelete, recipes, total, t]);

  const sourceBadge = (recipe: SavedRecipe) => {
    if (recipe.source_type === "ai_cook") {
      return t("source_ai_cook");
    }
    const host = hostnameFromUrl(recipe.source_url);
    return host || recipe.source_name || t("source_url_import");
  };

  if (loading && recipes.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-aldi-muted">
        {t("loading")}
      </section>
    );
  }

  if (!loading && recipes.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white/90 px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-aldi-blue/10 text-2xl" aria-hidden>
          📖
        </div>
        <h2 className="text-base font-semibold text-aldi-text">{t("emptyTitle")}</h2>
        <p className="mt-2 text-sm text-aldi-muted">{t("emptyDescription")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/recipe-import"
            onClick={() => onImportNew?.()}
            className="touch-target inline-flex min-h-[48px] items-center justify-center rounded-xl bg-aldi-blue px-4 text-sm font-semibold text-white"
          >
            {t("importNew")}
          </Link>
          <Link
            href="/cook"
            className="touch-target inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-aldi-blue bg-white px-4 text-sm font-semibold text-aldi-blue"
          >
            {t("askCookAssistant")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="saved-recipes-heading">
        <div className="flex items-baseline justify-between gap-2 px-0.5">
          <h2 id="saved-recipes-heading" className="text-base font-semibold text-aldi-text">
            {t("myRecipes")}{" "}
            <span className="font-normal text-gray-500">{t("recipeCount", { count: total })}</span>
          </h2>
        </div>

        {fetchError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {fetchError}
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {recipes.map((recipe) => {
            const relativeSaved = formatRelativeTimePast(recipe.created_at, locale);
            const ingCount = recipe.ingredients?.length ?? 0;
            return (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => handleRecipeTap(recipe)}
                  className="flex w-full touch-target items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors pointer-fine:hover:border-aldi-blue/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-aldi-text">{recipe.title}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                        {sourceBadge(recipe)}
                      </span>
                      {recipe.aldi_adapted && (
                        <span className="inline-flex rounded-full bg-aldi-orange/15 px-2 py-0.5 text-[11px] font-semibold text-aldi-orange">
                          {t("aldi_adapted_badge")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-aldi-muted">
                      {t("portionsAndIngredients", {
                        portions: recipe.original_servings,
                        ingredients: ingCount,
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {t("savedAgo", { time: relativeSaved })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => requestDelete(e, recipe)}
                    disabled={deletingId === recipe.id}
                    className="touch-target shrink-0 rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    aria-label={t("delete")}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.038-2.09 1.16-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </button>
                </button>
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <button
            type="button"
            onClick={() => void loadPage(offset, true)}
            disabled={loadMoreLoading}
            className="touch-target mt-1 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-aldi-blue disabled:opacity-50"
          >
            {loadMoreLoading ? t("loadingMore") : t("loadMore")}
          </button>
        )}
      </section>

      {aiOverlayRecipe && (
        <SavedRecipeAiOverlay recipe={aiOverlayRecipe} onClose={() => setAiOverlayRecipe(null)} />
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="delete-dialog-title" className="text-base font-semibold text-aldi-text">
              {t("delete")}
            </h3>
            <p className="mt-2 text-sm text-aldi-muted">{t("deleteConfirm")}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="touch-target flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-aldi-text"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void performDelete()}
                className="touch-target flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
