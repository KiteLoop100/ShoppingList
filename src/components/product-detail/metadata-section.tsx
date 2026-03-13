"use client";

import { useTranslations } from "next-intl";
import { SectionLabel } from "./section-label";
import type { AnyProduct } from "./types";
import { isAldiProduct, isCompetitorProduct } from "./types";

interface MetadataSectionProps {
  product: AnyProduct;
  labels: {
    articleNumber: string;
    eanBarcode: string;
    assortmentType?: string;
    specialPeriod?: string;
    weightQuantity?: string;
    countryOfOrigin?: string;
    typicalShelfLife?: string;
  };
  assortmentLabel?: string;
}

export function MetadataSection({ product, labels, assortmentLabel }: MetadataSectionProps) {
  if (isAldiProduct(product)) {
    return <AldiMetadata product={product} labels={labels} assortmentLabel={assortmentLabel} />;
  }
  return <CompetitorMetadata product={product} labels={labels} />;
}

function ShelfLifeRow({ days, label }: { days: number | null | undefined; label?: string }) {
  const t = useTranslations("productDetail");
  if (!days || !label) return null;
  return (
    <dl className="mt-4 border-t border-aldi-muted-light pt-3">
      <SectionLabel>{label}</SectionLabel>
      <dd className="mt-0.5 text-sm text-aldi-text">{t("shelfLifeDays", { days })}</dd>
    </dl>
  );
}

function AldiMetadata({
  product,
  labels,
  assortmentLabel,
}: {
  product: AnyProduct;
  labels: MetadataSectionProps["labels"];
  assortmentLabel?: string;
}) {
  if (!isAldiProduct(product)) return null;

  const hasArticle = product.article_number != null && product.article_number !== "";
  const hasEan = product.ean_barcode != null && product.ean_barcode !== "";
  const hasSpecialDates = product.special_start_date != null || product.special_end_date != null;
  const specialRange =
    product.special_start_date && product.special_end_date
      ? `${product.special_start_date} – ${product.special_end_date}`
      : product.special_start_date ?? product.special_end_date ?? "";

  return (
    <>
      {labels.assortmentType && assortmentLabel && (
        <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
          <div>
            <SectionLabel>{labels.assortmentType}</SectionLabel>
            <dd className="mt-0.5 text-sm text-aldi-text">{assortmentLabel}</dd>
          </div>
          {hasSpecialDates && specialRange && labels.specialPeriod && (
            <div>
              <SectionLabel>{labels.specialPeriod}</SectionLabel>
              <dd className="mt-0.5 text-sm text-aldi-text">{specialRange}</dd>
            </div>
          )}
        </dl>
      )}
      {(hasArticle || hasEan) && (
        <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
          {hasArticle && (
            <div>
              <SectionLabel>{labels.articleNumber}</SectionLabel>
              <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.article_number}</dd>
            </div>
          )}
          {hasEan && (
            <div>
              <SectionLabel>{labels.eanBarcode}</SectionLabel>
              <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.ean_barcode}</dd>
            </div>
          )}
        </dl>
      )}
      <ShelfLifeRow days={product.typical_shelf_life_days} label={labels.typicalShelfLife} />
    </>
  );
}

function CompetitorMetadata({
  product,
  labels,
}: {
  product: AnyProduct;
  labels: MetadataSectionProps["labels"];
}) {
  if (!isCompetitorProduct(product)) return null;

  const hasEan = product.ean_barcode != null && product.ean_barcode !== "";
  const hasWeight = product.weight_or_quantity != null && product.weight_or_quantity !== "";
  const hasCountry = product.country_of_origin != null && product.country_of_origin !== "";

  if (!hasEan && !hasWeight && !hasCountry) return null;

  return (
    <>
      {(hasEan || hasWeight) && (
        <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
          {hasEan && (
            <div>
              <SectionLabel>{labels.eanBarcode}</SectionLabel>
              <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.ean_barcode}</dd>
            </div>
          )}
          {hasWeight && labels.weightQuantity && (
            <div>
              <SectionLabel>{labels.weightQuantity}</SectionLabel>
              <dd className="mt-0.5 text-sm text-aldi-text">{product.weight_or_quantity}</dd>
            </div>
          )}
        </dl>
      )}
      {hasCountry && labels.countryOfOrigin && (
        <dl className="mt-4 border-t border-aldi-muted-light pt-3">
          <SectionLabel>{labels.countryOfOrigin}</SectionLabel>
          <dd className="mt-1 text-sm text-aldi-text">{product.country_of_origin}</dd>
        </dl>
      )}
      <ShelfLifeRow days={product.typical_shelf_life_days} label={labels.typicalShelfLife} />
    </>
  );
}
