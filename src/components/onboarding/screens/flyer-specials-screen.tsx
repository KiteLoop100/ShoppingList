"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function FlyerSpecialsScreen() {
  const t = useTranslations("onboarding.screens.flyer-specials");

  const illustration = (
    <div className="w-full max-w-[280px] space-y-4">
      {/* Flyer page mockup with tappable image area */}
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        {/* Flyer header */}
        <div className="flex items-center gap-3 border-b border-aldi-muted-light bg-aldi-blue/[0.03] px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aldi-blue/10">
            <svg className="h-3.5 w-3.5 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-aldi-text">{t("flyerLabel")}</p>
            <p className="text-[10px] text-aldi-muted">{t("validUntil")}</p>
          </div>
        </div>

        {/* Flyer page image area with product tiles */}
        <div className="relative bg-gradient-to-b from-amber-50 to-orange-50/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            {/* Product tile 1 - tappable, with tap indicator */}
            <div className="relative rounded-lg border border-aldi-muted-light bg-white p-2 shadow-sm ring-2 ring-aldi-blue/40">
              <div className="mb-1.5 flex h-10 items-center justify-center rounded bg-orange-100/60">
                <svg className="h-6 w-6 text-orange-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
              <p className="text-[10px] font-medium leading-tight text-aldi-text">Bio-Lachs 200g</p>
              <p className="text-[9px] font-bold text-aldi-blue">3,99 €</p>
              {/* Tap cursor */}
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-aldi-blue shadow-md">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z" />
                </svg>
              </div>
            </div>

            {/* Product tile 2 */}
            <div className="rounded-lg border border-aldi-muted-light bg-white p-2 shadow-sm">
              <div className="mb-1.5 flex h-10 items-center justify-center rounded bg-orange-100/60">
                <svg className="h-6 w-6 text-orange-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
              <p className="text-[10px] font-medium leading-tight text-aldi-text">Mozzarella 250g</p>
              <p className="text-[9px] font-bold text-aldi-blue">1,49 €</p>
            </div>
          </div>

          {/* "Add to list" button appearing below tapped product */}
          <div className="mt-2 flex items-center justify-between rounded-lg bg-aldi-blue px-3 py-1.5">
            <span className="text-[11px] font-medium text-white">Bio-Lachs 200g</span>
            <span className="text-[11px] font-semibold text-white">{t("addToList")} +</span>
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
