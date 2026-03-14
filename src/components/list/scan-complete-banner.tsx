"use client";

import { useTranslations } from "next-intl";

interface ScanCompleteBannerProps {
  onContinueScanning: () => void;
  onFinishTrip: () => void;
}

export function ScanCompleteBanner({
  onContinueScanning,
  onFinishTrip,
}: ScanCompleteBannerProps) {
  const t = useTranslations("list");

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={t("scanCompleteBannerTitle")}
    >
      <div className="w-full max-w-lg animate-slide-up rounded-t-2xl bg-white px-6 pb-8 pt-6 shadow-2xl md:max-w-2xl">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">
            ✅
          </span>
          <div>
            <h2 className="text-base font-semibold text-aldi-text">
              {t("scanCompleteBannerTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-aldi-muted">
              {t("scanCompleteBannerSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onContinueScanning}
            className="touch-target flex-1 rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 text-sm font-semibold text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          >
            {t("scanCompleteContinue")}
          </button>
          <button
            type="button"
            onClick={onFinishTrip}
            className="touch-target flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90"
          >
            {t("scanCompleteFinish")}
          </button>
        </div>
      </div>
    </div>
  );
}
