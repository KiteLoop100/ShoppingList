"use client";

import type { RefObject } from "react";
import type { ProductPhoto } from "@/lib/product-photos/types";
import type { SlotPhoto, ProcessedGalleryPhoto } from "@/components/guided-photo-slots";
import { GuidedPhotoSlots } from "@/components/guided-photo-slots";

export interface PhotoUploadSectionProps {
  frontPhoto: SlotPhoto | null;
  priceTagPhoto: SlotPhoto | null;
  extraPhotos: SlotPhoto[];
  processedThumbnail: string | null;
  thumbnailType?: "background_removed" | "soft_fallback" | null;
  processedGalleryPhotos?: ProcessedGalleryPhoto[];
  analyzing: boolean;
  reviewStatus: string | null;
  existingPhotos?: ProductPhoto[];
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
  labels: {
    photo: string;
    analyzing: string;
    reviewRequired: string;
    softFallback?: string;
    mainPhoto?: string;
    slotFrontPhoto: string;
    slotFrontRequired: string;
    slotPriceTag: string;
    slotPriceOptional: string;
    slotExtraPhotos: string;
    slotExtraHint: string;
    slotTakePhoto: string;
    slotChooseFile: string;
    rotatePhoto?: string;
    photosCount: string;
    maxPhotosReached: string;
  };
}

export function PhotoUploadSection({
  frontPhoto,
  priceTagPhoto,
  extraPhotos,
  processedThumbnail,
  thumbnailType,
  processedGalleryPhotos,
  analyzing,
  reviewStatus,
  existingPhotos = [],
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
  labels,
}: PhotoUploadSectionProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-aldi-muted">
        {labels.photo}
      </label>

      <GuidedPhotoSlots
        frontPhoto={frontPhoto}
        priceTagPhoto={priceTagPhoto}
        extraPhotos={extraPhotos}
        processedThumbnail={processedThumbnail}
        thumbnailType={thumbnailType}
        processedGalleryPhotos={processedGalleryPhotos}
        analyzing={analyzing}
        existingPhotos={existingPhotos}
        fileInputFrontRef={fileInputFrontRef}
        fileInputPriceRef={fileInputPriceRef}
        fileInputExtraRef={fileInputExtraRef}
        onFrontSelected={onFrontSelected}
        onPriceTagSelected={onPriceTagSelected}
        onExtraSelected={onExtraSelected}
        onRemoveFront={onRemoveFront}
        onRemovePriceTag={onRemovePriceTag}
        onRemoveExtra={onRemoveExtra}
        onRotateFront={onRotateFront}
        onRotatePriceTag={onRotatePriceTag}
        onRotateExtra={onRotateExtra}
        onDeleteExistingPhoto={onDeleteExistingPhoto}
        labels={{
          slotFrontPhoto: labels.slotFrontPhoto,
          slotFrontRequired: labels.slotFrontRequired,
          slotPriceTag: labels.slotPriceTag,
          slotPriceOptional: labels.slotPriceOptional,
          slotExtraPhotos: labels.slotExtraPhotos,
          slotExtraHint: labels.slotExtraHint,
          slotTakePhoto: labels.slotTakePhoto,
          slotChooseFile: labels.slotChooseFile,
          rotatePhoto: labels.rotatePhoto,
          analyzing: labels.analyzing,
          photosCount: labels.photosCount,
          maxPhotosReached: labels.maxPhotosReached,
          mainPhoto: labels.mainPhoto ?? "Main",
          softFallback: labels.softFallback,
        }}
      />

      {reviewStatus && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span>&#9888;</span>
          {labels.reviewRequired}
        </div>
      )}
    </div>
  );
}
