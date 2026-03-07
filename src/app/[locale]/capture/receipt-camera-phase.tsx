"use client";

import Image from "next/image";
import type { TranslationValues } from "use-intl";
import type { CapturedPhoto } from "./use-receipt-processing";

interface ReceiptCameraPhaseProps {
  t: (key: string, values?: TranslationValues) => string;
  videoRef: React.RefObject<HTMLVideoElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  cameraReady: boolean;
  photos: CapturedPhoto[];
  maxPhotos: number;
  onCapture: () => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
  onProcess: () => void;
}

export function ReceiptCameraPhase({
  t,
  videoRef,
  fileInputRef,
  cameraReady,
  photos,
  maxPhotos,
  onCapture,
  onFileInput,
  onRemovePhoto,
  onProcess,
}: ReceiptCameraPhaseProps) {
  const atLimit = photos.length >= maxPhotos;

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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent h-24" />
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit}
          title={atLimit ? t("tooManyPhotos", { max: maxPhotos }) : t("selectFromGallery")}
          className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 text-white transition-transform active:scale-90 disabled:opacity-30"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <span className="text-[10px] leading-none text-white/70">{t("selectFromGallery")}</span>
        </button>

        <button
          type="button"
          onClick={onCapture}
          disabled={!cameraReady || atLimit}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onFileInput}
        className="hidden"
      />

      <div className="bg-black px-6 pb-4 text-center text-xs leading-relaxed text-white/60">
        {t("hint")}
      </div>
    </>
  );
}
