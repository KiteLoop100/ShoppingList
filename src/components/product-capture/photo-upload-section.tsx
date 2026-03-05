"use client";

import type { RefObject } from "react";

export function PhotoUploadSection({
  fileInputRef,
  photoPreviews,
  processedThumbnail,
  analyzing,
  reviewStatus,
  onPhotosSelected,
  onRemovePhoto,
  labels,
}: {
  fileInputRef: RefObject<HTMLInputElement>;
  photoPreviews: string[];
  processedThumbnail: string | null;
  analyzing: boolean;
  reviewStatus: string | null;
  onPhotosSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  labels: {
    photo: string;
    upload: string;
    hint: string;
    analyzing: string;
    reviewRequired: string;
  };
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-aldi-muted">
        {labels.photo}
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPhotosSelected}
        className="hidden"
      />
      <button
        type="button"
        disabled={analyzing}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-blue/40 bg-aldi-blue/5 px-3 py-3 text-sm font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/10 disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
        {labels.upload}
      </button>
      <p className="mt-1 text-[11px] text-aldi-muted">{labels.hint}</p>

      {photoPreviews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {processedThumbnail && (
            <div className="relative">
              <img src={processedThumbnail} alt="" className="h-16 w-16 rounded-lg border-2 border-green-400 object-cover" />
              <span className="absolute -right-1 -top-1 rounded-full bg-green-500 px-1 text-[9px] text-white">&#10003;</span>
            </div>
          )}
          {photoPreviews.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => onRemovePhoto(i)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white"
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}

      {analyzing && (
        <div className="mt-2 flex items-center gap-2 text-xs text-aldi-blue">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {labels.analyzing}
        </div>
      )}

      {reviewStatus && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span>&#9888;</span>
          {labels.reviewRequired}
        </div>
      )}
    </div>
  );
}
