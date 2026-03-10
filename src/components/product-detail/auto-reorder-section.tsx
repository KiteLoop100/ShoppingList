"use client";

import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAutoReorder } from "@/hooks/use-auto-reorder";
import type { ReorderUnit } from "@/hooks/use-auto-reorder";

const UNIT_OPTIONS: ReorderUnit[] = ["days", "weeks", "months"];
const VALUE_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

interface AutoReorderSectionProps {
  productId: string;
  onReorderChanged?: () => void;
}

export function AutoReorderSection({ productId, onReorderChanged }: AutoReorderSectionProps) {
  const tReorder = useTranslations("autoReorder");
  const locale = useLocale();

  const {
    reorderEnabled,
    reorderValue,
    reorderUnit,
    reorderLoading,
    nextReorderDate,
    loadReorderSetting,
    handleToggleReorder,
    handleValueChange,
    handleUnitChange,
  } = useAutoReorder(onReorderChanged);

  useEffect(() => {
    loadReorderSetting(productId);
  }, [productId, loadReorderSetting]);

  const unitLabel = (u: ReorderUnit) =>
    u === "days" ? tReorder("unitDays") : u === "weeks" ? tReorder("unitWeeks") : tReorder("unitMonths");

  return (
    <div className="mt-4 border-t border-aldi-muted-light pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          <span className="text-sm font-medium text-aldi-text">{tReorder("title")}</span>
        </div>
        <button
          type="button"
          onClick={handleToggleReorder}
          disabled={reorderLoading}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aldi-blue focus:ring-offset-2 disabled:opacity-50 ${
            reorderEnabled ? "bg-aldi-blue" : "bg-gray-200"
          }`}
          role="switch"
          aria-checked={reorderEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              reorderEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {reorderEnabled && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-aldi-muted">{tReorder("every")}</span>
            <select
              value={reorderValue}
              onChange={(e) => handleValueChange(Number(e.target.value))}
              className="rounded-lg border border-aldi-muted-light bg-gray-50 px-2 py-1.5 text-sm font-medium text-aldi-text focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
            >
              {VALUE_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={reorderUnit}
              onChange={(e) => handleUnitChange(e.target.value as ReorderUnit)}
              className="rounded-lg border border-aldi-muted-light bg-gray-50 px-2 py-1.5 text-sm font-medium text-aldi-text focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{unitLabel(u)}</option>
              ))}
            </select>
          </div>
          {nextReorderDate && (
            <p className="text-xs text-aldi-muted">
              {tReorder("nextReorder", {
                date: new Date(nextReorderDate + "T00:00:00").toLocaleDateString(
                  locale === "de" ? "de-DE" : "en-US",
                  { weekday: "short", day: "2-digit", month: "2-digit" }
                ),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
