"use client";

import { useTranslations } from "next-intl";
import { PhotoUploadSection } from "./competitor-form-photo-section";
import { ExtractedInfoCards } from "./competitor-form-extracted-info";
import { CompetitorFormFields } from "./competitor-form-fields";
import { useCompetitorForm } from "./hooks/use-competitor-form";

export interface CompetitorProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (productId: string) => void;
  initialName?: string;
  initialRetailer?: string;
  initialEan?: string;
  initialBrand?: string;
  editProduct?: import("@/types").CompetitorProduct | null;
}

export function CompetitorProductFormModal(props: CompetitorProductFormModalProps) {
  const { open, onClose } = props;
  const t = useTranslations("list");

  const {
    name, setName, brand, setBrand, price, setPrice,
    ean, setEan, retailer, setRetailer,
    customRetailer, setCustomRetailer,
    isBio, setIsBio,
    saving, analyzing, error,
    photoPreviews, processedThumbnail,
    extractedDetails, reviewStatus,
    fileInputRef,
    retailers, isEditMode, canSubmit,
    handlePhotosSelected, removePhoto, handleSubmit,
  } = useCompetitorForm(props);

  if (!open) return null;

  const title = isEditMode ? t("competitorProductEditTitle") : t("competitorProductTitle");
  const saveLabel = isEditMode
    ? (saving ? t("competitorProductUpdating") : t("competitorProductUpdate"))
    : (saving ? t("competitorProductSaving") : t("competitorProductSave"));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-aldi-text">{title}</h2>
            {!isEditMode && <p className="text-[11px] text-aldi-muted">{t("competitorProductSubtitle")}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-aldi-muted hover:text-aldi-text">✕</button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <PhotoUploadSection
            fileInputRef={fileInputRef} photoPreviews={photoPreviews}
            processedThumbnail={processedThumbnail} analyzing={analyzing}
            reviewStatus={reviewStatus} onPhotosSelected={handlePhotosSelected}
            onRemovePhoto={removePhoto}
            labels={{
              photo: t("competitorProductPhoto"), upload: t("competitorPhotosUpload"),
              hint: t("competitorPhotosHint"), analyzing: t("competitorPhotoAnalyzing"),
              reviewRequired: t("competitorPhotoReviewRequired"),
            }}
          />
          <CompetitorFormFields
            name={name} setName={setName} brand={brand} setBrand={setBrand}
            price={price} setPrice={setPrice} ean={ean} setEan={setEan}
            retailer={retailer} setRetailer={setRetailer}
            customRetailer={customRetailer} setCustomRetailer={setCustomRetailer}
            isBio={isBio} setIsBio={setIsBio} retailers={retailers} isEditMode={isEditMode}
            labels={{
              name: t("competitorProductName"), brand: t("competitorProductBrand"),
              retailer: t("competitorProductRetailer"), price: t("competitorProductPrice"),
              ean: t("competitorProductEan"), bio: t("competitorProductBio"),
              otherRetailer: t("otherRetailer"), otherRetailerPlaceholder: t("otherRetailerPlaceholder"),
            }}
          />
          {extractedDetails && <ExtractedInfoCards details={extractedDetails} />}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="border-t border-aldi-muted-light px-4 py-3">
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} className="w-full rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40">
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
