import type { PhotoType } from "@/lib/product-photo-studio/types";

export type PhotoCategory = "thumbnail" | "product" | "price_tag";

const PRODUCT_TYPES: ReadonlySet<PhotoType> = new Set([
  "product_front",
  "product_back",
  "product_side",
]);

/**
 * Maps a pipeline PhotoType to a gallery PhotoCategory.
 * Returns null for non-product types (shelf, barcode, other) —
 * callers must decide whether to discard or let the user classify manually.
 */
export function toPhotoCategory(photoType: PhotoType): PhotoCategory | null {
  if (photoType === "price_tag") return "price_tag";
  if (PRODUCT_TYPES.has(photoType)) return "product";
  return null;
}

/**
 * Picks the best candidate for thumbnail among classified photos.
 * Prefers product_front, then product_side, ranked by quality score.
 * Returns the index into the input array, or null if no candidate.
 */
export function selectThumbnailIndex(
  photos: Array<{ photoType: PhotoType; qualityScore: number }>,
): number | null {
  const candidates = photos
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) =>
      p.photoType === "product_front" || p.photoType === "product_side",
    )
    .sort((a, b) => b.qualityScore - a.qualityScore);
  return candidates[0]?.index ?? null;
}
