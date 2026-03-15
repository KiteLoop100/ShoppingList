"use client";

import type { RefObject } from "react";
import type { ProductPhoto } from "@/lib/product-photos/types";

export type PhotoSlotPurpose = "front" | "price_tag" | "extra";

export interface SlotPhoto {
  purpose: PhotoSlotPurpose;
  file: File;
  previewUrl: string;
}

export interface GuidedPhotoSlotsLabels {
  slotFrontPhoto: string;
  slotFrontRequired: string;
  slotPriceTag: string;
  slotPriceOptional: string;
  slotExtraPhotos: string;
  slotExtraHint: string;
  slotTakePhoto: string;
  slotChooseFile: string;
  analyzing: string;
  photosCount: string;
  maxPhotosReached: string;
  mainPhoto: string;
  softFallback?: string;
  rotatePhoto?: string;
}

export interface ProcessedGalleryPhoto {
  dataUrl: string;
  format: string;
  category: "product" | "price_tag";
}

export interface GuidedPhotoSlotsProps {
  frontPhoto: SlotPhoto | null;
  priceTagPhoto: SlotPhoto | null;
  extraPhotos: SlotPhoto[];
  processedThumbnail: string | null;
  thumbnailType?: "background_removed" | "soft_fallback" | null;
  processedGalleryPhotos?: ProcessedGalleryPhoto[];
  analyzing: boolean;
  existingPhotos?: ProductPhoto[];
  labels: GuidedPhotoSlotsLabels;
  fileInputFrontRef: RefObject<HTMLInputElement>;
  fileInputPriceRef: RefObject<HTMLInputElement>;
  fileInputExtraRef: RefObject<HTMLInputElement>;
  onFrontSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPriceTagSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExtraSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFront: () => void;
  onRemovePriceTag: () => void;
  onRemoveExtra: (index: number) => void;
  onRotateFront?: () => void;
  onRotatePriceTag?: () => void;
  onRotateExtra?: (index: number) => void;
  onDeleteExistingPhoto?: (photoId: string) => void;
}

const MAX_PHOTOS = 5;

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  );
}

function RemoveButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-aldi-error text-[10px] text-white shadow-sm"
      aria-label={ariaLabel}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function RotateButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-aldi-blue text-white shadow-sm"
      aria-label={ariaLabel}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
      </svg>
    </button>
  );
}

function SlotUploadButton({
  inputRef,
  label,
  disabled,
  capture,
}: {
  inputRef: RefObject<HTMLInputElement>;
  label: string;
  disabled: boolean;
  capture?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      className="flex w-[140px] items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-blue/40 bg-aldi-blue/5 px-3 py-2.5 text-sm font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/10 disabled:opacity-40"
    >
      <CameraIcon className="h-4 w-4" />
      {label}
      {capture && <span className="sr-only">(camera)</span>}
    </button>
  );
}

