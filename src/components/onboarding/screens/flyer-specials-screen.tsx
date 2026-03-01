"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function FlyerSpecialsScreen() {
  const t = useTranslations("onboarding.screens.flyer-specials");

  const illustration = (
    <div className="w-full max-w-[280px] space-y-4">
      {/* Flyer card mockup */}
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        {/* Flyer header */}
        <div className="flex items-center gap-3 border-b border-aldi-muted-light bg-aldi-blue/[0.03] px-4 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aldi-blue/10">
            <svg className="h-4 w-4 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-aldi-text">{t("flyerLabel")}</p>
            <p className="text-[11px] text-aldi-muted">{t("validUntil")}</p>
          </div>
        </div>

        {/* Flyer product items */}
        <div className="divide-y divide-aldi-muted-light/50">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-aldi-orange/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-aldi-text">Bio-Lachs 200g</p>
              <p className="text-[11px] text-aldi-muted">3,99 €</p>
            </div>
            <span className="shrink-0 rounded-lg bg-aldi-blue px-2.5 py-1 text-[11px] font-semibold text-white">
              {t("addToList")}
            </span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-aldi-orange/10" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-aldi-text">Mozzarella 250g</p>
              <p className="text-[11px] text-aldi-muted">1,49 €</p>
            </div>
            <span className="shrink-0 rounded-lg bg-aldi-success/10 px-2.5 py-1 text-[11px] font-semibold text-aldi-success">
              {t("added")} ✓
            </span>
          </div>
        </div>
      </div>

      {/* Deferred section in list mockup */}
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        <div className="flex items-center gap-2 bg-aldi-orange/5 px-4 py-2">
          <svg className="h-3.5 w-3.5 text-aldi-orange" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[12px] font-semibold text-aldi-orange">{t("deferredLabel")}</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-aldi-muted-light bg-white" />
          <span className="flex-1 text-[13px] text-aldi-muted">Mozzarella 250g</span>
          <span className="shrink-0 rounded-md bg-aldi-orange/10 px-2 py-0.5 text-[10px] font-semibold text-aldi-orange">
            {t("badgeSpecial")}
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
      hint={t("hint")}
    />
  );
}
