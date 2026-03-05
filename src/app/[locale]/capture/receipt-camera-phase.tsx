"use client";

import Image from "next/image";
import type { TranslationValues } from "use-intl";
import type { CapturedPhoto } from "./use-receipt-processing";

interface ReceiptCameraPhaseProps {
  t: (key: string, values?: TranslationValues) => string;
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  photos: CapturedPhoto[];
  onCapture: () => void;
  onRemovePhoto: (id: string) => void;
  onProcess: () => void;
}

export function ReceiptCameraPhase({
  t,
  videoRef,
  cameraReady,
  photos,
  onCapture,
  onRemovePhoto,
  onProcess,
}: ReceiptCameraPhaseProps) {
  return (
    <>
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-sm text-white/60">{t("startingCamera")}</div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[75%] w-[85%] rounded-2xl border-2 border-white/30" />
        </div>
      </div>

      {photos.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 bg-black/90 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {photos.map((photo, idx) => (
              <div key={photo.id} className="relative shrink-0">
                <Image
                  src={photo.dataUrl}
                  alt={`${t("photo")} ${idx + 1}`}
                  width={40}
                  height={56}
                  className="h-14 w-10 rounded-md object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo.id)}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                >
                  ×
                </button>
                <span className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] text-white">
                  {idx + 1}
                </span>
              </div>
            ))}
          </div>
          <span className="ml-auto shrink-0 text-xs text-white/50">
            {t("photoCount", { count: photos.length })}
          </span>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center gap-8 bg-black px-4 py-5">
        <div className="w-16" />
        <button
          type="button"
          onClick={onCapture}
          disabled={!cameraReady}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:opacity-40"
        >
          <div className="h-[60px] w-[60px] rounded-full bg-white" />
        </button>
        {photos.length > 0 ? (
          <button
            type="button"
            onClick={onProcess}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-aldi-blue text-white transition-transform active:scale-90"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>
      <div className="bg-black pb-4 text-center text-xs text-white/40">
        {t("hint")}
      </div>
    </>
  );
}
