"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { formatDateCompact } from "@/lib/utils/format-date";
import { ReceiptScanner } from "@/app/[locale]/capture/receipt-scanner";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getRetailerByName } from "@/lib/retailers/retailers";
import { loadSettings } from "@/lib/settings/settings-sync";
import { InventoryList } from "@/components/inventory/inventory-list";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { ReceiptDetailContent } from "@/app/[locale]/receipts/receipt-detail-content";
import { log } from "@/lib/utils/logger";

const POLL_INTERVAL_MS = 8_000;
const MAX_POLL_COUNT = 45;
const STALE_THRESHOLD_MS = 6 * 60 * 1000;

interface ReceiptSummary {
  receipt_id: string;
  store_name: string | null;
  retailer: string | null;
  purchase_date: string | null;
  purchase_time: string | null;
  total_amount: number | null;
  items_count: number;
  created_at: string;
}

interface PendingScan {
  scanId: string;
  status: "processing" | "completed" | "failed";
  errorCode?: string;
  photoUrls: string[];
  photoPaths: string[];
}

type ActiveTab = "receipts" | "inventory";

function getErrorMessage(
  tReceipt: (key: string) => string,
  errorCode?: string,
): string {
  switch (errorCode) {
    case "timeout": return tReceipt("processingTimeout");
    case "ocr_failed": return tReceipt("ocrFailed");
    case "not_a_receipt": return tReceipt("notAReceipt");
    case "unsupported_retailer": return tReceipt("unsupportedRetailer");
    default: return tReceipt("processingFailed");
  }
}

