"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getLatestPrices } from "@/lib/competitor-products/competitor-product-service";
import type { CompetitorProduct, CompetitorProductPrice } from "@/types";
import { BaseModal } from "@/components/ui/base-modal";
import { ProductDetailView } from "@/components/product-detail";

export interface CompetitorProductDetailModalProps {
  product: CompetitorProduct | null;
  onClose: () => void;
  onEdit: (product: CompetitorProduct) => void;
  retailer?: string | null;
}

export function CompetitorProductDetailModal({
  product,
  onClose,
  onEdit,
  retailer: retailerProp,
}: CompetitorProductDetailModalProps) {
  const t = useTranslations("competitorDetail");
  const [prices, setPrices] = useState<CompetitorProductPrice[]>([]);

  const productId = product?.product_id ?? null;

  useEffect(() => {
    if (!productId) return;
    getLatestPrices(productId).then(setPrices);
  }, [productId]);

  if (!product) return null;

  const retailerNames = prices.length > 0
    ? [...new Set(prices.map((p) => p.retailer))]
    : (retailerProp ? [retailerProp] : []);

  return (
    <BaseModal open={!!product} onClose={onClose} title={t("title")}>
      <ProductDetailView
        product={product}
        competitorPrices={prices}
        retailerNames={retailerNames}
      >
        <div className="mt-4 border-t border-aldi-muted-light pt-4">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="min-h-touch w-full rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:bg-aldi-blue/10"
          >
            {t("editProduct")}
          </button>
        </div>
      </ProductDetailView>
    </BaseModal>
  );
}
