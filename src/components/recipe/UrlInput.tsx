"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import type { ExtractedRecipe } from "@/lib/recipe/types";

function isValidHttpUrl(value: string): boolean {
  const t = value.trim();
  return /^https?:\/\//i.test(t);
}

type UrlInputProps = {
  onExtracted: (recipe: ExtractedRecipe) => void;
  /** When set, hides the page title block (parent shows tabs). */
  embedded?: boolean;
  /** Switch parent to manual entry (e.g. second tab). */
  onChooseManual?: () => void;
};

export function UrlInput({ onExtracted, embedded, onChooseManual }: UrlInputProps) {
  const t = useTranslations("recipeImport");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const autoStartedRef = useRef(false);

  const clearQueryUrl = useCallback(() => {
    router.replace("/recipe-import");
  }, [router]);

  useEffect(() => {
    if (!loading) {
      setSlowHint(false);
      return;
    }
    const id = window.setTimeout(() => setSlowHint(true), 3000);
    return () => window.clearTimeout(id);
  }, [loading]);

  const extract = useCallback(
    async (urlToFetch: string) => {
      const trimmed = urlToFetch.trim();
      if (!isValidHttpUrl(trimmed)) {
        setError(t("urlInvalid"));
        return;
      }
      setLoading(true);
      setError(null);
      setErrorRetryable(false);
      try {
        const res = await fetch("/api/recipe/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        const data = (await res.json()) as { recipe?: ExtractedRecipe; error?: string };

        if (res.status === 429) {
          setError(t("error429"));
          setErrorRetryable(false);
          return;
        }
        if (res.status === 502) {
          setError(t("error502"));
          setErrorRetryable(false);
          return;
        }
        if (res.status === 422) {
          setError(t("error422"));
          setErrorRetryable(false);
          return;
        }
        if (!res.ok) {
          setError(t("errorGeneric"));
          setErrorRetryable(res.status >= 500);
          return;
        }
        if (!data.recipe) {
          setError(t("errorGeneric"));
          setErrorRetryable(true);
          return;
        }
        clearQueryUrl();
        onExtracted(data.recipe);
      } catch {
        setError(t("errorGeneric"));
        setErrorRetryable(true);
      } finally {
        setLoading(false);
      }
    },
    [onExtracted, t, clearQueryUrl],
  );

  useEffect(() => {
    const fromQuery = searchParams.get("url")?.trim();
    if (!fromQuery || autoStartedRef.current) return;
    if (!isValidHttpUrl(fromQuery)) return;
    autoStartedRef.current = true;
    setValue(fromQuery);
    void extract(fromQuery);
  }, [searchParams, extract]);

  const invalid = touched && value.trim().length > 0 && !isValidHttpUrl(value);
  const canSubmit = isValidHttpUrl(value) && !loading;

  return (
    <div className="flex flex-col gap-4">
      {!embedded && (
        <div>
          <h2 className="text-xl font-semibold text-aldi-text">{t("title")}</h2>
          <p className="mt-1 text-sm text-aldi-muted">{t("subtitle")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="recipe-url" className="sr-only">
          {t("urlLabel")}
        </label>
        <input
          id="recipe-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoFocus={!embedded}
          placeholder={t("urlPlaceholder")}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          disabled={loading}
          className="min-h-[48px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[16px] text-aldi-text shadow-sm outline-none ring-aldi-blue focus:border-aldi-blue focus:ring-2 focus:ring-aldi-blue/20 disabled:opacity-60"
        />
        {invalid && <p className="text-sm text-red-600">{t("urlInvalid")}</p>}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
            {!loading && errorRetryable && (
              <button
                type="button"
                onClick={() => void extract(value)}
                className="ml-2 font-medium underline"
              >
                {t("retry")}
              </button>
            )}
          </div>
        )}
        {loading && slowHint && (
          <p className="text-center text-xs text-aldi-muted" role="status">
            {t("extractSlowHint")}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void extract(value)}
        aria-busy={loading}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-aldi-orange px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span
              className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden
            />
            <span>{t("loadingExtract")}</span>
          </>
        ) : (
          t("loadRecipe")
        )}
      </button>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-aldi-bg px-3 text-xs font-medium uppercase tracking-wide text-aldi-muted">
            {t("orDivider")}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onChooseManual}
        disabled={!onChooseManual}
        className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 py-3 text-sm font-medium text-aldi-text transition hover:border-aldi-blue/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={t("manualEntry")}
      >
        {t("manualEntry")} →
      </button>
    </div>
  );
}
