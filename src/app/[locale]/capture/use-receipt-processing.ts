"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { log } from "@/lib/utils/logger";
import { MAX_RECEIPT_PHOTOS } from "@/lib/receipts/constants";
import { markReceiptsChanged } from "@/lib/receipts/receipt-cache-signal";

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  base64: string;
  mediaType: string;
}

export type ScannerPhase = "camera" | "fallback" | "processing" | "submitted" | "done" | "error";

export interface ReceiptResult {
  receipt_id: string;
  retailer?: string | null;
  store_name?: string;
  purchase_date?: string;
  total_amount?: number;
  items_count: number;
  prices_updated: number;
  merged?: boolean;
  items_added?: number;
}

const MAX_IMAGE_DIMENSION = 2400;
const JPEG_QUALITY = 0.85;

interface SSEResult {
  type: "result" | "error";
  data: unknown;
}

async function readSSEStream(body: ReadableStream<Uint8Array>): Promise<SSEResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEvent: SSEResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      let eventType = "";
      let eventData = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) eventData = line.slice(6);
      }
      if (eventType === "result" || eventType === "error") {
        lastEvent = { type: eventType, data: JSON.parse(eventData) };
      }
    }

    if (done) break;
  }

  if (!lastEvent) throw new Error("No result received from server");
  return lastEvent;
}

function resizeImageToBase64(source: HTMLVideoElement | HTMLImageElement | string): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve) => {
    const processImage = (img: HTMLImageElement | HTMLVideoElement) => {
      const w = img instanceof HTMLVideoElement ? img.videoWidth : img.naturalWidth;
      const h = img instanceof HTMLVideoElement ? img.videoHeight : img.naturalHeight;

      let newW = w;
      let newH = h;
      if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
        if (w > h) {
          newW = MAX_IMAGE_DIMENSION;
          newH = Math.round(h * (MAX_IMAGE_DIMENSION / w));
        } else {
          newH = MAX_IMAGE_DIMENSION;
          newW = Math.round(w * (MAX_IMAGE_DIMENSION / h));
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, newW, newH);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      resolve({ dataUrl, base64 });
    };

    if (typeof source === "string") {
      const img = new Image();
      img.onload = () => processImage(img);
      img.src = source;
    } else {
      processImage(source);
    }
  });
}

type TranslationValue = string | number | boolean | Date | null | undefined;
type TranslateFn = (key: string, values?: Record<string, TranslationValue>) => string;

function fireAndForgetAnalysis(
  photoUrls: string[],
  photoPaths: string[],
  setResult: (r: ReceiptResult) => void,
  setPhase: (p: ScannerPhase) => void,
  t: TranslateFn,
) {
  (async () => {
    try {
      const res = await fetch("/api/process-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_urls: photoUrls, photo_paths: photoPaths }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        log.warn("[receipt-scanner] process-receipt failed:", errData);
        return;
      }

      const sseResult = await readSSEStream(res.body);

      if (sseResult.type === "error") {
        const errData = sseResult.data as Record<string, unknown>;
        if (errData.error === "duplicate_receipt") {
          markReceiptsChanged();
          setResult({ receipt_id: (errData.receipt_id as string) ?? "", items_count: 0, prices_updated: 0 });
          setPhase("done");
          return;
        }
        if (errData.error === "not_a_receipt") {
          setPhase("error");
          return;
        }
        log.warn("[receipt-scanner] process-receipt error event:", errData);
        return;
      }

      markReceiptsChanged();
      setResult(sseResult.data as ReceiptResult);
      setPhase("done");
    } catch (err) {
      log.warn("[receipt-scanner] background analysis failed (non-blocking):", err);
    }
  })();
}