export function GuidedPhotoSlots({
  frontPhoto,
  priceTagPhoto,
  extraPhotos,
  processedThumbnail,
  thumbnailType,
  processedGalleryPhotos = [],
  analyzing,
  existingPhotos = [],
  labels,
  fileInputFrontRef,
  fileInputPriceRef,
  fileInputExtraRef,
  onFrontSelected,
  onPriceTagSelected,
  onExtraSelected,
  onRemoveFront,
  onRemovePriceTag,
  onRemoveExtra,
  onRotateFront,
  onRotatePriceTag,
  onRotateExtra,
  onDeleteExistingPhoto,
}: GuidedPhotoSlotsProps) {
  const processedPriceTag = processedGalleryPhotos.find((p) => p.category === "price_tag");
  const processedExtras = processedGalleryPhotos.filter((p) => p.category === "product");

  const totalCount = (frontPhoto ? 1 : 0)
    + (priceTagPhoto ? 1 : 0)
    + extraPhotos.length
    + existingPhotos.length;
  const canAddMore = totalCount < MAX_PHOTOS;

  const existingFront = existingPhotos.find((p) => p.category === "thumbnail");
  const existingPriceTag = existingPhotos.find((p) => p.category === "price_tag");
  const existingExtras = existingPhotos.filter(
    (p) => p.category === "product" && p.id !== existingFront?.id,
  );

  const hasExtraContent = existingExtras.length > 0 || extraPhotos.length > 0;

  return (
    <div className="space-y-2">
      {/* Slot 1: Front/Product Photo — required */}
      <section className="flex items-center gap-3 rounded-xl border border-aldi-muted-light/60 bg-white px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-aldi-text">{labels.slotFrontPhoto}</h3>
          <p className="text-[11px] text-aldi-muted">{labels.slotFrontRequired}</p>
        </div>

        <div className="shrink-0">
          {processedThumbnail ? (
            <div className="relative">
              <img src={processedThumbnail} alt="" className="h-14 w-14 rounded-lg border-2 border-green-400 object-cover shadow-sm" />
              <span className="absolute -left-1 -top-1 text-[10px] text-yellow-500">★</span>
              {thumbnailType === "soft_fallback" ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-blue-500 px-1 text-[8px] text-white" title={labels.softFallback}>&#8505;</span>
              ) : (
                <span className="absolute -right-1 -top-1 rounded-full bg-green-500 px-1 text-[8px] text-white">&#10003;</span>
              )}
            </div>
          ) : frontPhoto ? (
            <div className="relative">
              <img src={frontPhoto.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover shadow-sm" />
              {onRotateFront && !analyzing && <RotateButton onClick={onRotateFront} ariaLabel={labels.rotatePhoto} />}
              <RemoveButton onClick={onRemoveFront} />
            </div>
          ) : existingFront ? (
            <div className="relative">
              <img src={existingFront.photo_url} alt="" className="h-14 w-14 rounded-lg border-2 border-green-400 object-cover shadow-sm" />
              <span className="absolute -left-1 -top-1 text-[10px] text-yellow-500">★</span>
              {onDeleteExistingPhoto && <RemoveButton onClick={() => onDeleteExistingPhoto(existingFront.id)} />}
            </div>
          ) : (
            <SlotUploadButton inputRef={fileInputFrontRef} label={labels.slotTakePhoto} disabled={analyzing} />
          )}
        </div>

        <input ref={fileInputFrontRef} type="file" accept="image/*" onChange={onFrontSelected} className="hidden" />
      </section>

      {/* Slot 2: Price Tag — optional */}
      <section className="flex items-center gap-3 rounded-xl border border-aldi-muted-light/60 bg-white px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-aldi-text">{labels.slotPriceTag}</h3>
          <p className="text-[11px] text-aldi-muted">{labels.slotPriceOptional}</p>
        </div>

        <div className="shrink-0">
          {processedPriceTag && priceTagPhoto ? (
            <div className="relative">
              <img src={processedPriceTag.dataUrl} alt="" className="h-14 w-14 rounded-lg border-2 border-green-400 object-cover shadow-sm" />
              <span className="absolute -right-1 -top-1 rounded-full bg-green-500 px-1 text-[8px] text-white">&#10003;</span>
              <RemoveButton onClick={onRemovePriceTag} />
            </div>
          ) : priceTagPhoto ? (
            <div className="relative">
              <img src={priceTagPhoto.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover shadow-sm" />
              {onRotatePriceTag && !analyzing && <RotateButton onClick={onRotatePriceTag} ariaLabel={labels.rotatePhoto} />}
              <RemoveButton onClick={onRemovePriceTag} />
            </div>
          ) : existingPriceTag ? (
            <div className="relative">
              <img src={existingPriceTag.photo_url} alt="" className="h-14 w-14 rounded-lg object-cover shadow-sm" />
              {onDeleteExistingPhoto && <RemoveButton onClick={() => onDeleteExistingPhoto(existingPriceTag.id)} />}
            </div>
          ) : (
            <SlotUploadButton inputRef={fileInputPriceRef} label={labels.slotTakePhoto} disabled={analyzing || !canAddMore} />
          )}
        </div>

        <input ref={fileInputPriceRef} type="file" accept="image/*" onChange={onPriceTagSelected} className="hidden" />
      </section>

      {/* Slot 3: Extra Photos — optional multi */}
      <section className="rounded-xl border border-aldi-muted-light/60 bg-white px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-aldi-text">{labels.slotExtraPhotos}</h3>
            <p className="text-[11px] text-aldi-muted">{labels.slotExtraHint}</p>
          </div>
          <div className="shrink-0">
            {canAddMore ? (
              <SlotUploadButton inputRef={fileInputExtraRef} label={labels.slotTakePhoto} disabled={analyzing || !canAddMore} />
            ) : null}
          </div>
        </div>

        {hasExtraContent && (
          <div className="mt-2 flex flex-wrap gap-2">
            {existingExtras.map((photo) => (
              <div key={photo.id} className="relative">
                <img src={photo.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                {onDeleteExistingPhoto && <RemoveButton onClick={() => onDeleteExistingPhoto(photo.id)} />}
              </div>
            ))}
            {extraPhotos.map((sp, i) => {
              const processed = processedExtras[i];
              const src = processed ? processed.dataUrl : sp.previewUrl;
              const isProcessed = !!processed;
              return (
                <div key={`extra-${i}`} className="relative">
                  <img src={src} alt="" className={`h-12 w-12 rounded-lg object-cover${isProcessed ? " border-2 border-green-400 shadow-sm" : ""}`} />
                  {isProcessed && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-green-500 px-1 text-[8px] text-white">&#10003;</span>
                  )}
                  {onRotateExtra && !analyzing && !isProcessed && <RotateButton onClick={() => onRotateExtra(i)} ariaLabel={labels.rotatePhoto} />}
                  <RemoveButton onClick={() => onRemoveExtra(i)} />
                </div>
              );
            })}
          </div>
        )}

        <input ref={fileInputExtraRef} type="file" accept="image/*" multiple onChange={onExtraSelected} className="hidden" />
      </section>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-aldi-muted">
          {labels.photosCount.replace("{count}", String(totalCount))}
        </span>
        {!canAddMore && (
          <span className="text-[11px] text-amber-600">{labels.maxPhotosReached}</span>
        )}
      </div>

      {analyzing && (
        <div className="flex items-center gap-2 text-xs text-aldi-blue">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {labels.analyzing}
        </div>
      )}
    </div>
  );
}
