"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { translateCategoryName } from "@/lib/i18n/category-translations";
import { useAutoReorder } from "@/hooks/use-auto-reorder";
import type { ReorderUnit } from "@/hooks/use-auto-reorder";
import type { Product } from "@/types";
import { formatNutritionInfo } from "@/lib/products/nutrition-utils";

export interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  onReorderChanged?: () => void;
}

const UNIT_OPTIONS: ReorderUnit[] = ["days", "weeks", "months"];
const VALUE_OPTIONS = Array.from({ length: 99 }, (_, i) => i + 1);

export function ProductDetailModal({ product, onClose, onEdit, onReorderChanged }: ProductDetailModalProps) {
  const t = useTranslations("productDetail");
  const tReorder = useTranslations("autoReorder");
  const locale = useLocale();

  const {
    reorderEnabled,
    reorderValue,
    reorderUnit,
    reorderLoading,
    nextReorderDate,
    loadReorderSetting,
    handleToggleReorder,
    handleValueChange,
    handleUnitChange,
  } = useAutoReorder(onReorderChanged);

  const productId = product?.product_id ?? null;

  useEffect(() => {
    if (!productId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    loadReorderSetting(productId);
    return () => { document.body.style.overflow = prev; };
  }, [productId, loadReorderSetting]);

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
  const assortmentLabel =
    product.assortment_type === "special_food" ? t("assortmentSpecialFood") :
    product.assortment_type === "special_nonfood" ? t("assortmentSpecialNonfood") :
    product.assortment_type === "special" ? t("assortmentSpecial") : t("assortmentDailyRange");
  const hasSpecialDates = product.special_start_date != null || product.special_end_date != null;
  const specialRange =
    product.special_start_date && product.special_end_date
      ? `${product.special_start_date} – ${product.special_end_date}`
      : product.special_start_date ?? product.special_end_date ?? "";

  const unitLabel = (u: ReorderUnit) =>
    u === "days" ? tReorder("unitDays") : u === "weeks" ? tReorder("unitWeeks") : tReorder("unitMonths");

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
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("frontSide")}</span>
                    <img
                      src={product.thumbnail_url}
                      alt={t("frontSide")}
                      className="h-[150px] w-[150px] shrink-0 rounded-xl object-cover object-center"
                    />
                  </div>
                )}
                {product.thumbnail_back_url && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("backSide")}</span>
                    <img
                      src={product.thumbnail_back_url}
                      alt={t("backSide")}
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

            <dl className="space-y-2 border-t border-aldi-muted-light pt-3">
              {hasPrice && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("price")}</dt>
                  <dd className="mt-0.5 text-aldi-text">€{product.price!.toFixed(2)}</dd>
                </div>
              )}
              {hasWeightOrQuantity && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("weightQuantity")}</dt>
                  <dd className="mt-0.5 text-aldi-text">{product.weight_or_quantity}</dd>
                </div>
              )}
            </dl>

            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              {hasNutrition && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("nutritionInfo")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{formatNutritionInfo(product.nutrition_info!)}</dd>
                </div>
              )}
              {hasIngredients && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("ingredients")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.ingredients}</dd>
                </div>
              )}
              {hasAllergens && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("allergens")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{product.allergens}</dd>
                </div>
              )}
            </dl>

            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("assortmentType")}</dt>
                <dd className="mt-0.5 text-sm text-aldi-text">{assortmentLabel}</dd>
              </div>
              {hasSpecialDates && specialRange && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("specialPeriod")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{specialRange}</dd>
                </div>
              )}
            </dl>

            <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
              {hasDemandGroup && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("demandGroup")}</dt>
                  <dd className="mt-0.5 text-sm text-aldi-text">{translateCategoryName(product.demand_group!, locale)}</dd>
                </div>
              )}
              {hasArticleNumber && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("articleNumber")}</dt>
                  <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.article_number}</dd>
                </div>
              )}
              {hasEan && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">{t("eanBarcode")}</dt>
                  <dd className="mt-0.5 text-sm font-mono text-aldi-text">{product.ean_barcode}</dd>
                </div>
              )}
            </dl>

            {/* Auto-Reorder Section */}
            <div className="mt-4 border-t border-aldi-muted-light pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-aldi-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  <span className="text-sm font-medium text-aldi-text">{tReorder("title")}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReorder}
                  disabled={reorderLoading}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aldi-blue focus:ring-offset-2 disabled:opacity-50 ${
                    reorderEnabled ? "bg-aldi-blue" : "bg-gray-200"
                  }`}
                  role="switch"
                  aria-checked={reorderEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      reorderEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {reorderEnabled && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-aldi-muted">{tReorder("every")}</span>
                    <select
                      value={reorderValue}
                      onChange={(e) => handleValueChange(Number(e.target.value))}
                      className="rounded-lg border border-aldi-muted-light bg-gray-50 px-2 py-1.5 text-sm font-medium text-aldi-text focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
                    >
                      {VALUE_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <select
                      value={reorderUnit}
                      onChange={(e) => handleUnitChange(e.target.value as ReorderUnit)}
                      className="rounded-lg border border-aldi-muted-light bg-gray-50 px-2 py-1.5 text-sm font-medium text-aldi-text focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{unitLabel(u)}</option>
                      ))}
                    </select>
                  </div>
                  {nextReorderDate && (
                    <p className="text-xs text-aldi-muted">
                      {tReorder("nextReorder", {
                        date: new Date(nextReorderDate + "T00:00:00").toLocaleDateString(
                          locale === "de" ? "de-DE" : "en-US",
                          { weekday: "short", day: "2-digit", month: "2-digit" }
                        ),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {onEdit && (
              <div className="mt-4 border-t border-aldi-muted-light pt-4">
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="min-h-touch w-full rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
                >
                  {t("editProduct")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
