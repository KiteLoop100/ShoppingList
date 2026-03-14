"use client";

import type { RefObject } from "react";
import type { TranslationValues } from "use-intl";
import type { SlotPhoto } from "@/components/guided-photo-slots";
import { GuidedPhotoSlots } from "@/components/guided-photo-slots";

interface ProductPhotoSectionProps {
  t: (key: string, values?: TranslationValues) => string;
  frontPhoto: SlotPhoto | null;
  priceTagPhoto: SlotPhoto | null;
  extraPhotos: SlotPhoto[];
  processedThumbnail: string | null;
  thumbnailType?: "background_removed" | "soft_fallback" | null;
  analyzing: boolean;
  fileInputFrontRef: RefObject<HTMLInputElement>;
  fileInputPriceRef: RefObject<HTMLInputElement>;
  fileInputExtraRef: RefObject<HTMLInputElement>;
  onFrontSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPriceTagSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExtraSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFront: () => void;
  onRemovePriceTag: () => void;
  onRemoveExtra: (index: number) => void;
}

export function ProductPhotoSection({
  t,
  frontPhoto,
  priceTagPhoto,
  extraPhotos,
  processedThumbnail,
  thumbnailType,
  analyzing,
  fileInputFrontRef,
  fileInputPriceRef,
  fileInputExtraRef,
  onFrontSelected,
  onPriceTagSelected,
  onExtraSelected,
  onRemoveFront,
  onRemovePriceTag,
  onRemoveExtra,
}: ProductPhotoSectionProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <GuidedPhotoSlots
        frontPhoto={frontPhoto}
        priceTagPhoto={priceTagPhoto}
        extraPhotos={extraPhotos}
        processedThumbnail={processedThumbnail}
        thumbnailType={thumbnailType}
        analyzing={analyzing}
        fileInputFrontRef={fileInputFrontRef}
        fileInputPriceRef={fileInputPriceRef}
        fileInputExtraRef={fileInputExtraRef}
        onFrontSelected={onFrontSelected}
        onPriceTagSelected={onPriceTagSelected}
        onExtraSelected={onExtraSelected}
        onRemoveFront={onRemoveFront}
        onRemovePriceTag={onRemovePriceTag}
        onRemoveExtra={onRemoveExtra}
        labels={{
          slotFrontPhoto: t("slotFrontPhoto"),
          slotFrontRequired: t("slotFrontRequired"),
          slotPriceTag: t("slotPriceTag"),
          slotPriceOptional: t("slotPriceOptional"),
          slotExtraPhotos: t("slotExtraPhotos"),
          slotExtraHint: t("slotExtraHint"),
          slotTakePhoto: t("slotTakePhoto"),
          slotChooseFile: t("slotChooseFile"),
          analyzing: t("analyzing"),
          photosCount: t("photosCount"),
          maxPhotosReached: t("maxPhotosReached"),
          mainPhoto: t("photoThumbnail"),
        }}
      />
    </div>
  );
}
