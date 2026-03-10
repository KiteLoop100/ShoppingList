"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { findEanCrossReferences, type EanCrossRefResult } from "@/lib/products/ean-cross-reference";
import { SectionLabel } from "./section-label";
import type { AnyProduct } from "./types";
import { isAldiProduct } from "./types";

interface EanCrossReferenceSectionProps {
  product: AnyProduct;
  labels: {
    title: string;
    priceOrRetailer: string;
  };
}

export function EanCrossReferenceSection({ product, labels }: EanCrossReferenceSectionProps) {
  const [crossRef, setCrossRef] = useState<EanCrossRefResult | null>(null);
  const ean = product.ean_barcode;

  useEffect(() => {
    if (!ean) return;
    let cancelled = false;
    findEanCrossReferences(ean, product.product_id).then((result) => {
      if (!cancelled) setCrossRef(result);
    });
    return () => { cancelled = true; };
  }, [ean, product.product_id]);

  if (!ean || !crossRef) return null;

  const isAldi = isAldiProduct(product);
  const hasAldiMatch = !isAldi && crossRef.aldiProduct != null;
  const hasCompetitorMatches = isAldi && crossRef.competitorProducts.length > 0;

  if (!hasAldiMatch && !hasCompetitorMatches) return null;

  return (
    <div className="mt-4 border-t border-aldi-muted-light pt-3">
      <SectionLabel>{labels.title}</SectionLabel>
      <div className="mt-2 space-y-2">
        {hasAldiMatch && crossRef.aldiProduct && (
          <CrossRefItem
            name={crossRef.aldiProduct.name}
            thumbnailUrl={crossRef.aldiProduct.thumbnail_url ?? undefined}
            detail={crossRef.aldiProduct.price != null ? `€${crossRef.aldiProduct.price.toFixed(2)}` : undefined}
            detailLabel={labels.priceOrRetailer}
          />
        )}
        {hasCompetitorMatches && crossRef.competitorProducts.map((cp) => (
          <CrossRefItem
            key={cp.product_id}
            name={cp.name}
            thumbnailUrl={cp.thumbnail_url ?? undefined}
            detail={cp.retailer ?? undefined}
            detailLabel={labels.priceOrRetailer}
          />
        ))}
      </div>
    </div>
  );
}

function CrossRefItem({
  name,
  thumbnailUrl,
  detail,
  detailLabel,
}: {
  name: string;
  thumbnailUrl?: string;
  detail?: string;
  detailLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt={name}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain"
          unoptimized
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-aldi-text">{name}</p>
        {detail && (
          <p className="text-xs text-aldi-muted">
            {detailLabel}: {detail}
          </p>
        )}
      </div>
    </div>
  );
}
