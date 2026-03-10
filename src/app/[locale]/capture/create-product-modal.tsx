"use client";

import { useTranslations } from "next-intl";
import { useProductCreation } from "./use-product-creation";
import { ProductPhotoSection } from "./product-photo-section";
import { ProductFieldsSection } from "./product-fields-section";
import { ProductDuplicateBanner } from "./product-duplicate-banner";

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function CreateProductModal({ open, onClose, onSaved }: CreateProductModalProps) {
  const t = useTranslations("capture.createProduct");
  const tReview = useTranslations("capture.review");

  const {
    fields,
    setters,
    demandGroupOptions,
    subGroupOptions,
    thumbnailPreview,
    extraBlobs,
    dataPhotos,
    saving,
    saveError,
    duplicateProductId,
    setDuplicateProductId,
    fileInputThumb,
    fileInputExtra,
    fileInputData,
    pickThumbnail,
    pickExtra,
    removeExtra,
    pickDataPhoto,
    handleSave,
    handleClose,
  } = useProductCreation({ open, onSaved, onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-aldi-bg">
      <header className="flex shrink-0 items-center justify-between bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <h1 className="text-[17px] font-semibold tracking-tight text-aldi-text">{t("title")}</h1>
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className="rounded-xl px-3 py-1.5 text-sm font-medium text-aldi-blue transition-colors hover:bg-aldi-blue-light disabled:opacity-50"
          aria-label={t("cancel")}
        >
          {t("cancel")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto grid max-w-lg gap-5">
          <ProductPhotoSection
            t={t}
            thumbnailPreview={thumbnailPreview}
            extraBlobs={extraBlobs}
            dataPhotos={dataPhotos}
            fileInputThumb={fileInputThumb}
            fileInputExtra={fileInputExtra}
            fileInputData={fileInputData}
            pickThumbnail={pickThumbnail}
            pickExtra={pickExtra}
            removeExtra={removeExtra}
            pickDataPhoto={pickDataPhoto}
          />

          <ProductFieldsSection
            t={t}
            tReview={tReview}
            fields={fields}
            demandGroupOptions={demandGroupOptions}
            subGroupOptions={subGroupOptions}
            setters={setters}
          />

          {saveError && (
            <div className="rounded-2xl bg-red-50 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <p className="text-sm font-medium text-aldi-error">{saveError}</p>
            </div>
          )}

          {duplicateProductId && (
            <ProductDuplicateBanner
              t={t}
              duplicateProductId={duplicateProductId}
              onUpdate={handleSave}
              onDismiss={() => setDuplicateProductId(null)}
            />
          )}
        </div>
      </div>

      <footer className="shrink-0 bg-white px-4 py-4 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !fields.name.trim()}
          className="w-full rounded-2xl bg-aldi-blue px-4 py-3.5 text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "…" : t("save")}
        </button>
      </footer>
    </div>
  );
}
