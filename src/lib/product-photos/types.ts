import type { PhotoCategory } from "./classify-photo-category";

export interface ProductPhoto {
  id: string;
  product_id: string | null;
  competitor_product_id: string | null;
  photo_url: string;
  storage_bucket: string;
  storage_path: string;
  category: PhotoCategory;
  sort_order: number;
  created_at: string;
}

export type ProductType = "aldi" | "competitor";

export function sortPhotos(photos: ProductPhoto[]): ProductPhoto[] {
  const order: Record<PhotoCategory, number> = {
    thumbnail: 0,
    product: 1,
    price_tag: 2,
  };
  return [...photos].sort(
    (a, b) =>
      order[a.category] - order[b.category] || a.sort_order - b.sort_order,
  );
}
