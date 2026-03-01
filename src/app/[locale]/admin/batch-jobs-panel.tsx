"use client";

import { useTranslations } from "next-intl";
import type { useBatchJobs } from "./use-batch-jobs";

type BatchJobsHook = ReturnType<typeof useBatchJobs>;

interface BatchJobsPanelProps {
  batchJobs: BatchJobsHook;
}

function JobLogOutput({ log }: { log: string[] }) {
  if (log.length === 0) return null;
  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
      {log.map((line, i) => (
        <p key={i} className={`text-xs font-mono py-0.5 ${
          line.startsWith("❌") || line.startsWith("⚠") ? "text-red-600" : "text-gray-600"
        }`}>
          {line}
        </p>
      ))}
    </div>
  );
}

function JobProgress({ progress }: { progress: string | null }) {
  if (!progress) return null;
  return (
    <p className={`mt-3 text-sm font-semibold ${
      progress.startsWith("✅") ? "text-green-700" :
      progress.includes("❌") ? "text-red-600" :
      "text-aldi-blue"
    }`}>
      {progress}
    </p>
  );
}

export function BatchJobsPanel({ batchJobs }: BatchJobsPanelProps) {
  const t = useTranslations("admin");
  const { reclassify, assignDemandGroups, reclassifyCountry, setReclassifyCountry, runReclassify, runAssignDemandGroups } = batchJobs;

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-aldi-muted-light bg-white p-3">
        <span className="text-sm font-medium text-aldi-text">Land-Filter:</span>
        {[
          { value: "", label: "Alle" },
          { value: "DE", label: "DE" },
          { value: "AT", label: "AT" },
        ].map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-sm text-aldi-text cursor-pointer">
            <input
              type="radio"
              name="admin-country"
              value={opt.value}
              checked={reclassifyCountry === opt.value}
              onChange={() => setReclassifyCountry(opt.value)}
              disabled={reclassify.loading || assignDemandGroups.loading}
              className="accent-aldi-blue"
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
        <p className="mb-2 text-sm font-medium text-aldi-text">
          {t("reclassifyTitle")}
        </p>
        <p className="mb-3 text-xs text-aldi-muted">
          {t("reclassifyDesc", { scope: reclassifyCountry ? `(${reclassifyCountry})` : "(DE + AT)" })}
        </p>
        <button
          type="button"
          onClick={runReclassify}
          disabled={reclassify.loading}
          className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {reclassify.loading ? t("running") : t("reclassifyButton")}
        </button>
        <JobProgress progress={reclassify.progress} />
        <JobLogOutput log={reclassify.log} />
      </div>

      <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
        <p className="mb-2 text-sm font-medium text-aldi-text">
          {t("assignDemandGroups")}
        </p>
        <p className="mb-3 text-xs text-aldi-muted">
          {t("assignDemandGroupsDesc")}
        </p>
        <button
          type="button"
          onClick={runAssignDemandGroups}
          disabled={assignDemandGroups.loading}
          className="min-h-touch rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {assignDemandGroups.loading ? t("running") : t("assignDemandGroups")}
        </button>
        <JobProgress progress={assignDemandGroups.progress} />
        <JobLogOutput log={assignDemandGroups.log} />
      </div>
    </>
  );
}
