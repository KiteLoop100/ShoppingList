"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ArticleNumberEditSheetProps {
  currentNumber: string | null;
  onSave: (newNumber: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

const MIN_DIGITS = 4;

export function ArticleNumberEditSheet({
  currentNumber,
  onSave,
  onCancel,
  saving,
}: ArticleNumberEditSheetProps) {
  const t = useTranslations("receipts");
  const [value, setValue] = useState(currentNumber ?? "");

  const digitsOnly = value.replace(/\D/g, "");
  const isValid = digitsOnly.length >= MIN_DIGITS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !saving) onSave(digitsOnly);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold text-aldi-text">
          {t("editArticleNumber")}
        </h3>
        <p className="mb-4 text-xs text-aldi-muted">
          {t("editArticleNumberHint")}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("editArticleNumberPlaceholder")}
            className="mb-4 w-full rounded-xl border border-aldi-muted-light px-4 py-3 text-lg tabular-nums focus:border-aldi-blue focus:outline-none focus:ring-2 focus:ring-aldi-blue/30"
            autoFocus
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-xl border border-aldi-muted-light px-4 py-3 text-sm font-medium text-aldi-muted transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {t("editArticleNumberCancel")}
            </button>
            <button
              type="submit"
              disabled={!isValid || saving}
              className="flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "…" : t("editArticleNumberSave")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