export function ReceiptsClientPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const tReceipt = useTranslations("receipt");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [inventoryActive, setInventoryActive] = useState(false);
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ActiveTab>(tabParam === "inventory" ? "inventory" : "receipts");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? getCurrentUserId();

    const { data: rawData, error } = await supabase
      .from("receipts")
      .select(
        "receipt_id, store_name, retailer, purchase_date, purchase_time, total_amount, items_count, created_at"
      )
      .eq("user_id", userId)
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!error && rawData) {
      setReceipts(rawData as ReceiptSummary[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    loadSettings().then((s) => {
      setInventoryActive(s.enable_inventory);
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  const pollScanStatus = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? getCurrentUserId();

    const { data: latestCompleted } = await supabase
      .from("receipt_scans")
      .select("created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);

    let query = supabase
      .from("receipt_scans")
      .select("scan_id, status, error_code, photo_urls, photo_paths, created_at")
      .eq("user_id", userId)
      .in("status", ["processing", "failed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestCompleted && latestCompleted.length > 0) {
      query = query.gt("created_at", latestCompleted[0].created_at);
    }

    const { data: scans } = await query;

    if (!scans || scans.length === 0) {
      setPendingScan(null);
      stopPolling();
      await loadReceipts();
      return;
    }

    const scan = scans[0];
    const age = Date.now() - new Date(scan.created_at).getTime();

    if (scan.status === "processing" && age > STALE_THRESHOLD_MS) {
      await supabase
        .from("receipt_scans")
        .update({ status: "failed", error_code: "timeout", updated_at: new Date().toISOString() })
        .eq("scan_id", scan.scan_id);

      setPendingScan({
        scanId: scan.scan_id,
        status: "failed",
        errorCode: "timeout",
        photoUrls: scan.photo_urls,
        photoPaths: scan.photo_paths,
      });
      stopPolling();
      return;
    }

    if (scan.status === "failed") {
      setPendingScan({
        scanId: scan.scan_id,
        status: "failed",
        errorCode: scan.error_code ?? undefined,
        photoUrls: scan.photo_urls,
        photoPaths: scan.photo_paths,
      });
      stopPolling();
      return;
    }

    setPendingScan({
      scanId: scan.scan_id,
      status: "processing",
      photoUrls: scan.photo_urls,
      photoPaths: scan.photo_paths,
    });
  }, [loadReceipts, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setPendingScan({ scanId: "", status: "processing", photoUrls: [], photoPaths: [] });

    pollTimerRef.current = setInterval(async () => {
      pollCountRef.current++;
      await pollScanStatus();
      await loadReceipts();
    }, POLL_INTERVAL_MS);
  }, [loadReceipts, pollScanStatus, stopPolling]);

  const retryProcessing = useCallback(async () => {
    if (!pendingScan || retrying) return;
    setRetrying(true);

    const supabase = createClientIfConfigured();
    if (supabase) {
      await supabase
        .from("receipt_scans")
        .update({ status: "completed", error_code: "dismissed", updated_at: new Date().toISOString() })
        .eq("scan_id", pendingScan.scanId);
    }

    try {
      const res = await fetch("/api/process-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_urls: pendingScan.photoUrls,
          photo_paths: pendingScan.photoPaths,
        }),
      });

      if (!res.ok) {
        log.warn("[receipts] retry process-receipt failed:", res.status);
      }
    } catch (err) {
      log.warn("[receipts] retry fetch error:", err);
    }

    setRetrying(false);
    startPolling();
  }, [pendingScan, retrying, startPolling]);

  const dismissScan = useCallback(async () => {
    if (!pendingScan) return;

    const supabase = createClientIfConfigured();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? getCurrentUserId();

      await supabase
        .from("receipt_scans")
        .update({ status: "completed", error_code: "dismissed", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "failed");
    }

    setPendingScan(null);
  }, [pendingScan]);

  useEffect(() => {
    pollScanStatus();
  }, [pollScanStatus]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const retailerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of receipts) {
      const key = r.retailer || "?";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [receipts]);

  const retailerChips = useMemo(() => {
    const chips: { key: string; label: string; count: number }[] = [];
    for (const [key, count] of retailerCounts) {
      if (key === "?") continue;
      chips.push({ key, label: key, count });
    }
    chips.sort((a, b) => b.count - a.count);
    return chips;
  }, [retailerCounts]);

  const showFilterBar = retailerChips.length > 1;

  const filteredReceipts = useMemo(() => {
    if (!activeFilter) return receipts;
    return receipts.filter((r) => r.retailer === activeFilter);
  }, [receipts, activeFilter]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
  };

  const receiptListContent = loading ? (
    <div className="flex flex-col gap-2">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  ) : receipts.length === 0 && !pendingScan ? (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 lg:gap-5 lg:py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light lg:h-20 lg:w-20">
        <svg className="h-8 w-8 text-aldi-blue lg:h-10 lg:w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
        </svg>
      </div>
      <p className="text-sm text-aldi-muted lg:text-base">{t("empty")}</p>
      <button type="button" onClick={() => setScannerOpen(true)} className="mt-2 rounded-xl bg-aldi-blue px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-95 lg:px-6 lg:py-3 lg:text-base">
        {t("scanFirst")}
      </button>
    </div>
  ) : (
    <>
      {showFilterBar && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button type="button" onClick={() => setActiveFilter(null)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${activeFilter === null ? "bg-aldi-blue text-white" : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
            {t("allRetailers")}
          </button>
          {retailerChips.map((chip) => {
            const cfg = getRetailerByName(chip.key);
            const isActive = activeFilter === chip.key;
            return (
              <button key={chip.key} type="button" onClick={() => setActiveFilter(chip.key)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${isActive ? (cfg ? cfg.color : "bg-aldi-blue text-white") : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"}`}>
                {chip.label}
                <span className="ml-1 opacity-60">{chip.count}</span>
              </button>
            );
          })}
        </div>
      )}
      {filteredReceipts.length === 0 && !pendingScan && activeFilter ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16">
          <p className="text-sm text-aldi-muted">{t("noReceiptsForRetailer", { retailer: activeFilter })}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pendingScan?.status === "processing" && (
            <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-aldi-blue/30 bg-aldi-blue-light/50 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue/10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-aldi-blue/20 border-t-aldi-blue" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-medium text-aldi-blue">{tReceipt("pendingTitle")}</span>
                <span className="text-xs leading-relaxed text-aldi-muted">{tReceipt("pendingPlaceholder")}</span>
              </span>
            </div>
          )}
          {pendingScan?.status === "failed" && (
            <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-red-300 bg-red-50 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[15px] font-medium text-red-700">{tReceipt("pendingFailed")}</span>
                <span className="text-xs leading-relaxed text-red-600/70">{getErrorMessage(tReceipt, pendingScan.errorCode)}</span>
                <span className="mt-1 flex gap-2">
                  {pendingScan.errorCode !== "not_a_receipt" && (
                    <button
                      type="button"
                      onClick={retryProcessing}
                      disabled={retrying}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {retrying ? tReceipt("pendingTitle") : tReceipt("retryProcessing")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={dismissScan}
                    className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 transition-transform active:scale-95"
                  >
                    {tReceipt("close")}
                  </button>
                </span>
              </span>
            </div>
          )}
          {filteredReceipts.map((receipt) => {
            const retailerCfg = receipt.retailer ? getRetailerByName(receipt.retailer) : null;
            const isSelected = isDesktop && selectedReceiptId === receipt.receipt_id;
            const cardContent = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue-light text-aldi-blue">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
                  </svg>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[15px] font-medium text-aldi-text">{formatDateCompact(receipt.purchase_date, "de", t("unknownDate"))}</span>
                    {receipt.purchase_time && <span className="text-xs text-aldi-muted">{formatTime(receipt.purchase_time)}</span>}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-aldi-muted">
                    {retailerCfg ? (
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${retailerCfg.color}`}>{retailerCfg.name}</span>
                    ) : receipt.store_name ? <span>{receipt.store_name}</span> : null}
                    <span>{t("itemCount", { count: receipt.items_count })}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {typeof receipt.total_amount === "number" ? (
                    <span className="text-[15px] font-semibold text-aldi-text">{receipt.total_amount.toFixed(2)} €</span>
                  ) : (
                    <span className="text-sm text-aldi-muted">—</span>
                  )}
                </span>
              </>
            );
            if (isDesktop) {
              return (
                <button key={receipt.receipt_id} type="button" onClick={() => setSelectedReceiptId(receipt.receipt_id)}
                  className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all pointer-fine:hover:shadow-md ${isSelected ? "bg-aldi-blue/5 ring-2 ring-aldi-blue/30" : "bg-white"}`}>
                  {cardContent}
                </button>
              );
            }
            return (
              <Link key={receipt.receipt_id} href={`/receipts/${receipt.receipt_id}` as never}
                className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98] pointer-fine:hover:shadow-md pointer-fine:hover:border-aldi-blue/20">
                {cardContent}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-2xl lg:h-[calc(100vh-49px)] lg:max-w-none">
      <header className="sticky top-0 z-10 shrink-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3 px-5 py-4 md:px-6 lg:px-8">
          <Link
            href="/"
            className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
            aria-label={tCommon("back")}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </Link>
          <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">
            {inventoryActive ? t("householdTitle") : t("title")}
          </h1>
          {!(inventoryActive && activeTab === "inventory") && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="touch-target flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
              aria-label={t("scanNew")}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
            </button>
          )}
        </div>
        {inventoryActive && (
          <div className="flex border-t border-aldi-muted-light">
            <button
              type="button"
              onClick={() => setActiveTab("receipts")}
              className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
                activeTab === "receipts"
                  ? "border-b-2 border-aldi-blue text-aldi-blue"
                  : "text-aldi-muted hover:text-aldi-text"
              }`}
            >
              {t("tabReceipts")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`flex-1 py-2.5 text-center text-sm font-medium transition-colors ${
                activeTab === "inventory"
                  ? "border-b-2 border-aldi-blue text-aldi-blue"
                  : "text-aldi-muted hover:text-aldi-text"
              }`}
            >
              {t("tabInventory")}
            </button>
          </div>
        )}
      </header>

      {inventoryActive && activeTab === "inventory" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <InventoryList />
        </div>
      ) : isDesktop ? (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 w-[380px] shrink-0 overflow-auto border-r border-aldi-muted-light p-4">
          {receiptListContent}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {selectedReceiptId ? (
            <ReceiptDetailContent key={selectedReceiptId} receiptId={selectedReceiptId} showBackLink={false} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-aldi-muted">
              <svg className="h-10 w-10 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
              </svg>
              <p className="text-sm">{t("selectReceipt")}</p>
            </div>
          )}
        </div>
      </div>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">
        {receiptListContent}
      </div>
      )}

      <ReceiptScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          loadReceipts();
        }}
        onSubmitted={startPolling}
      />
    </main>
  );
}
