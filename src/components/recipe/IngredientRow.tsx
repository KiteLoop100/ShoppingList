"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { PantryCheckResult } from "@/lib/recipe/types";

export type IngredientRowVariant = "available" | "buy" | "unavailable" | "needs_confirmation";

export type IngredientRowProps = {
  item: PantryCheckResult;
  variant: IngredientRowVariant;
  onAction?: (action: string) => void;
  showToggle?: boolean;
  toggleChecked?: boolean;
  onToggleChange?: (checked: boolean) => void;
  /** Replaces default right column (e.g. substitute actions). */
  rightSlot?: ReactNode;
  /** Extra lines under the main text (e.g. opened-pack hint). */
  footerSlot?: ReactNode;
  className?: string;
};

function formatIngredientLine(r: PantryCheckResult): string {
  const ig = r.ingredient;
  if (ig.amount === null) return ig.name;
  const u = ig.unit ?? "";
  return `${ig.name}, ${ig.amount} ${u}`.trim();
}

function tierLabelKey(tier: number): "tier1" | "tier2" | "tier3" | "tier4" {
  if (tier <= 1) return "tier1";
  if (tier === 2) return "tier2";
  if (tier === 3) return "tier3";
  return "tier4";
}

export function IngredientRow({
  item,
  variant,
  onAction,
  showToggle,
  toggleChecked = true,
  onToggleChange,
  rightSlot,
  footerSlot,
  className = "",
}: IngredientRowProps) {
  const t = useTranslations("recipeImport.ingredientReview");

  const icon =
    variant === "available" ? (
      <span className="text-lg leading-none" aria-hidden>
        ✅
      </span>
    ) : variant === "buy" ? (
      <span className="text-lg leading-none" aria-hidden>
        🛒
      </span>
    ) : (
      <span className="text-lg leading-none" aria-hidden>
        ⚠️
      </span>
    );

  const tierKey = tierLabelKey(item.match_tier);
  const tierText = tierKey === "tier1" ? null : t(tierKey);

  const secondary =
    item.aldi_product?.name != null
      ? t("aldiProductLine", { name: item.aldi_product.name })
      : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-gray-100 bg-white px-3 py-3 shadow-sm transition-all duration-ui ${className}`}
    >
      <div className="flex min-h-touch shrink-0 items-start pt-0.5" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-aldi-text">{formatIngredientLine(item)}</p>
        {secondary && (
          <p className="mt-0.5 text-xs leading-snug text-aldi-muted">{secondary}</p>
        )}
        {item.substitute_note && (
          <p className="mt-0.5 text-xs italic leading-snug text-aldi-text-secondary">{item.substitute_note}</p>
        )}
        {tierText && (
          <p
            className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${
              item.match_tier === 2
                ? "text-aldi-muted"
                : item.match_tier === 3
                  ? "text-aldi-orange"
                  : "text-aldi-error"
            }`}
          >
            {tierText}
          </p>
        )}
        {footerSlot}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-center gap-2">
        {rightSlot}
        {showToggle && (
          <label className="flex min-h-touch cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-aldi-blue focus:ring-aldi-blue"
              checked={toggleChecked}
              onChange={(e) => onToggleChange?.(e.target.checked)}
              aria-label={t("toggleInclude")}
            />
          </label>
        )}
        {variant === "needs_confirmation" && !rightSlot && (
          <div className="flex max-w-[200px] flex-col gap-2 sm:flex-row sm:max-w-none">
            <button
              type="button"
              className="min-h-touch min-w-touch rounded-lg border-2 border-aldi-success px-3 py-2 text-xs font-semibold text-aldi-success"
              onClick={() => onAction?.("sufficient")}
              aria-label={t("openedEnoughAria")}
            >
              {t("openedEnough")}
            </button>
            <button
              type="button"
              className="min-h-touch min-w-touch rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-aldi-text"
              onClick={() => onAction?.("buy")}
              aria-label={t("openedRebuyAria")}
            >
              {t("openedRebuy")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
