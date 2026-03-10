import type { Product, CompetitorProduct } from "@/types";

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

export function getProductImages(p: AnyProduct): ProductImage[] {
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
