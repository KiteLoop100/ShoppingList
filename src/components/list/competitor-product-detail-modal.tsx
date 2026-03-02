"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { getLatestPrices } from "@/lib/competitor-products/competitor-product-service";
import type { CompetitorProduct, CompetitorProductPrice } from "@/types";

export interface CompetitorProductDetailModalProps {
  product: CompetitorProduct | null;
  onClose: () => void;
  onEdit: (product: CompetitorProduct) => void;
  /** Retailer name from the list item, shown when no price history exists yet. */
  retailer?: string | null;
}

export function CompetitorProductDetailModal({
  product,
  onClose,
  onEdit,
  retailer: retailerProp,
}: CompetitorProductDetailModalProps) {
  const t = useTranslations("competitorDetail");
  const locale = useLocale();
  const [prices, setPrices] = useState<CompetitorProductPrice[]>([]);

  const productId = product?.product_id ?? null;

  useEffect(() => {
    if (!productId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    getLatestPrices(productId).then(setPrices);
    return () => { document.body.style.overflow = prev; };
  }, [productId]);

  if (!product) return null;

  const hasBrand = product.brand != null && product.brand !== "";
  const hasEan = product.ean_barcode != null && product.ean_barcode !== "";
  const hasWeight = product.weight_or_quantity != null && product.weight_or_quantity !== "";
  const retailerNames = prices.length > 0
    ? [...new Set(prices.map(p => p.retailer))]
    : (retailerProp ? [retailerProp] : []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 touch-none"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-aldi-muted-light p-4">
            <h2 className="text-lg font-semibold text-aldi-text">{t("title")}</h2>
            <button
              type="button"
              className="touch-target -m-2 rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
              onClick={onClose}
              aria-label={t("close")}
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto overscroll-contain p-4">
            <div className="mb-4 flex flex-col items-start gap-3">
              <div className="flex flex-wrap items-start gap-3">
                {product.thumbnail_url && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("frontPhoto")}</span>
                    <img
                      src={product.thumbnail_url}
                      alt={t("frontPhoto")}
                      className="h-[150px] w-[150px] shrink-0 rounded-xl object-cover object-center"
                    />
                  </div>
                )}
                {product.other_photo_url && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("otherPhoto")}</span>
                    <img
                      src={product.other_photo_url}
                      alt={t("otherPhoto")}
                      className="h-[150px] w-[150px] shrink-0 rounded-xl object-cover object-center"
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-aldi-text">{product.name}</p>
                {hasBrand && <p className="mt-0.5 text-sm text-aldi-muted">{product.brand}</p>}
                {retailerNames.length > 0 && (
                  <p className="mt-1 text-sm text-aldi-muted">
                    <span className="mr-1">🏪</span>
                    {retailerNames.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {prices.length > 0 ? (
              <dl className="space-y-2 border-t border-aldi-muted-light pt-3">
                {prices.map((p) => (
                  <div key={p.price_id}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">
                      {t("latestPrice")} – {p.retailer}
                    </dt>
                    <dd className="mt-0.5 text-aldi-text">
                      €{p.price.toFixed(2)}
                      <span className="ml-2 text-xs text-aldi-muted">
                        {new Date(p.observed_at).toLocaleDateString(
                          locale === "de" ? "de-DE" : "en-US",
                          { day: "2-digit", month: "2-digit", year: "2-digit" },
                        )}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="border-t border-aldi-muted-light pt-3 text-sm text-aldi-muted">
                {t("noPrices")}
              </p>
            )}

            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              {hasEan && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("eanBarcode")}</dt>
                  <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.ean_barcode}</dd>
                </div>
              )}
              {hasWeight && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("weightQuantity")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.weight_or_quantity}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t border-aldi-muted-light pt-4">
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
              >
                {t("editProduct")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
