"use client";

import { useRef } from "react";
import Image from "next/image";
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
  maxPhotos: number;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
  onProcess: () => void;
}

export function ReceiptFallbackPhase({
  t,
  fileInputRef,
  photos,
  maxPhotos,
  onFileInput,
  onRemovePhoto,
  onProcess,
}: ReceiptFallbackPhaseProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const atLimit = photos.length >= maxPhotos;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 pt-8">
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

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={atLimit}
            className="flex w-full items-center gap-4 rounded-2xl bg-aldi-blue p-4 text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[15px] font-medium">{t("fallbackGalleryButton")}</span>
              <span className="text-xs text-white/60">{t("fallbackGalleryHint")}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={atLimit}
            className="flex w-full items-center gap-4 rounded-2xl bg-white/10 p-4 text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
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
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFileInput}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInput}
          className="hidden"
        />

        {photos.length > 0 && (
          <div className="mt-6 w-full pb-2">
            <p className="mb-2 text-xs font-medium text-white/50">
              {t("photoCount", { count: photos.length })}
            </p>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, idx) => (
                <div key={photo.id} className="relative">
                  <Image
                    src={photo.dataUrl}
                    alt={`${t("photo")} ${idx + 1}`}
                    width={68}
                    height={96}
                    className="h-24 w-[68px] rounded-xl object-cover"
                    unoptimized
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

      <div className="shrink-0 px-6 pb-8 pt-3">
        {photos.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onProcess}
              className="w-full rounded-xl bg-aldi-blue py-3.5 text-center text-[15px] font-semibold text-white transition-transform active:scale-95"
            >
              {t("fallbackDone")}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={atLimit}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-center text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                {t("fallbackAddMoreGallery")}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={atLimit}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-center text-sm font-medium text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                {t("fallbackAddMore")}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
