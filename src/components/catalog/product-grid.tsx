"use client";

import { useTranslations } from "next-intl";
import type { CatalogScoredProduct } from "@/lib/search/scoring-engine";
import { ProductTile } from "./product-tile";

interface ProductGridProps {
  products: CatalogScoredProduct[];
  onProductUpdated?: () => void;
}

export function ProductGrid({ products, onProductUpdated }: ProductGridProps) {
  const t = useTranslations("catalog");

  if (products.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-400">
        {t("noProducts")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
      {products.map((scored) => (
        <ProductTile
          key={scored.product.product_id}
          product={scored.product}
          onProductUpdated={onProductUpdated}
        />
      ))}
    </div>
  );
}
