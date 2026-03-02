"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function MultiDeviceScreen() {
  const t = useTranslations("onboarding.screens.multi-device");

  const illustration = (
    <div className="w-full max-w-[280px]">
      {/* Devices side by side */}
      <div className="flex items-end justify-center gap-5">
        {/* Phone */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-[90px] w-[48px] flex-col overflow-hidden rounded-lg border-2 border-aldi-muted-light bg-white shadow-sm">
            <div className="flex h-3 items-center justify-center bg-aldi-blue/10">
              <div className="h-1 w-4 rounded-full bg-aldi-muted-light" />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-1.5">
              <div className="h-1.5 w-full rounded-sm bg-aldi-blue/20" />
              <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-1.5 rounded-sm bg-aldi-blue/30" />
                <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light" />
              </div>
              <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-1.5 rounded-sm bg-aldi-blue/30" />
                <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light" />
              </div>
              <div className="flex items-center gap-0.5">
                <div className="h-1.5 w-1.5 rounded-sm bg-aldi-success/40" />
                <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light/60 line-through" />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-medium text-aldi-muted">{t("phone")}</span>
        </div>

        {/* Sync arrows */}
        <div className="mb-8 flex flex-col items-center gap-0.5">
          <svg className="h-4 w-4 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <span className="text-[9px] font-semibold text-aldi-blue">Sync</span>
        </div>

        {/* Desktop / Laptop */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-col items-center">
            <div className="flex h-[62px] w-[80px] flex-col overflow-hidden rounded-t-lg border-2 border-b-0 border-aldi-muted-light bg-white shadow-sm">
              <div className="flex h-3 items-center gap-1 bg-aldi-blue/10 px-1">
                <div className="h-1 w-1 rounded-full bg-red-300" />
                <div className="h-1 w-1 rounded-full bg-yellow-300" />
                <div className="h-1 w-1 rounded-full bg-green-300" />
              </div>
              <div className="flex items-center gap-1 border-b border-aldi-muted-light/50 px-1.5 py-0.5">
                <svg className="h-2 w-2 text-aldi-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-1.5">
                <div className="h-1.5 w-full rounded-sm bg-aldi-blue/20" />
                <div className="flex items-center gap-0.5">
                  <div className="h-1.5 w-1.5 rounded-sm bg-aldi-blue/30" />
                  <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light" />
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="h-1.5 w-1.5 rounded-sm bg-aldi-blue/30" />
                  <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light" />
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="h-1.5 w-1.5 rounded-sm bg-aldi-success/40" />
                  <div className="h-1 flex-1 rounded-sm bg-aldi-muted-light/60 line-through" />
                </div>
              </div>
            </div>
            {/* Laptop base */}
            <div className="h-1.5 w-[92px] rounded-b-md bg-aldi-muted-light" />
          </div>
          <span className="text-[10px] font-medium text-aldi-muted">{t("desktop")}</span>
        </div>
      </div>

      {/* URL bar hint */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-aldi-blue/[0.06] px-4 py-2.5">
        <svg className="h-4 w-4 shrink-0 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        <span className="text-[12px] font-medium text-aldi-blue">{t("urlHint")}</span>
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
