"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function SearchScreen() {
  const t = useTranslations("onboarding.screens.search");

  const illustration = (
    <div className="w-full max-w-[280px] md:max-w-sm">
      {/* Search bar mockup */}
      <div className="rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-[15px] text-aldi-text">{t("searchPlaceholder")}</span>
          <div className="ml-auto h-5 w-0.5 animate-pulse bg-aldi-blue" />
        </div>
      </div>

      {/* Results dropdown */}
      <div className="mt-1 overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-lg">
        {/* Specific result */}
        <div className="flex items-center gap-3 border-b border-aldi-muted-light px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aldi-blue/10">
            <svg className="h-4 w-4 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-aldi-text">{t("resultSpecific")}</p>
          </div>
          <span className="shrink-0 rounded-md bg-aldi-blue/10 px-2 py-0.5 text-[11px] font-semibold text-aldi-blue">
            {t("badgeSpecific")}
          </span>
        </div>

        {/* Generic result */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aldi-orange/10">
            <svg className="h-4 w-4 text-aldi-orange" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-aldi-text">{t("resultGeneric")}</p>
          </div>
          <span className="shrink-0 rounded-md bg-aldi-orange/10 px-2 py-0.5 text-[11px] font-semibold text-aldi-orange">
            {t("badgeGeneric")}
          </span>
        </div>
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