export function useReceiptProcessing(options: { open: boolean; onClose: () => void; onSubmitted?: () => void }) {
  const { open, onClose, onSubmitted } = options;
  const t = useTranslations("receipt");
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [phase, setPhase] = useState<ScannerPhase>("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ReceiptResult | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("fallback");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      log.error("[receipt-scanner] Camera error:", err);
      setPhase("fallback");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (open && phase === "camera") {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, phase, startCamera, stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setPhotos((prev) => {
      if (prev.length >= MAX_RECEIPT_PHOTOS) return prev;
      return prev;
    });

    const { dataUrl, base64 } = await resizeImageToBase64(video);

    setPhotos((prev) => {
      if (prev.length >= MAX_RECEIPT_PHOTOS) return prev;
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          base64,
          mediaType: "image/jpeg",
        },
      ];
    });
  }, []);

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        const rawUrl = URL.createObjectURL(file);
        const { dataUrl, base64 } = await resizeImageToBase64(rawUrl);
        URL.revokeObjectURL(rawUrl);

        setPhotos((prev) => {
          if (prev.length >= MAX_RECEIPT_PHOTOS) return prev;
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dataUrl,
              base64,
              mediaType: "image/jpeg",
            },
          ];
        });
      }

      e.target.value = "";
    },
    []
  );

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const processReceipt = useCallback(async () => {
    if (photos.length === 0) return;

    stopCamera();
    setPhase("processing");
    setProgress(t("uploading"));

    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'4c9d8e',location:'client:processReceipt-start',message:'processReceipt CALLED',data:{photoCount:photos.length,callTs:Date.now()},timestamp:Date.now(),hypothesisId:'H-1B,H-1E'})}).catch(()=>{});
    // #endregion

    try {
      const uploadedUrls: string[] = [];
      const uploadedPaths: string[] = [];
      const ts = Date.now();

      for (let i = 0; i < photos.length; i++) {
        setProgress(t("uploadingPhoto", { current: i + 1, total: photos.length }));

        const uploadRes = await fetch("/api/upload-receipt-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: photos[i].base64,
            index: i,
            timestamp: ts,
          }),
        });

        // #region agent log
        fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'4c9d8e',location:`client:upload-photo-${i}`,message:`upload photo ${i}`,data:{index:i,status:uploadRes.status,ok:uploadRes.ok},timestamp:Date.now(),hypothesisId:'H-1C'})}).catch(()=>{});
        // #endregion

        if (!uploadRes.ok) {
          if (uploadRes.status === 429) {
            throw new Error(t("rateLimitExceeded"));
          }
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Upload HTTP ${uploadRes.status}`);
        }

        const { url, path } = await uploadRes.json();
        uploadedUrls.push(url);
        uploadedPaths.push(path);
      }

      setPhase("submitted");
      onSubmitted?.();

      // #region agent log
      fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'4c9d8e',location:'client:submitted-phase',message:'uploads done — fire-and-forget analysis',data:{urlCount:uploadedUrls.length,ts:Date.now()},timestamp:Date.now(),hypothesisId:'H-1C'})}).catch(()=>{});
      // #endregion

      fireAndForgetAnalysis(uploadedUrls, uploadedPaths, setResult, setPhase, t);
    } catch (err) {
      // #region agent log
      fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'4c9d8e',location:'client:CATCH-BLOCK',message:'CATCH BLOCK FIRED — user sees error screen',data:{errMsg:err instanceof Error?err.message:String(err),errType:(err as Error)?.constructor?.name,ts:Date.now()},timestamp:Date.now(),hypothesisId:'H-1A,H-1C,H-1E,H-1F'})}).catch(()=>{});
      // #endregion
      log.error("[receipt-scanner] Receipt processing error:", err);
      setErrorMsg(err instanceof Error ? err.message : t("processingError"));
      setPhase("error");
    }
  }, [photos, stopCamera, t, onSubmitted]);

  const handleClose = useCallback(() => {
    stopCamera();
    setPhotos([]);
    setPhase("camera");
    setErrorMsg("");
    setProgress("");
    setResult(null);
    onClose();
  }, [stopCamera, onClose]);

  const handleViewReceipt = useCallback(() => {
    if (result?.receipt_id) {
      router.push(`/receipts/${result.receipt_id}` as never);
    }
    handleClose();
  }, [result, router, handleClose]);

  const retryFromFallback = useCallback(() => {
    setPhotos([]);
    setResult(null);
    setPhase("camera");
    setErrorMsg("");
  }, []);

  return {
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
  };
}
