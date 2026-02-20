"use client";

import type { Product } from "@/types";

export interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

function formatNutritionInfo(info: Record<string, unknown>): string {
  const parts: string[] = [];
  const per100 = (info["per_100g"] ?? info["per 100g"]) as Record<string, unknown> | undefined;
  if (per100 && typeof per100 === "object") {
    const keys = ["energy-kcal", "energy_kcal", "fat", "carbohydrates", "sugars", "protein", "salt", "fiber"];
    for (const k of keys) {
      const v = per100[k];
      if (v != null && v !== "") parts.push(`${k}: ${String(v)}`);
    }
  }
  if (parts.length === 0) return JSON.stringify(info);
  return parts.join(" · ");
}

export function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  if (!product) return null;

  const hasPrice = product.price != null;
  const hasWeightOrQuantity = product.weight_or_quantity != null && product.weight_or_quantity !== "";
  const hasBrand = product.brand != null && product.brand !== "";
  const hasDemandGroup = product.demand_group != null && product.demand_group !== "";
  const hasArticleNumber = product.article_number != null && product.article_number !== "";
  const hasEan = product.ean_barcode != null && product.ean_barcode !== "";
  const hasNutrition = product.nutrition_info != null && typeof product.nutrition_info === "object" && Object.keys(product.nutrition_info).length > 0;
  const hasIngredients = product.ingredients != null && product.ingredients !== "";
  const hasAllergens = product.allergens != null && product.allergens !== "";
  const assortmentLabel = product.assortment_type === "special" ? "Aktionsartikel" : "Dauersortiment";
  const hasSpecialDates = product.special_start_date != null || product.special_end_date != null;
  const specialRange =
    product.special_start_date && product.special_end_date
      ? `${product.special_start_date} – ${product.special_end_date}`
      : product.special_start_date ?? product.special_end_date ?? "";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Produktdetails"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-aldi-muted-light p-4">
            <h2 className="text-lg font-semibold text-aldi-text">Produktdetails</h2>
            <button
              type="button"
              className="touch-target -m-2 rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
              onClick={onClose}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto p-4">
            {/* Product sides: front + back (only front on list; here show both if available) */}
            <div className="mb-4 flex flex-col items-start gap-3">
              <div className="flex flex-wrap items-start gap-3">
                {product.thumbnail_url && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Vorderseite</span>
                    <img
                      src={product.thumbnail_url}
                      alt="Vorderseite"
                      className="h-[150px] w-[150px] shrink-0 rounded-xl object-cover object-center"
                    />
                  </div>
                )}
                {product.thumbnail_back_url && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Rückseite</span>
                    <img
                      src={product.thumbnail_back_url}
                      alt="Rückseite"
                      className="h-[150px] w-[150px] shrink-0 rounded-xl object-cover object-center"
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-aldi-text">{product.name}</p>
                {hasBrand && <p className="mt-0.5 text-sm text-aldi-muted">{product.brand}</p>}
              </div>
            </div>

            {/* Price + quantity/weight (if we had weight_or_quantity on Product we’d show it) */}
            <dl className="space-y-2 border-t border-aldi-muted-light pt-3">
              {hasPrice && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Preis</dt>
                  <dd className="mt-0.5 text-aldi-text">€{product.price!.toFixed(2)}</dd>
                </div>
              )}
              {hasWeightOrQuantity && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Gewicht/Menge</dt>
                  <dd className="mt-0.5 text-aldi-text">{product.weight_or_quantity}</dd>
                </div>
              )}
            </dl>

            {/* Nährwerte / Zutaten / Allergene */}
            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              {hasNutrition && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Nährwerte</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{formatNutritionInfo(product.nutrition_info!)}</dd>
                </div>
              )}
              {hasIngredients && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Zutaten</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.ingredients}</dd>
                </div>
              )}
              {hasAllergens && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Allergene</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.allergens}</dd>
                </div>
              )}
            </dl>

            {/* Sortiment + Aktionszeitraum */}
            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Sortimentstyp</dt>
                <dd className="mt-0.5 text-sm text-aldi-text">{assortmentLabel}</dd>
              </div>
              {hasSpecialDates && specialRange && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Aktionszeitraum</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{specialRange}</dd>
                </div>
              )}
            </dl>

            {/* Technische Infos */}
            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              {hasDemandGroup && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Demand Group</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.demand_group}</dd>
                </div>
              )}
              {hasArticleNumber && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">Artikelnummer</dt>
                  <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.article_number}</dd>
                </div>
              )}
              {hasEan && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">EAN-Barcode</dt>
                  <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.ean_barcode}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
