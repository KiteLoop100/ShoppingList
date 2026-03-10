"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  getRetailerReceiptSummary,
  type RetailerReceiptSummary,
} from "@/lib/list/receipt-purchase-menu";
import { buildReceiptCommand, CONSUMED_COMMAND } from "@/lib/search/commands";
import { getLastReceiptChangeTs } from "@/lib/receipts/receipt-cache-signal";
import { isInventoryEnabled, loadSettings } from "@/lib/settings/settings-sync";

export interface MenuSelection {
  command: string;
  label: string;
}

interface PurchaseHistoryMenuProps {
  onSelect: (selection: MenuSelection) => void;
}

interface MenuItem {
  label: string;
  command: string;
}


function buildMenuItems(
  summary: RetailerReceiptSummary,
  t: (key: string, values?: Record<string, unknown>) => string,
): MenuItem[] {
  const { retailer, receiptCount } = summary;
  const items: MenuItem[] = [];

  items.push({
    label: t("purchaseMenuLastTrip"),
    command: buildReceiptCommand(retailer, "single", 0),
  });

  if (receiptCount >= 2) {
    items.push({
      label: t("purchaseMenuSecondLast"),
      command: buildReceiptCommand(retailer, "single", 1),
    });
  }

  if (receiptCount >= 3) {
    items.push({
      label: t("purchaseMenuThirdLast"),
      command: buildReceiptCommand(retailer, "single", 2),
    });
  }

  if (receiptCount >= 2) {
    items.push({
      label: t("purchaseMenuLastN", { count: 2 }),
      command: buildReceiptCommand(retailer, "combined", 2),
    });
  }

  if (receiptCount >= 3) {
    items.push({
      label: t("purchaseMenuLastN", { count: 3 }),
      command: buildReceiptCommand(retailer, "combined", 3),
    });
  }

  if (receiptCount >= 4) {
    items.push({
      label: t("purchaseMenuLastN", { count: 4 }),
      command: buildReceiptCommand(retailer, "combined", 4),
    });

    items.push({
      label: t("purchaseMenuNotRecently"),
      command: buildReceiptCommand(retailer, "not-recently", 0),
    });
  }

  return items;
}

export function PurchaseHistoryMenu({ onSelect }: PurchaseHistoryMenuProps) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [summaries, setSummaries] = useState<RetailerReceiptSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [invEnabled, setInvEnabled] = useState(isInventoryEnabled());
  const menuRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<{ data: RetailerReceiptSummary[]; ts: number } | null>(null);

  useEffect(() => {
    loadSettings().then((s) => setInvEnabled(s.enable_inventory));
  }, []);

  const loadSummaries = useCallback(async () => {
    const changeTs = getLastReceiptChangeTs();

    if (cacheRef.current) {
      // Immediately show stale data — no spinner, no wait
      setSummaries(cacheRef.current.data);
      // No new receipt since last load → nothing to revalidate
      if (cacheRef.current.ts > changeTs) return;
    } else {
      setLoading(true);
    }

    // Revalidate in background (or initial load)
    try {
      const data = await getRetailerReceiptSummary();
      cacheRef.current = { data, ts: Date.now() };
      setSummaries(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setOpen((prev) => {
        const next = !prev;
        if (next) loadSummaries();
        return next;
      });
    },
    [loadSummaries],
  );

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleItemClick = useCallback(
    (command: string, label: string, displayName: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      onSelect({ command, label: `${displayName} — ${label}` });
    },
    [onSelect],
  );

  const sections = useMemo(() => {
    if (!summaries) return [];
    return summaries.map((s) => ({
      summary: s,
      items: buildMenuItems(s, t as (key: string, values?: Record<string, unknown>) => string),
    }));
  }, [summaries, t]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex shrink-0 items-center gap-1 rounded-full border border-aldi-muted-light bg-gray-50 px-2 py-0.5 text-[10px] text-aldi-muted transition-colors hover:border-aldi-blue/50 hover:text-aldi-blue"
      >
        <span>{t("purchaseMenuLabel")}</span>
        <svg
          className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[60vh] min-w-[220px] overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          role="menu"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
              <span className="text-xs text-aldi-muted">{t("purchaseMenuLoading")}</span>
            </div>
          ) : sections.length === 0 ? (
            <div className="px-3 py-3 text-xs text-aldi-muted">
              {t("purchaseMenuEmpty")}
            </div>
          ) : (
            <>
              {sections.map(({ summary, items }) => (
                <div key={summary.retailer}>
                  <div className="sticky top-0 z-[1] border-b border-gray-100 bg-gray-50 px-3 py-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-aldi-blue">
                      {summary.displayName}
                    </span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.command}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center px-3 py-2 text-left text-[13px] text-aldi-text transition-colors hover:bg-gray-50 active:bg-gray-100"
                      onClick={handleItemClick(item.command, item.label, summary.displayName)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
              {invEnabled && (
                <>
                  <div className="border-t border-gray-200" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-aldi-text transition-colors hover:bg-gray-50 active:bg-gray-100"
                    onClick={handleItemClick(CONSUMED_COMMAND, t("purchaseMenuConsumed" as never), "")}
                  >
                    <svg className="h-4 w-4 text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                    {t("purchaseMenuConsumed" as never)}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
