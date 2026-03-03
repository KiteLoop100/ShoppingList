"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Feedback, FeedbackType } from "@/lib/feedback/feedback-types";

const TYPE_FILTERS: (FeedbackType | "all")[] = ["all", "product", "general", "post_shopping"];

export function FeedbackPanel() {
  const t = useTranslations("feedback");
  const tAdmin = useTranslations("admin");

  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/feedback?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeedback(data.feedback ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const updateStatus = useCallback(async (feedbackId: string, status: string) => {
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback_id: feedbackId, status }),
      });
      if (res.ok) {
        setFeedback((prev) =>
          prev.map((f) => (f.feedback_id === feedbackId ? { ...f, status: status as Feedback["status"] } : f)),
        );
      }
    } catch {
      // ignore
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    if (feedback.length === 0) return;
    const headers = ["feedback_id", "feedback_type", "category", "rating", "message", "status", "created_at"];
    const rows = feedback.map((f) =>
      headers.map((h) => {
        const val = f[h as keyof Feedback];
        const str = val == null ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [feedback]);

  const newCount = feedback.filter((f) => f.status === "new").length;

  const renderRating = (f: Feedback) => {
    if (f.feedback_type === "post_shopping" && f.rating) {
      const emojis = ["😞", "😐", "🙂", "😊", "🤩"];
      return <span className="text-lg">{emojis[f.rating - 1]}</span>;
    }
    if (f.rating) {
      return (
        <span className="text-amber-400">
          {"★".repeat(f.rating)}
          <span className="text-gray-300">{"★".repeat(5 - f.rating)}</span>
        </span>
      );
    }
    return null;
  };

  const typeLabel = (type: FeedbackType) => {
    if (type === "product") return t("typeProduct");
    if (type === "general") return t("typeGeneral");
    return t("typePostShopping");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    if (diffH < 1) return t("timeJustNow");
    if (diffH < 24) return t("timeHoursAgo", { count: diffH });
    if (diffH < 48) return t("timeYesterday");
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-aldi-blue">
          📣 {t("adminTitle")} {newCount > 0 && <span className="text-sm font-normal text-aldi-muted">({newCount} {t("statusNew")})</span>}
        </h2>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={feedback.length === 0}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10 disabled:opacity-50"
        >
          CSV Export
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPE_FILTERS.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTypeFilter(tf)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              typeFilter === tf
                ? "bg-aldi-blue text-white"
                : "bg-aldi-muted-light/40 text-aldi-text hover:bg-aldi-muted-light/70"
            }`}
          >
            {tf === "all" ? t("filterAll") : typeLabel(tf as FeedbackType)}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {["all", "new", "read", "archived"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-aldi-blue/10 text-aldi-blue"
                : "text-aldi-muted hover:text-aldi-text"
            }`}
          >
            {s === "all" ? t("filterAll") : t(`status_${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-aldi-muted">{tAdmin("running")}</div>
      ) : feedback.length === 0 ? (
        <div className="py-8 text-center text-sm text-aldi-muted">{t("noFeedback")}</div>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => (
            <div
              key={f.feedback_id}
              className={`rounded-2xl border-2 bg-white p-4 transition-colors ${
                f.status === "new" ? "border-aldi-blue/30" : "border-aldi-muted-light"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {renderRating(f)}
                  <span className="font-medium text-aldi-text">{typeLabel(f.feedback_type)}</span>
                  {f.category && (
                    <span className="rounded-full bg-aldi-muted-light/50 px-2 py-0.5 text-xs text-aldi-muted">
                      {t(`category_${f.category}`)}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-aldi-muted">{formatDate(f.created_at)}</span>
              </div>

              <p className="mt-2 text-sm text-aldi-text">&ldquo;{f.message}&rdquo;</p>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  {f.status === "new" && (
                    <button
                      type="button"
                      onClick={() => updateStatus(f.feedback_id, "read")}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
                    >
                      {t("markRead")}
                    </button>
                  )}
                  {f.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => updateStatus(f.feedback_id, "archived")}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-aldi-muted transition-colors hover:bg-gray-100"
                    >
                      {t("archive")}
                    </button>
                  )}
                </div>
                {f.status !== "new" && (
                  <span className={`text-xs ${f.status === "read" ? "text-aldi-blue" : "text-aldi-muted"}`}>
                    {t(`status_${f.status}`)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > feedback.length && (
        <p className="text-center text-sm text-aldi-muted">
          {t("showingOf", { shown: feedback.length, total })}
        </p>
      )}
    </section>
  );
}
