"use client";

import type { RefObject } from "react";
import type { ProductPhoto } from "@/lib/product-photos/types";
import type { PhotoCategory } from "@/lib/product-photos/classify-photo-category";

const MAX_PHOTOS = 5;

interface PhotoItem {
  type: "existing";
  photo: ProductPhoto;
}

interface PreviewItem {
  type: "preview";
  url: string;
  index: number;
  category?: PhotoCategory | null;
}

type GalleryItem = PhotoItem | PreviewItem;

export interface PhotoUploadSectionProps {
  fileInputRef: RefObject<HTMLInputElement>;
  photoPreviews: string[];
  processedThumbnail: string | null;
  thumbnailType?: "background_removed" | "soft_fallback" | null;
  analyzing: boolean;
  reviewStatus: string | null;
  existingPhotos?: ProductPhoto[];
  onPhotosSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onDeleteExistingPhoto?: (photoId: string) => void;
  onSetAsThumbnail?: (photoId: string) => void;
  labels: {
    photo: string;
    upload: string;
    hint: string;
    analyzing: string;
    reviewRequired: string;
    softFallback?: string;
    photosCount?: string;
    mainPhoto?: string;
    productPhoto?: string;
    priceTag?: string;
    unclassified?: string;
    maxPhotosReached?: string;
  };
}

function categoryIcon(category: PhotoCategory | null | undefined) {
  if (category === "thumbnail") return "★";
  if (category === "price_tag") return "🏷";
  if (category === "product") return "📷";
  return "❓";
}

function categoryLabel(
  category: PhotoCategory | null | undefined,
  labels: PhotoUploadSectionProps["labels"],
): string {
  if (category === "thumbnail") return labels.mainPhoto ?? "Main";
  if (category === "price_tag") return labels.priceTag ?? "Price tag";
  if (category === "product") return labels.productPhoto ?? "Product";
  return labels.unclassified ?? "Unclassified";
}

export function PhotoUploadSection({
  fileInputRef,
  photoPreviews,
  processedThumbnail,
  thumbnailType,
  analyzing,
  reviewStatus,
  existingPhotos = [],
  onPhotosSelected,
  onRemovePhoto,
  onDeleteExistingPhoto,
  onSetAsThumbnail,
  labels,
}: PhotoUploadSectionProps) {
  const totalCount = existingPhotos.length + photoPreviews.length;
  const canAddMore = totalCount < MAX_PHOTOS;
  const remaining = MAX_PHOTOS - existingPhotos.length;

  const displayPhotos = processedThumbnail
    ? existingPhotos.filter((p) => p.category !== "thumbnail")
    : existingPhotos;

  const gallery: GalleryItem[] = [
    ...displayPhotos.map((photo): PhotoItem => ({ type: "existing", photo })),
    ...photoPreviews.map((url, i): PreviewItem => ({ type: "preview", url, index: i })),
  ];

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
        {...(remaining > 0 ? {} : { disabled: true })}
      />
      <button
        type="button"
        disabled={analyzing || !canAddMore}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-blue/40 bg-aldi-blue/5 px-3 py-3 text-sm font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/10 disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
        {labels.upload}
      </button>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-[11px] text-aldi-muted">{labels.hint}</p>
        {labels.photosCount && (
          <span className="text-[11px] font-medium text-aldi-muted">
            {labels.photosCount.replace("{count}", String(totalCount))}
          </span>
        )}
      </div>

      {(gallery.length > 0 || processedThumbnail) && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {processedThumbnail && (
            <div className="relative flex-shrink-0">
              <img src={processedThumbnail} alt="" className="h-16 w-16 rounded-lg border-2 border-green-400 object-cover" />
              <span className="absolute -left-1 -top-1 text-xs text-yellow-500">★</span>
              {thumbnailType === "soft_fallback" ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1 text-[9px] text-white" title={labels.softFallback}>&#8505;</span>
              ) : (
                <span className="absolute -right-1 -top-1 rounded-full bg-green-500 px-1 text-[9px] text-white">&#10003;</span>
              )}
              <span className="mt-0.5 block text-center text-[9px] text-aldi-muted">
                {labels.mainPhoto ?? "Main"}
              </span>
            </div>
          )}

          {gallery.map((item) => {
            if (item.type === "existing") {
              const { photo } = item;
              return (
                <div key={photo.id} className="relative flex-shrink-0">
                  <img src={photo.photo_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  {photo.category === "thumbnail" && (
                    <span className="absolute -left-1 -top-1 text-xs text-yellow-500">★</span>
                  )}
                  {onDeleteExistingPhoto && (
                    <button
                      type="button"
                      onClick={() => onDeleteExistingPhoto(photo.id)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white"
                    >
                      &#10005;
                    </button>
                  )}
                  {onSetAsThumbnail && photo.category !== "thumbnail" && photo.category !== "price_tag" && (
                    <button
                      type="button"
                      onClick={() => onSetAsThumbnail(photo.id)}
                      className="absolute -left-1 bottom-0 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px]"
                      title={labels.mainPhoto}
                    >
                      ★
                    </button>
                  )}
                  <span className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] text-aldi-muted">
                    <span>{categoryIcon(photo.category)}</span>
                    {categoryLabel(photo.category, labels)}
                  </span>
                </div>
              );
            }

            return (
              <div key={`preview-${item.index}`} className="relative flex-shrink-0">
                <img src={item.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(item.index)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white"
                >
                  &#10005;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!canAddMore && (
        <p className="mt-1 text-[11px] text-amber-600">
          {labels.maxPhotosReached ?? "Maximum photos reached"}
        </p>
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
