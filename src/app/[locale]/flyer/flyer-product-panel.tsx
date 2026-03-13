"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ProductRow } from "@/lib/flyers/flyer-service";

export interface FlyerProductPanelProps {
  productsByPage: Map<number, ProductRow[]>;
  productIdsOnList: Set<string>;
  onAddProduct: (product: ProductRow) => void;
}

export function FlyerProductPanel({
  productsByPage,
  productIdsOnList,
  onAddProduct,
}: FlyerProductPanelProps) {
  const t = useTranslations("flyer");

  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    const result: ProductRow[] = [];
    for (const [, products] of Array.from(productsByPage.entries()).sort((a, b) => a[0] - b[0])) {
      for (const p of products) {
        if (!seen.has(p.product_id)) {
          seen.add(p.product_id);
          result.push(p);
        }
      }
    }
    return result;
  }, [productsByPage]);

  if (allProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-aldi-muted">{t("noPages")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-4">
      <h2 className="mb-2 text-sm font-semibold text-aldi-muted uppercase tracking-wider">
        {t("productsOnPage")} ({allProducts.length})
      </h2>
      <ul className="flex flex-col gap-1">
        {allProducts.map((product) => {
          const onList = productIdsOnList.has(product.product_id);
          const displayPrice = product.price_in_flyer ?? product.price;
          return (
            <li
              key={product.product_id}
              className="flex min-h-touch items-center justify-between gap-3 rounded-lg bg-aldi-muted-light/30 px-3 py-2 transition-shadow pointer-fine:hover:shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium text-aldi-text">
                  {product.name}
                </span>
                {displayPrice != null && (
                  <span className="text-sm tabular-nums text-aldi-muted">
                    {"\u20AC"}{displayPrice.toFixed(2)}
                  </span>
                )}
              </div>
              {onList ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aldi-blue/10 text-aldi-blue" aria-label={t("alreadyOnList")}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
              ) : (
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-aldi-blue text-aldi-blue transition-colors pointer-fine:hover:bg-aldi-blue pointer-fine:hover:text-white active:bg-aldi-blue active:text-white"
                  onClick={() => onAddProduct(product)}
                  aria-label={t("addToList")}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
