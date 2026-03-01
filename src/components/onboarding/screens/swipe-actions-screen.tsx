"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function SwipeActionsScreen() {
  const t = useTranslations("onboarding.screens.swipe-actions");

  const illustration = (
    <div className="w-full max-w-[280px] space-y-4">
      {/* Swipe left demo */}
      <div className="relative overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        <div className="flex items-center">
          <div className="flex flex-1 items-center gap-3 px-4 py-3" style={{ transform: "translateX(-30px)" }}>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-aldi-muted-light bg-white" />
            <span className="text-sm font-medium text-aldi-text">{t("exampleProduct")}</span>
          </div>
          <div className="flex h-full w-[60px] shrink-0 items-center justify-center bg-red-500 py-3">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
        </div>
        {/* Arrow indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="text-[11px] font-bold text-red-400">← {t("swipeLeft")}</span>
        </div>
      </div>

      {/* Swipe right demos */}
      <div className="relative overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        <div className="flex items-center">
          <div className="flex w-[60px] shrink-0 items-center justify-center bg-aldi-blue py-3">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex w-[60px] shrink-0 items-center justify-center bg-aldi-orange py-3">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0A2.997 2.997 0 017.5 6.2l.4-2.8A.75.75 0 018.638 3h6.724a.75.75 0 01.742.55l.4 2.8a2.997 2.997 0 014.496.15" />
            </svg>
          </div>
          <div className="flex flex-1 items-center gap-3 px-4 py-3" style={{ transform: "translateX(20px)" }}>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-aldi-muted-light bg-white" />
            <span className="text-sm font-medium text-aldi-text">{t("exampleProduct")}</span>
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-2">
        <div className="flex flex-col items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-aldi-blue" />
          <span className="text-[11px] font-medium text-aldi-blue">{t("swipeRight")}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-aldi-orange" />
          <span className="text-[11px] font-medium text-aldi-orange">{t("swipeFarRight")}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-red-500">{t("swipeLeft")}</span>
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
