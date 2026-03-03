"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { StarRating, CategoryChips, FeedbackTextarea } from "./feedback-shared";
import { PRODUCT_CATEGORIES } from "@/lib/feedback/feedback-types";
import type { Product } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";

interface ProductFeedbackFormProps {
  product: Product;
}

export function ProductFeedbackForm({ product }: ProductFeedbackFormProps) {
  const t = useTranslations("feedback");
  const { user } = useAuth();

  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = category && message.length >= 10 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "product",
          product_id: product.product_id,
          category,
          rating,
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user, product.product_id, category, rating, message, t]);

  if (submitted) {
    return (
      <div className="mt-4 border-t border-aldi-muted-light pt-4">
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <span>✓</span>
          <span>{t("thankYou")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-aldi-muted-light pt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-base">📣</span>
        <span className="flex-1 text-sm font-medium text-aldi-text">
          {t("productFeedbackTitle")}
        </span>
        <svg
          className={`h-4 w-4 text-aldi-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-aldi-muted">{t("productFeedbackSubtitle")}</p>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-aldi-muted">
              {t("ratingLabel")} ({t("optional")})
            </p>
            <StarRating value={rating} onChange={setRating} disabled={submitting} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-aldi-muted">
              {t("categoryLabel")}
            </p>
            <CategoryChips
              categories={PRODUCT_CATEGORIES}
              selected={category}
              onChange={setCategory}
              disabled={submitting}
            />
          </div>

          <FeedbackTextarea
            value={message}
            onChange={setMessage}
            placeholder={t("productPlaceholder")}
            disabled={submitting}
          />

          {error && (
            <p className="text-sm text-aldi-error">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
          >
            {submitting ? t("submitting") : t("submit")}
          </button>

          <p className="text-center text-xs text-aldi-muted">{t("privacyNote")}</p>
        </div>
      )}
    </div>
  );
}
