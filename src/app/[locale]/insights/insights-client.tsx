"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { TopicCard } from "@/components/insights/topic-card";
import { InsightResult } from "@/components/insights/insight-result";
import type { InsightResponse, InsightTopic } from "@/lib/insights/types";
import { log } from "@/lib/utils/logger";

type PageState = "checking" | "onboarding" | "idle" | "loading" | "result" | "error";
const MIN_RECEIPTS = 3, SPARSE_RECEIPTS = 5, COOLDOWN_SECONDS = 10, LOOKBACK_DAYS = 90;

const TOPICS: { topic: InsightTopic; icon: string; titleKey: string; descKey: string }[] = [
  { topic: "savings", icon: "💰", titleKey: "topicSavings", descKey: "topicSavingsDesc" },
  { topic: "nutrition", icon: "🥗", titleKey: "topicHealth", descKey: "topicHealthDesc" },
  { topic: "nutrition_analysis", icon: "📊", titleKey: "topicNutrition", descKey: "topicNutritionDesc" },
  { topic: "spending", icon: "💶", titleKey: "topicSpending", descKey: "topicSpendingDesc" },
  { topic: "habits", icon: "🛒", titleKey: "topicHabits", descKey: "topicHabitsDesc" },
];

const backChevron = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

export function InsightsClient() {
  const t = useTranslations("insights");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<PageState>("checking");
  const [receiptCount, setReceiptCount] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<InsightTopic | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [householdSize, setHouseholdSize] = useState(() => {
    if (typeof window === "undefined") return 2;
    const stored = localStorage.getItem("insights_household_size");
    return stored ? parseInt(stored, 10) || 2 : 2;
  });
  const [result, setResult] = useState<InsightResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const customInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    checkDataAvailability();
  }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  async function checkDataAvailability() {
    const supabase = createClientIfConfigured();
    if (!supabase) { setState("idle"); return; }
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
      const { count, error } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .gte("purchase_date", cutoff.toISOString().slice(0, 10));
      if (error) { log.warn("[insights] receipt count query failed:", error.message); setState("idle"); return; }
      const c = count ?? 0;
      setReceiptCount(c);
      setState(c < MIN_RECEIPTS ? "onboarding" : "idle");
    } catch (err) {
      log.warn("[insights] receipt count check failed:", err);
      setState("idle");
    }
  }

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); cooldownRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTopic) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState("loading");
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic,
          custom_query: selectedTopic === "custom" ? customQuery : undefined,
          locale,
          household_size: selectedTopic === "nutrition_analysis" ? householdSize : undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setErrorMessage(res.status === 429 ? t("errorRateLimit") : t("errorUnavailable"));
        setState("error");
        return;
      }
      const data = (await res.json()) as InsightResponse;
      setResult(data);
      setState("result");
      startCooldown();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setErrorMessage(t("errorUnavailable"));
      setState("error");
    }
  }, [selectedTopic, customQuery, locale, householdSize, t, startCooldown]);

  const handleNewAnalysis = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setResult(null);
    setSelectedTopic(null);
    setCustomQuery("");
  }, []);

  const handleFollowUp = useCallback((suggestion: string) => {
    setSelectedTopic("custom");
    setCustomQuery(suggestion);
    setState("idle");
    setResult(null);
    setTimeout(() => customInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, []);

  const handleHouseholdSizeChange = useCallback((size: number) => {
    const clamped = Math.max(1, Math.min(8, size));
    setHouseholdSize(clamped);
    localStorage.setItem("insights_household_size", String(clamped));
  }, []);

  const canGenerate = state === "idle" && selectedTopic !== null
    && (selectedTopic !== "custom" || customQuery.trim().length > 0);
  const showBackToTopics = state === "loading" || state === "result" || state === "error";
  const backBtnClass = "touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light";

  return (
    <div className="mx-auto max-w-lg">
      {state !== "checking" && (
        <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          {showBackToTopics ? (
            <button type="button" onClick={handleNewAnalysis} className={backBtnClass} aria-label={tCommon("back")}>
              {backChevron}
            </button>
          ) : (
            <Link href="/" className={backBtnClass} aria-label={tCommon("back")}>
              {backChevron}
            </Link>
          )}
          <h1 className="text-[17px] font-semibold tracking-tight text-aldi-text">{t("pageTitle")}</h1>
        </header>
      )}

      {state === "checking" && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-aldi-muted">{t("loading")}</p>
        </div>
      )}

      {state === "onboarding" && (
        <div className="px-4 py-12 text-center">
          <p className="mt-4 text-aldi-muted">{t("onboardingTitle")}</p>
          <p className="mt-2 text-sm text-aldi-muted">{t("onboardingHint")}</p>
          <Link
            href="/capture"
            className="mt-6 inline-block rounded-lg bg-aldi-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90"
          >
            {t("onboardingScanButton")}
          </Link>
        </div>
      )}

      {state === "result" && result && (
        <div className="px-4 pt-4 pb-6">
          <InsightResult
            result={result}
            onNewAnalysis={handleNewAnalysis}
            onFollowUp={handleFollowUp}
            cooldownSeconds={cooldown}
            t={t}
          />
        </div>
      )}

      {state === "error" && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-red-600">{errorMessage}</p>
          <button
            type="button"
            onClick={handleNewAnalysis}
            className="mt-4 rounded-lg bg-aldi-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90"
          >
            {t("retryButton")}
          </button>
        </div>
      )}

      {(state === "idle" || state === "loading") && (
        <div className="px-4 py-6">
          <p className="text-sm text-aldi-muted">{t("subtitle")}</p>
          {receiptCount > 0 && receiptCount <= SPARSE_RECEIPTS && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t("sparseDataHint")}</div>
          )}
          <div className="mt-4 space-y-3">
            {TOPICS.map((item) => (
              <TopicCard
                key={item.topic}
                icon={item.icon}
                title={t(item.titleKey)}
                description={t(item.descKey)}
                selected={selectedTopic === item.topic}
                onClick={() => setSelectedTopic(item.topic)}
              />
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-aldi-text">{t("customLabel")}</p>
            <textarea
              ref={customInputRef}
              value={customQuery}
              onChange={(e) => { setCustomQuery(e.target.value); if (selectedTopic !== "custom") setSelectedTopic("custom"); }}
              onFocus={() => setSelectedTopic("custom")}
              placeholder={t("customPlaceholder")}
              maxLength={500}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
            />
          </div>
          {selectedTopic === "nutrition_analysis" && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm text-aldi-muted">{t("householdSizeLabel")}:</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleHouseholdSizeChange(householdSize - 1)} disabled={householdSize <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm disabled:opacity-30">-</button>
                <span className="w-6 text-center text-sm font-medium">{householdSize}</span>
                <button type="button" onClick={() => handleHouseholdSizeChange(householdSize + 1)} disabled={householdSize >= 8} className="flex h-8 w-8 items-center justify-center rounded-lg border text-sm disabled:opacity-30">+</button>
                <span className="text-xs text-aldi-muted">{t("householdSizeUnit")}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="mt-6 w-full rounded-lg bg-aldi-blue py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
          >
            {state === "loading" ? t("loading") : t("generateButton")}
          </button>
          <p className="mt-4 text-center text-[11px] text-aldi-muted">{t("privacyNote")}</p>
        </div>
      )}
    </div>
  );
}
