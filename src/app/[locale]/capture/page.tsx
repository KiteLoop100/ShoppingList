"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { getDeviceUserId } from "@/lib/list/device-id";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { uploadPhotoAndEnqueue } from "@/app/[locale]/capture/upload";
import { CaptureStatusFeed } from "@/app/[locale]/capture/capture-status-feed";
import { OverwriteThumbnailDialog } from "@/app/[locale]/capture/overwrite-thumbnail-dialog";

export default function CapturePage() {
  const t = useTranslations("capture");
  const tCommon = useTranslations("common");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [overwriteUploadId, setOverwriteUploadId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ensureCamera = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      return stream;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera access failed";
      setCameraError(msg);
      return null;
    }
  }, []);

  const captureFromCamera = useCallback(async () => {
    const stream = await ensureCamera();
    if (!stream || !videoRef.current) return;
    const video = videoRef.current;
    if (video.srcObject !== stream) video.srcObject = stream;
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
      if (video.readyState >= 2) video.play().then(resolve).catch(resolve);
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        setUploading(true);
        try {
          const result = await uploadPhotoAndEnqueue(blob, getDeviceUserId());
          if (result?.pendingOverwrite) setOverwriteUploadId(result.uploadId);
        } finally {
          setUploading(false);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [ensureCamera]);

  const pickFromGallery = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files?.length) return;
      setUploading(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.startsWith("image/")) continue;
          const blob = await new Promise<Blob | null>((res) => {
            const r = new FileReader();
            r.onloadend = () => res(r.result as Blob | null);
            r.readAsArrayBuffer(file);
          }).then((b) => (b ? new Blob([b], { type: file.type }) : null));
          if (blob) {
            const result = await uploadPhotoAndEnqueue(blob, getDeviceUserId());
            if (result?.pendingOverwrite) setOverwriteUploadId(result.uploadId);
          }
        }
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-aldi-muted-light bg-white px-4 py-3">
        <Link
          href="/"
          className="touch-target flex items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("back")}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={captureFromCamera}
            disabled={uploading}
            className="flex items-center justify-center gap-2 rounded-xl bg-aldi-blue px-4 py-3 text-white transition-opacity disabled:opacity-50"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7" />
            </svg>
            {t("takePhoto")}
          </button>
          <button
            type="button"
            onClick={pickFromGallery}
            disabled={uploading}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 text-aldi-blue transition-opacity disabled:opacity-50"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {t("chooseFromGallery")}
          </button>
        </div>

        {cameraError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {cameraError}
          </p>
        )}

        <video
          ref={videoRef}
          playsInline
          muted
          className="hidden h-0 w-0"
          aria-hidden
        />

        <CaptureStatusFeed userId={getDeviceUserId()} onPendingOverwrite={setOverwriteUploadId} />
      </div>

      <OverwriteThumbnailDialog
        uploadId={overwriteUploadId}
        onClose={() => setOverwriteUploadId(null)}
      />
    </main>
  );
}
