"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CategoryChips, FeedbackTextarea } from "./feedback-shared";
import { GENERAL_CATEGORIES } from "@/lib/feedback/feedback-types";
import { useAuth } from "@/lib/auth/auth-context";
import { getDefaultStoreId } from "@/lib/settings/default-store";

interface GeneralFeedbackFormProps {
  onSuccess?: () => void;
}

export function GeneralFeedbackForm({ onSuccess }: GeneralFeedbackFormProps) {
  const t = useTranslations("feedback");
  const { user } = useAuth();

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
      const storeId = getDefaultStoreId();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "general",
          store_id: storeId,
          category,
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, user, category, message, t, onSuccess]);

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">✓</span>
        <p className="text-lg font-semibold text-aldi-text">{t("thankYou")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-aldi-muted">{t("generalSubtitle")}</p>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-aldi-muted">
          {t("categoryLabel")}
        </p>
        <CategoryChips
          categories={GENERAL_CATEGORIES}
          selected={category}
          onChange={setCategory}
          disabled={submitting}
        />
      </div>

      <FeedbackTextarea
        value={message}
        onChange={setMessage}
        placeholder={t("generalPlaceholder")}
        disabled={submitting}
      />

      {error && <p className="text-sm text-aldi-error">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
      >
        {submitting ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
