"use client";

import { useTranslations } from "next-intl";
import { OnboardingScreen } from "../onboarding-screen";

export function ShoppingOrderScreen() {
  const t = useTranslations("onboarding.screens.shopping-order");

  const items = [
    { label: t("item1"), checked: true },
    { label: t("item2"), checked: false },
    { label: t("item3"), checked: false },
  ];

  const illustration = (
    <div className="w-full max-w-[280px] md:max-w-sm">
      {/* GPS badge */}
      <div className="mb-4 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5">
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="text-[13px] font-semibold text-green-700">{t("badgeInStore")}</span>
        </div>
      </div>

      {/* List mockup */}
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-sm">
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-aldi-muted-light" : ""}`}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 ${
                item.checked
                  ? "border-aldi-blue bg-aldi-blue"
                  : "border-aldi-muted-light bg-white"
              }`}>
                {item.checked && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
            </div>
            <span className="flex-1 text-[13px] font-medium text-aldi-muted">
              {i + 1}.
            </span>
            <span className={`flex-[8] text-sm ${item.checked ? "text-aldi-muted line-through" : "font-medium text-aldi-text"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Learning indicator */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-aldi-muted-light">
          <div className="h-full w-[40%] rounded-full bg-aldi-blue transition-all" />
        </div>
        <span className="text-[11px] font-medium text-aldi-muted">Lernfortschritt</span>
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
