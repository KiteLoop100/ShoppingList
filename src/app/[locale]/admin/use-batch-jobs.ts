"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";

interface BatchJobState {
  jobId: string | null;
  loading: boolean;
  progress: string | null;
  log: string[];
}

const INITIAL_STATE: BatchJobState = {
  jobId: null,
  loading: false,
  progress: null,
  log: [],
};

export function useBatchJobs(auth: boolean) {
  const t = useTranslations("admin");
  const [reclassify, setReclassify] = useState<BatchJobState>(INITIAL_STATE);
  const [assignDemandGroups, setAssignDemandGroups] = useState<BatchJobState>(INITIAL_STATE);
  const [reclassifyCountry, setReclassifyCountry] = useState("");
  const driveJobRef = useRef(false);

  const updateReclassify = useCallback((patch: Partial<BatchJobState>) => {
    setReclassify((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAssign = useCallback((patch: Partial<BatchJobState>) => {
    setAssignDemandGroups((prev) => ({ ...prev, ...patch }));
  }, []);

  const driveJob = useCallback(
    async (
      jobId: string,
      update: (patch: Partial<BatchJobState>) => void,
      storageKey: string
    ) => {
      if (driveJobRef.current) return;
      driveJobRef.current = true;
      update({ loading: true });

      try {
        for (;;) {
          if (!driveJobRef.current) break;
          const res = await fetch("/api/admin/batch-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId }),
          });

          if (!res.ok) {
            update({ progress: t("batchError", { status: res.statusText }) });
            break;
          }

          const data = await res.json();
          update({ log: data.log_lines ?? [] });

          if (data.status === "completed") {
            update({ progress: t("batchDone", { count: data.total_updated, batches: data.current_batch }) });
            break;
          }
          if (data.status === "failed") {
            update({ progress: t("batchAborted", { message: data.error_message ?? t("unknownError") }) });
            break;
          }

          update({ progress: t("batchProgress", { batch: data.current_batch, updated: data.total_updated, remaining: data.total_remaining ?? "?" }) });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        update({ progress: t("networkError", { message: msg }) });
      } finally {
        driveJobRef.current = false;
        update({ loading: false });
        sessionStorage.removeItem(storageKey);
      }
    },
    [t]
  );

  useEffect(() => {
    const savedAssign = typeof window !== "undefined" ? sessionStorage.getItem("assignJobId") : null;
    const savedReclassify = typeof window !== "undefined" ? sessionStorage.getItem("reclassifyJobId") : null;
    if (savedAssign) {
      updateAssign({ jobId: savedAssign, progress: "Fortschritt wird geladen…" });
      driveJob(savedAssign, updateAssign, "assignJobId");
    }
    if (savedReclassify) {
      updateReclassify({ jobId: savedReclassify, progress: "Fortschritt wird geladen…" });
      driveJob(savedReclassify, updateReclassify, "reclassifyJobId");
    }
  }, [driveJob, updateAssign, updateReclassify]);

  useEffect(() => {
    if (!auth) return;
    const savedAssign = typeof window !== "undefined" ? sessionStorage.getItem("assignJobId") : null;
    const savedReclassify = typeof window !== "undefined" ? sessionStorage.getItem("reclassifyJobId") : null;
    if (savedAssign || savedReclassify) return;

    (async () => {
      try {
        const res = await fetch("/api/admin/batch-jobs/running");
        if (!res.ok) return;
        const jobs: Array<{ job_id: string; job_type: string; current_batch: number; total_processed: number; total_remaining: number }> = await res.json();
        for (const job of jobs) {
          if (job.job_type === "reclassify" && !reclassify.loading) {
            sessionStorage.setItem("reclassifyJobId", job.job_id);
            updateReclassify({ jobId: job.job_id, progress: `Job wird fortgesetzt ab Batch ${job.current_batch}…` });
            driveJob(job.job_id, updateReclassify, "reclassifyJobId");
          } else if (job.job_type === "assign_demand_groups" && !assignDemandGroups.loading) {
            sessionStorage.setItem("assignJobId", job.job_id);
            updateAssign({ jobId: job.job_id, progress: `Job wird fortgesetzt ab Batch ${job.current_batch}…` });
            driveJob(job.job_id, updateAssign, "assignJobId");
          }
        }
      } catch { /* ignore */ }
    })();
  }, [auth, driveJob, reclassify.loading, assignDemandGroups.loading, updateReclassify, updateAssign]);

  const startBatchJob = useCallback(
    async (
      jobType: "assign_demand_groups" | "reclassify",
      update: (patch: Partial<BatchJobState>) => void,
      storageKey: string
    ) => {
      update({ loading: true, progress: "Job wird gestartet…", log: [] });
      try {
        const res = await fetch("/api/admin/batch-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_type: jobType,
            ...(reclassifyCountry ? { country: reclassifyCountry } : {}),
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          update({ progress: `❌ Start fehlgeschlagen: ${errData.error ?? res.statusText}`, loading: false });
          return;
        }
        const data = await res.json();
        const jobId = data.job_id as string;
        update({ jobId });
        sessionStorage.setItem(storageKey, jobId);
        update({ progress: "Erster Batch wird verarbeitet…" });
        driveJob(jobId, update, storageKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        update({ progress: t("networkError", { message: msg }), loading: false });
      }
    },
    [reclassifyCountry, driveJob, t]
  );

  const runReclassify = useCallback(() => {
    startBatchJob("reclassify", updateReclassify, "reclassifyJobId");
  }, [startBatchJob, updateReclassify]);

  const runAssignDemandGroups = useCallback(() => {
    startBatchJob("assign_demand_groups", updateAssign, "assignJobId");
  }, [startBatchJob, updateAssign]);

  return {
    reclassify,
    assignDemandGroups,
    reclassifyCountry,
    setReclassifyCountry,
    runReclassify,
    runAssignDemandGroups,
  };
}
