"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function ReceiptHistoryScreen() {
  const t = useTranslations("onboarding.screens.receipt-history");

  const illustration = (
    <div className="w-full max-w-[280px] md:max-w-sm">
      {/* Receipt card mockup */}
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        {/* Receipt header with camera icon */}
        <div className="flex items-center gap-3 border-b border-aldi-muted-light bg-aldi-blue/[0.03] px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aldi-blue/10">
            <svg className="h-5 w-5 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-aldi-text">{t("receiptLabel")}</p>
            <p className="text-[12px] text-aldi-muted">ALDI SÜD · 28.02.2026</p>
          </div>
        </div>

        {/* Receipt items */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[13px] text-aldi-muted">{t("itemCount")}</span>
          </div>
          <div className="border-t border-dashed border-aldi-muted-light pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-aldi-text">{t("totalLabel")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline / history visualization */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {[0.3, 0.5, 0.7, 1].map((opacity, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-aldi-blue"
              style={{ opacity }}
            >
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
              </svg>
            </div>
            {i < 3 && <div className="h-0.5 w-3 bg-aldi-muted-light" />}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-aldi-muted">
        Bessere Vorschläge mit jedem Einkauf
      </p>
    </div>
  );

  return (
    <OnboardingScreen
      illustration={illustration}
      title={t("title")}
      text={t("text")}
    />
  );
}
