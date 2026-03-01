"use client";

import { useTranslations } from "next-intl";
import type { useGalleryUpload } from "./use-gallery-upload";

type GalleryUploadHook = ReturnType<typeof useGalleryUpload>;

interface GalleryUploadPanelProps {
  gallery: GalleryUploadHook;
}

export function GalleryUploadPanel({ gallery }: GalleryUploadPanelProps) {
  const t = useTranslations("admin");
  const { uploading, log, inputRef, upload } = gallery;

  return (
    <div className="rounded-xl border-2 border-aldi-muted-light bg-gray-50/50 p-4">
      <p className="mb-2 text-sm font-medium text-aldi-text">
        {t("galleryUpload")}
      </p>
      <p className="mb-3 text-xs text-aldi-muted">
        {t("galleryUploadHint")}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="min-h-touch flex items-center gap-2 rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {uploading ? "Hochladen…" : t("galleryUpload")}
      </button>
      {log.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
          {log.map((line, i) => (
            <p key={i} className={`text-xs font-mono py-0.5 ${
              line.startsWith("❌") ? "text-red-600" : line.startsWith("✅") ? "text-green-700" : "text-gray-600"
            }`}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
