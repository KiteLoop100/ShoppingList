"use client";

import type { TranslationValues } from "use-intl";
import type { CapturedPhoto } from "./use-receipt-processing";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

interface ReceiptFallbackPhaseProps {
  t: (key: string, values?: TranslationValues) => string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  photos: CapturedPhoto[];
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
  onProcess: () => void;
}

export function ReceiptFallbackPhase({
  t,
  fileInputRef,
  photos,
  onFileInput,
  onRemovePhoto,
  onProcess,
}: ReceiptFallbackPhaseProps) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <div className="mb-6 w-full rounded-2xl bg-white/10 p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">{t("fallbackTitle")}</p>
          </div>
          <p className="text-xs leading-relaxed text-white/60">
            {isIOS() ? t("fallbackHintIOS") : t("fallbackHintGeneric")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-4 rounded-2xl bg-aldi-blue p-4 text-white transition-transform active:scale-[0.98]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
          </span>
          <span className="flex flex-col items-start">
            <span className="text-[15px] font-medium">{t("fallbackCaptureButton")}</span>
            <span className="text-xs text-white/60">{t("fallbackCaptureHint")}</span>
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileInput}
          className="hidden"
        />

        {photos.length > 0 && (
          <div className="mt-6 w-full">
            <p className="mb-2 text-xs font-medium text-white/50">
              {t("photoCount", { count: photos.length })}
            </p>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, idx) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.dataUrl}
                    alt={`${t("photo")} ${idx + 1}`}
                    className="h-24 w-[68px] rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(photo.id)}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 pb-8 pt-4">
        {photos.length > 0 && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 rounded-xl bg-white/10 py-3 text-center text-sm font-medium text-white transition-transform active:scale-95"
            >
              {t("fallbackAddMore")}
            </button>
            <button
              type="button"
              onClick={onProcess}
              className="flex-1 rounded-xl bg-aldi-blue py-3 text-center text-sm font-medium text-white transition-transform active:scale-95"
            >
              {t("fallbackDone")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
