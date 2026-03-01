"use client";

import { useReceiptProcessing } from "./use-receipt-processing";
import { ReceiptCameraPhase } from "./receipt-camera-phase";
import { ReceiptFallbackPhase } from "./receipt-fallback-phase";
import { ReceiptProcessingPhase, ReceiptDonePhase, ReceiptErrorPhase } from "./receipt-result-phase";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReceiptScanner({ open, onClose }: Props) {
  const {
    t,
    videoRef,
    fileInputRef,
    photos,
    phase,
    cameraReady,
    errorMsg,
    progress,
    result,
    capturePhoto,
    handleFileInput,
    removePhoto,
    processReceipt,
    handleClose,
    handleViewReceipt,
    retryFromFallback,
  } = useReceiptProcessing({ open, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between bg-black/80 px-4 py-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          {t("cancel")}
        </button>
        <h2 className="text-sm font-semibold text-white">{t("title")}</h2>
        <div className="w-16" />
      </div>

      {phase === "camera" && (
        <ReceiptCameraPhase
          t={t}
          videoRef={videoRef}
          cameraReady={cameraReady}
          photos={photos}
          onCapture={capturePhoto}
          onRemovePhoto={removePhoto}
          onProcess={processReceipt}
        />
      )}

      {phase === "fallback" && (
        <ReceiptFallbackPhase
          t={t}
          fileInputRef={fileInputRef}
          photos={photos}
          onFileInput={handleFileInput}
          onRemovePhoto={removePhoto}
          onProcess={processReceipt}
        />
      )}

      {phase === "processing" && (
        <ReceiptProcessingPhase t={t} progress={progress} photos={photos} />
      )}

      {phase === "done" && result && (
        <ReceiptDonePhase
          t={t}
          result={result}
          onViewReceipt={handleViewReceipt}
          onClose={handleClose}
        />
      )}

      {phase === "error" && (
        <ReceiptErrorPhase
          t={t}
          errorMsg={errorMsg}
          onRetry={retryFromFallback}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
