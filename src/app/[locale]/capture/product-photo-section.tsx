"use client";

import Image from "next/image";
import type { TranslationValues } from "use-intl";
import type { DataPhotoItem, ExtraBlobItem } from "./use-product-creation";

interface ProductPhotoSectionProps {
  t: (key: string, values?: TranslationValues) => string;
  thumbnailPreview: string | null;
  extraBlobs: ExtraBlobItem[];
  dataPhotos: DataPhotoItem[];
  fileInputThumb: React.RefObject<HTMLInputElement>;
  fileInputExtra: React.RefObject<HTMLInputElement>;
  fileInputData: React.RefObject<HTMLInputElement>;
  pickThumbnail: () => void;
  pickExtra: () => void;
  removeExtra: (id: string) => void;
  pickDataPhoto: () => void;
}

export function ProductPhotoSection({
  t,
  thumbnailPreview,
  extraBlobs,
  dataPhotos,
  fileInputThumb,
  fileInputExtra,
  fileInputData,
  pickThumbnail,
  pickExtra,
  removeExtra,
  pickDataPhoto,
}: ProductPhotoSectionProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      {/* Thumbnail */}
      <section className="mb-4">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("photoThumbnail")}</h2>
        <button
          type="button"
          onClick={pickThumbnail}
          className="rounded-xl bg-aldi-blue-light px-4 py-2.5 text-sm font-medium text-aldi-blue transition-colors hover:bg-aldi-blue hover:text-white"
        >
          {t("photoButton")}
        </button>
        <input ref={fileInputThumb} type="file" className="hidden" accept="image/*" capture="environment" />
        {thumbnailPreview && (
          <div className="mt-3">
            <Image
              src={thumbnailPreview}
              alt=""
              role="presentation"
              width={96}
              height={96}
              className="h-24 w-24 rounded-xl object-cover shadow-sm"
              unoptimized
            />
          </div>
        )}
      </section>

      {/* Extra photos */}
      <section className="mb-4 border-t border-aldi-muted-light/50 pt-4">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("extraPhotos")}</h2>
        <button
          type="button"
          onClick={pickExtra}
          className="rounded-xl bg-aldi-bg px-4 py-2.5 text-sm font-medium text-aldi-text-secondary transition-colors hover:bg-aldi-muted-light"
        >
          {t("photoButton")}
        </button>
        <input ref={fileInputExtra} type="file" className="hidden" accept="image/*" multiple />
        <div className="mt-3 flex flex-wrap gap-2">
          {extraBlobs.map((item) => (
            <div key={item.id} className="relative">
              <Image
                src={item.url}
                alt=""
                role="presentation"
                width={80}
                height={80}
                className="h-20 w-20 rounded-xl object-cover shadow-sm"
                unoptimized
              />
              <button
                type="button"
                onClick={() => removeExtra(item.id)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-aldi-error text-[10px] text-white shadow-sm"
                aria-label={t("cancel")}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Data photos */}
      <section className="border-t border-aldi-muted-light/50 pt-4">
        <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("dataPhotos")}</h2>
        <button
          type="button"
          onClick={pickDataPhoto}
          className="rounded-xl bg-aldi-bg px-4 py-2.5 text-sm font-medium text-aldi-text-secondary transition-colors hover:bg-aldi-muted-light"
        >
          {t("photoButton")}
        </button>
        <input ref={fileInputData} type="file" className="hidden" accept="image/*" multiple capture="environment" />
        <ul className="mt-2 list-none space-y-1 text-sm text-aldi-muted">
          {dataPhotos.map((d) => (
            <li key={d.id}>
              {d.status === "uploading" && t("statusUploading")}
              {d.status === "processing" && t("statusProcessing")}
              {d.status === "done" && t("statusDone", { count: d.fieldsRecognized ?? 0 })}
              {d.status === "error" && `Error: ${d.error}`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
