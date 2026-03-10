"use client";

import Image from "next/image";
import type { ProductPhoto } from "@/lib/product-photos/types";
import type { AnyProduct, ProductImage } from "./types";
import { getProductImages } from "./types";

interface ProductHeaderSectionProps {
  product: AnyProduct;
  imageLabels: Record<string, string>;
  retailerNames?: string[];
  productPhotos?: ProductPhoto[];
  offlineHint?: string;
}

export function ProductHeaderSection({
  product,
  imageLabels,
  retailerNames,
  productPhotos,
  offlineHint,
}: ProductHeaderSectionProps) {
  const images: ProductImage[] = getProductImages(product, productPhotos);
  const hasBrand = product.brand != null && product.brand !== "";
  const hasExtraPhotos = productPhotos && productPhotos.length > 1;

  return (
    <div className="mb-4 flex flex-col items-start gap-3">
      {images.length > 0 && (
        <div className="flex flex-wrap items-start gap-3">
          {images.map((img) => (
            <div key={img.url} className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-aldi-muted">
                {imageLabels[img.label] ?? img.label}
              </span>
              <Image
                src={img.url}
                alt={imageLabels[img.label] ?? img.label}
                width={150}
                height={150}
                className="h-[150px] w-[150px] shrink-0 rounded-xl bg-white object-contain object-center"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}
      {offlineHint && !hasExtraPhotos && (
        <p className="text-[11px] italic text-aldi-muted">{offlineHint}</p>
      )}
      <div className="min-w-0">
        <p className="text-base font-medium text-aldi-text">{product.name}</p>
        {hasBrand && <p className="mt-0.5 text-sm text-aldi-muted">{product.brand}</p>}
        {retailerNames && retailerNames.length > 0 && (
          <p className="mt-1 text-sm text-aldi-muted">
            <span className="mr-1">🏪</span>
            {retailerNames.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
