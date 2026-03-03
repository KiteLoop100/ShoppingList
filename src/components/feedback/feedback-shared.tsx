"use client";

import { useTranslations } from "next-intl";

// ─── Star Rating ────────────────────────────────────────

interface StarRatingProps {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}

export function StarRating({ value, onChange, disabled }: StarRatingProps) {
  const t = useTranslations("feedback");
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={t("ratingLabel")}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === star ? null : star)}
          className="touch-target flex items-center justify-center text-2xl transition-transform active:scale-110 disabled:opacity-50"
          aria-label={t("starLabel", { count: star })}
          aria-checked={value === star}
          role="radio"
        >
          <span className={value != null && star <= value ? "text-amber-400" : "text-gray-300"}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Category Chips ─────────────────────────────────────

interface CategoryChipsProps {
  categories: readonly string[];
  selected: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function CategoryChips({ categories, selected, onChange, disabled }: CategoryChipsProps) {
  const t = useTranslations("feedback");
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("categoryLabel")}>
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          disabled={disabled}
          onClick={() => onChange(selected === cat ? null : cat)}
          role="radio"
          aria-checked={selected === cat}
          className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
            selected === cat
              ? "border-aldi-blue bg-aldi-blue text-white"
              : "border-aldi-muted-light bg-white text-aldi-text hover:border-aldi-blue/50"
          } disabled:opacity-50`}
        >
          {t(`category_${cat}`)}
        </button>
      ))}
    </div>
  );
}

// ─── Feedback Textarea ──────────────────────────────────

interface FeedbackTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  minLength?: number;
}

export function FeedbackTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength = 2000,
  minLength = 10,
}: FeedbackTextareaProps) {
  const t = useTranslations("feedback");
  const charCount = value.length;
  const tooShort = charCount > 0 && charCount < minLength;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) onChange(e.target.value);
        }}
        placeholder={placeholder ?? t("textareaPlaceholder")}
        disabled={disabled}
        rows={4}
        className="w-full resize-none rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none disabled:opacity-50"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        {tooShort && (
          <span className="text-aldi-error">
            {t("minChars", { count: minLength })}
          </span>
        )}
        <span className={`ml-auto ${charCount >= maxLength ? "text-aldi-error" : "text-aldi-muted"}`}>
          {charCount} / {maxLength}
        </span>
      </div>
    </div>
  );
}
