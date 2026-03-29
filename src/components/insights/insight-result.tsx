"use client";

import type { InsightResponse } from "@/lib/insights/types";

interface InsightResultProps {
  result: InsightResponse;
  onNewAnalysis: () => void;
  onFollowUp: (suggestion: string) => void;
  cooldownSeconds: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function InsightResult({
  result,
  onNewAnalysis,
  onFollowUp,
  cooldownSeconds,
  t,
}: InsightResultProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-aldi-text">{result.title}</h2>
      {result.sections.map((section, i) => (
        <div key={i} className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-sm leading-relaxed text-aldi-text">{section.content}</p>
        </div>
      ))}
      {result.summary && (
        <div className="rounded-lg bg-aldi-blue/5 p-4">
          <p className="text-sm font-medium text-aldi-blue">{result.summary}</p>
        </div>
      )}
      {result.follow_up_suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.follow_up_suggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onFollowUp(suggestion)}
              className="rounded-full border border-aldi-blue/30 px-3 py-1.5 text-xs text-aldi-blue transition-colors hover:bg-aldi-blue/5"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onNewAnalysis}
          disabled={cooldownSeconds > 0}
          className="rounded-lg bg-aldi-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
        >
          {cooldownSeconds > 0
            ? t("cooldownButton", { seconds: cooldownSeconds })
            : t("newAnalysis")}
        </button>
      </div>
    </div>
  );
}
