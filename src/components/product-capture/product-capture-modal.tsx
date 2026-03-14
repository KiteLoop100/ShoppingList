"use client";

import { useTranslations } from "next-intl";
import { PhotoUploadSection } from "./photo-upload-section";
import { ExtractedInfoCards } from "./extracted-info-cards";
import { ProductCaptureFields } from "./product-capture-fields";
import { AliasTagInput } from "./alias-tag-input";
import { useProductCaptureForm, type ProductCaptureConfig } from "./hooks/use-product-capture-form";

export type { ProductCaptureConfig } from "./hooks/use-product-capture-form";

export function ProductCaptureModal(props: ProductCaptureConfig) {
  const { open, onClose, hiddenFields } = props;

  const t = useTranslations("productCapture");

  const {
    values, setField,
    saving, analyzing, error,
    frontPhoto, priceTagPhoto, extraPhotos,
    processedThumbnail, thumbnailType,
    existingPhotos,
    extractedDetails, reviewStatus,
    fileInputFrontRef, fileInputPriceRef, fileInputExtraRef,
    retailers, demandGroups, filteredSubGroups,
    isEditMode, canSubmit, locked,
    duplicateInfo, useExistingProduct, dismissDuplicate,
    handleFrontSelected, handlePriceTagSelected, handleExtraSelected,
    removeFront, removePriceTag, removeExtra,
    handleSubmit,
    handleDeleteExistingPhoto, handleSetAsThumbnail,
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
            frontPhoto={frontPhoto}
            priceTagPhoto={priceTagPhoto}
            extraPhotos={extraPhotos}
            processedThumbnail={processedThumbnail}
            thumbnailType={thumbnailType}
            analyzing={analyzing}
            reviewStatus={reviewStatus}
            existingPhotos={existingPhotos}
            fileInputFrontRef={fileInputFrontRef}
            fileInputPriceRef={fileInputPriceRef}
            fileInputExtraRef={fileInputExtraRef}
            onFrontSelected={handleFrontSelected}
            onPriceTagSelected={handlePriceTagSelected}
            onExtraSelected={handleExtraSelected}
            onRemoveFront={removeFront}
            onRemovePriceTag={removePriceTag}
            onRemoveExtra={removeExtra}
            onDeleteExistingPhoto={handleDeleteExistingPhoto}
            labels={{
              photo: t("photo"),
              analyzing: t("photoAnalyzing"),
              reviewRequired: t("photoReviewRequired"),
              softFallback: t("photoSoftFallback"),
              mainPhoto: t("mainPhoto"),
              slotFrontPhoto: t("slotFrontPhoto"),
              slotFrontRequired: t("slotFrontRequired"),
              slotPriceTag: t("slotPriceTag"),
              slotPriceOptional: t("slotPriceOptional"),
              slotExtraPhotos: t("slotExtraPhotos"),
              slotExtraHint: t("slotExtraHint"),
              slotTakePhoto: t("slotTakePhoto"),
              slotChooseFile: t("slotChooseFile"),
              photosCount: t("photosCount", { count: "PLACEHOLDER" }),
              maxPhotosReached: t("maxPhotosReached"),
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
          {isEditMode && (
            <AliasTagInput
              aliases={values.aliases}
              onChange={(a) => setField("aliases", a)}
              label={t("aliases")}
              placeholder={t("aliasPlaceholder")}
            />
          )}
          {extractedDetails && <ExtractedInfoCards details={extractedDetails} />}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {duplicateInfo && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
              <p className="mb-2 text-sm font-medium text-amber-900">
                {t("duplicateFound", { name: duplicateInfo.name ?? "" })}
              </p>
              <p className="mb-3 text-xs text-amber-800">{t("duplicateHint")}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={useExistingProduct}
                  className="flex-1 rounded-lg bg-aldi-blue px-3 py-2 text-sm font-semibold text-white"
                >
                  {t("useExisting")}
                </button>
                <button
                  type="button"
                  onClick={dismissDuplicate}
                  className="flex-1 rounded-lg border border-aldi-muted-light px-3 py-2 text-sm font-medium text-aldi-text"
                >
                  {t("dismissDuplicate")}
                </button>
              </div>
            </div>
          )}
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
