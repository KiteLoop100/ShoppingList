"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { formatDateCompact } from "@/lib/utils/format-date";
import { ReceiptScanner } from "@/app/[locale]/capture/receipt-scanner";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getRetailerByName } from "@/lib/retailers/retailers";

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

export function ReceiptsClientPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const loadReceipts = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const userId = getCurrentUserId();
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "receipt_id, store_name, retailer, purchase_date, purchase_time, total_amount, items_count, created_at"
      )
      .eq("user_id", userId)
      .order("purchase_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReceipts(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

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

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
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
          {t("title")}
        </h1>
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col gap-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light">
              <svg
                className="h-8 w-8 text-aldi-blue"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"
                />
              </svg>
            </div>
            <p className="text-sm text-aldi-muted">{t("empty")}</p>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="mt-2 rounded-xl bg-aldi-blue px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
            >
              {t("scanFirst")}
            </button>
          </div>
        ) : (
          <>
            {showFilterBar && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveFilter(null)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeFilter === null
                      ? "bg-aldi-blue text-white"
                      : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  {t("allRetailers")}
                </button>
                {retailerChips.map((chip) => {
                  const cfg = getRetailerByName(chip.key);
                  const isActive = activeFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setActiveFilter(chip.key)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? cfg
                            ? cfg.color
                            : "bg-aldi-blue text-white"
                          : "bg-white text-aldi-text shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                      }`}
                    >
                      {chip.label}
                      <span className="ml-1 opacity-60">{chip.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredReceipts.length === 0 && activeFilter ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16">
                <p className="text-sm text-aldi-muted">
                  {t("noReceiptsForRetailer", { retailer: activeFilter })}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredReceipts.map((receipt) => {
                  const retailerCfg = receipt.retailer
                    ? getRetailerByName(receipt.retailer)
                    : null;

                  return (
                    <Link
                      key={receipt.receipt_id}
                      href={`/receipts/${receipt.receipt_id}` as never}
                      className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98] pointer-fine:hover:shadow-md pointer-fine:hover:border-aldi-blue/20"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue-light text-aldi-blue">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.75}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"
                          />
                        </svg>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-baseline gap-2">
                          <span className="text-[15px] font-medium text-aldi-text">
                            {formatDateCompact(receipt.purchase_date, "de", t("unknownDate"))}
                          </span>
                          {receipt.purchase_time && (
                            <span className="text-xs text-aldi-muted">
                              {formatTime(receipt.purchase_time)}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-aldi-muted">
                          {retailerCfg ? (
                            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${retailerCfg.color}`}>
                              {retailerCfg.name}
                            </span>
                          ) : receipt.store_name ? (
                            <span>{receipt.store_name}</span>
                          ) : null}
                          <span>
                            {t("itemCount", { count: receipt.items_count })}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        {typeof receipt.total_amount === "number" ? (
                          <span className="text-[15px] font-semibold text-aldi-text">
                            {receipt.total_amount.toFixed(2)} €
                          </span>
                        ) : (
                          <span className="text-sm text-aldi-muted">—</span>
                        )}
                      </span>
                      <svg
                        className="h-4 w-4 shrink-0 text-aldi-muted opacity-40 transition-opacity group-hover:opacity-70"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ReceiptScanner
        open={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          loadReceipts();
        }}
      />
    </main>
  );
}
