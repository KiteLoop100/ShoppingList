"use client";

import { useTranslations } from "next-intl";
import { PhotoUploadSection } from "./photo-upload-section";
import { ExtractedInfoCards } from "./extracted-info-cards";
import { ProductCaptureFields } from "./product-capture-fields";
import { useProductCaptureForm, type ProductCaptureConfig } from "./hooks/use-product-capture-form";

export type { ProductCaptureConfig } from "./hooks/use-product-capture-form";

export function ProductCaptureModal(props: ProductCaptureConfig) {
  const { open, onClose, hiddenFields } = props;

  const t = useTranslations("productCapture");

  const {
    values, setField,
    saving, analyzing, error,
    photoPreviews, processedThumbnail, thumbnailType,
    extractedDetails, reviewStatus,
    fileInputRef,
    retailers, demandGroups, filteredSubGroups,
    isEditMode, canSubmit, locked,
    handlePhotosSelected, removePhoto, handleSubmit,
  } = useProductCaptureForm(props);

  if (!open) return null;

  const title = isEditMode ? t("editTitle") : t("createTitle");
  const saveLabel = isEditMode
    ? (saving ? t("updating") : t("update"))
    : (saving ? t("saving") : t("save"));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-aldi-text">{title}</h2>
            {!isEditMode && <p className="text-[11px] text-aldi-muted">{t("subtitle")}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-aldi-muted hover:text-aldi-text">&#10005;</button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <PhotoUploadSection
            fileInputRef={fileInputRef}
            photoPreviews={photoPreviews}
            processedThumbnail={processedThumbnail}
            thumbnailType={thumbnailType}
            analyzing={analyzing}
            reviewStatus={reviewStatus}
            onPhotosSelected={handlePhotosSelected}
            onRemovePhoto={removePhoto}
            labels={{
              photo: t("photo"),
              upload: t("photosUpload"),
              hint: t("photosHint"),
              analyzing: t("photoAnalyzing"),
              reviewRequired: t("photoReviewRequired"),
              softFallback: t("photoSoftFallback"),
            }}
          />
          <ProductCaptureFields
            values={values}
            setField={setField}
            retailers={retailers}
            demandGroups={demandGroups}
            filteredSubGroups={filteredSubGroups}
            hiddenFields={hiddenFields}
            lockedFields={locked}
            labels={{
              name: t("name"),
              brand: t("brand"),
              retailer: t("retailer"),
              category: t("category"),
              subcategory: t("subcategory"),
              noSubcategory: t("noSubcategory"),
              ean: t("ean"),
              articleNumber: t("articleNumber"),
              price: t("price"),
              weightQuantity: t("weightQuantity"),
              assortmentType: t("assortmentType"),
              assortmentDailyRange: t("assortmentDailyRange"),
              assortmentSpecialFood: t("assortmentSpecialFood"),
              assortmentSpecialNonfood: t("assortmentSpecialNonfood"),
              otherRetailer: t("otherRetailer"),
              otherRetailerPlaceholder: t("otherRetailerPlaceholder"),
              criteria: {
                bio: t("bio"),
                vegan: t("vegan"),
                glutenFree: t("glutenFree"),
                lactoseFree: t("lactoseFree"),
                animalWelfare: t("animalWelfare"),
                animalWelfareNone: t("animalWelfareNone"),
                animalWelfareLevel: t("animalWelfareLevel"),
              },
            }}
          />
          {extractedDetails && <ExtractedInfoCards details={extractedDetails} />}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="border-t border-aldi-muted-light px-4 py-3">
          <button
            type="button" onClick={handleSubmit} disabled={!canSubmit}
            className="w-full rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
