"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function ProductDetailScreen() {
  const t = useTranslations("onboarding.screens.product-detail");

  const illustration = (
    <div className="w-full max-w-[280px]">
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        {/* Product header */}
        <div className="flex items-center gap-3 border-b border-aldi-muted-light px-4 py-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aldi-blue/10">
            <svg className="h-6 w-6 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-aldi-text">Milch 3,5% 1L</p>
            <p className="text-[13px] text-aldi-muted">MILSANI</p>
          </div>
          <span className="shrink-0 text-lg font-bold text-aldi-blue">{t("price")}</span>
        </div>

        {/* Detail rows */}
        <div className="space-y-0">
          <div className="flex items-center gap-3 border-b border-aldi-muted-light/50 px-4 py-2.5">
            <div className="h-2 w-2 rounded-full bg-aldi-muted-light" />
            <span className="text-[13px] text-aldi-muted">Nährwerte, Zutaten, Allergene</span>
          </div>
        </div>

        {/* Reorder toggle */}
        <div className="flex items-center gap-3 bg-aldi-blue/[0.03] px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-aldi-blue">{t("reorderLabel")}</p>
            <p className="text-[12px] text-aldi-muted">{t("every")}</p>
          </div>
          <div className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-aldi-blue">
            <div className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
          </div>
        </div>
      </div>

      {/* Tap hint */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <svg className="h-4 w-4 text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
        </svg>
        <span className="text-[12px] text-aldi-muted">Tippe auf ein Produkt</span>
      </div>
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
