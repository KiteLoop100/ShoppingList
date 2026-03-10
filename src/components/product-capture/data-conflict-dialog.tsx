"use client";

import { useState } from "react";
import type { FieldConflict } from "@/lib/product-photos/detect-field-conflicts";

export interface DataConflictDialogProps {
  conflicts: FieldConflict[];
  onResolve: (decisions: Record<string, "keep" | "replace">) => void;
  onDismiss: () => void;
  labels: {
    title: string;
    summary: string;
    keepMyValues: string;
    useAiValues: string;
    showDetails: string;
    currentValue: string;
    aiValue: string;
  };
}

export function DataConflictDialog({
  conflicts,
  onResolve,
  onDismiss,
  labels,
}: DataConflictDialogProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [perField, setPerField] = useState<Record<string, "keep" | "replace">>({});

  if (conflicts.length === 0) return null;

  function handleKeepAll() {
    const decisions: Record<string, "keep" | "replace"> = {};
    for (const c of conflicts) decisions[c.field] = "keep";
    onResolve(decisions);
  }

  function handleReplaceAll() {
    const decisions: Record<string, "keep" | "replace"> = {};
    for (const c of conflicts) decisions[c.field] = "replace";
    onResolve(decisions);
  }

  function handleApplyCustom() {
    const decisions: Record<string, "keep" | "replace"> = {};
    for (const c of conflicts) {
      decisions[c.field] = perField[c.field] ?? "keep";
    }
    onResolve(decisions);
  }

  function toggleField(field: string) {
    setPerField((prev) => ({
      ...prev,
      [field]: prev[field] === "replace" ? "keep" : "replace",
    }));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onDismiss} />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl">
        <h3 className="text-base font-semibold text-aldi-text">
          {labels.title}
        </h3>
        <p className="mt-1 text-sm text-aldi-muted">
          {labels.summary.replace("{count}", String(conflicts.length))}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleKeepAll}
            className="flex-1 rounded-xl border-2 border-aldi-blue bg-white px-3 py-2.5 text-sm font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
          >
            {labels.keepMyValues}
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            className="flex-1 rounded-xl bg-aldi-blue px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90"
          >
            {labels.useAiValues}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-aldi-muted hover:text-aldi-text"
        >
          <svg
            className={`h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          {labels.showDetails}
        </button>

        {showDetails && (
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {conflicts.map((c) => (
              <div
                key={c.field}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-aldi-text">{c.field}</span>
                  <div className="mt-0.5 text-aldi-muted">
                    {labels.currentValue}: <span className="text-aldi-text">{c.currentValue}</span>
                  </div>
                  <div className="text-aldi-muted">
                    {labels.aiValue}: <span className="text-aldi-blue">{c.aiValue}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleField(c.field)}
                  className={`ml-2 flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                    perField[c.field] === "replace"
                      ? "bg-aldi-blue text-white"
                      : "bg-gray-200 text-aldi-muted"
                  }`}
                >
                  {perField[c.field] === "replace" ? "AI" : labels.currentValue.substring(0, 4)}
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleApplyCustom}
              className="mt-2 w-full rounded-xl bg-aldi-blue px-3 py-2 text-sm font-medium text-white"
            >
              {labels.useAiValues}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
