import type { Product, CompetitorProduct } from "@/types";
import type { ProductPhoto } from "@/lib/product-photos/types";
import { sortPhotos } from "@/lib/product-photos/types";

export type AnyProduct = Product | CompetitorProduct;

export function isAldiProduct(p: AnyProduct): p is Product {
  return "source" in p && "availability" in p;
}

export function isCompetitorProduct(p: AnyProduct): p is CompetitorProduct {
  return !isAldiProduct(p);
}

export interface ProductImage {
  url: string;
  label: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  thumbnail: "mainPhoto",
  product: "productPhoto",
  price_tag: "priceTag",
};

/**
 * Builds display images from product_photos (new system) with fallback
 * to the old thumbnail_url / thumbnail_back_url / other_photo_url columns.
 */
export function getProductImages(
  p: AnyProduct,
  productPhotos?: ProductPhoto[],
): ProductImage[] {
  if (productPhotos && productPhotos.length > 0) {
    return sortPhotos(productPhotos).map((photo) => ({
      url: photo.photo_url,
      label: CATEGORY_LABELS[photo.category] ?? photo.category,
    }));
  }

  const images: ProductImage[] = [];
  if (p.thumbnail_url) {
    images.push({ url: p.thumbnail_url, label: "front" });
  }
  if (isAldiProduct(p) && p.thumbnail_back_url) {
    images.push({ url: p.thumbnail_back_url, label: "back" });
  }
  if (isCompetitorProduct(p) && p.other_photo_url) {
    images.push({ url: p.other_photo_url, label: "other" });
  }
  return images;
}
