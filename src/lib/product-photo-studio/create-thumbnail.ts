/**
 * Stage 3: Create a professional product thumbnail.
 * 3a: Select the best front-facing photo based on quality metrics.
 * 3b: Remove background via provider chain.
 * 3c: Enhance and standardize to 800x800 + 150x150 thumbnails.
 */

import sharp from "sharp";
import { removeBackground } from "./background-removal";
import type {
  PhotoInput,
  ClassificationResponse,
  ThumbnailResult,
} from "./types";

const FULL_SIZE = 800;
const THUMB_SIZE = 150;
const WHITE = { r: 255, g: 255, b: 255 };

/**
 * 3a: Pick the best photo for the thumbnail.
 * Prefers product_front photos, then ranks by quality_score from classification.
 * Falls back to the first photo if no classification data matches.
 */
function selectBestPhoto(
  images: PhotoInput[],
  classification: ClassificationResponse,
): PhotoInput {
  if (images.length === 1) return images[0];

  const frontPhotos = classification.photos
    .filter((p) => p.photo_type === "product_front" && p.is_product_photo)
    .sort((a, b) => b.quality_score - a.quality_score);

  if (frontPhotos.length > 0) {
    const idx = frontPhotos[0].photo_index;
    if (idx >= 0 && idx < images.length) return images[idx];
  }

  const allByQuality = classification.photos
    .filter((p) => p.is_product_photo && p.photo_type !== "price_tag" && p.photo_type !== "barcode")
    .sort((a, b) => b.quality_score - a.quality_score);

  if (allByQuality.length > 0) {
    const idx = allByQuality[0].photo_index;
    if (idx >= 0 && idx < images.length) return images[idx];
  }

  return images[0];
}

/**
 * 3c: Enhance the image and produce standardized output.
 * - EXIF rotation
 * - Histogram normalization for consistent exposure
 * - Mild sharpen for crisp detail
 * - Resize to target on white background
 */
async function enhanceAndStandardize(
  imageBuffer: Buffer,
  size: number,
): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .normalize()
    .sharpen({ sigma: 1.0 })
    .resize(size, size, {
      fit: "contain",
      background: WHITE,
    })
    .flatten({ background: WHITE })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function createThumbnail(
  images: PhotoInput[],
  classification: ClassificationResponse,
): Promise<ThumbnailResult> {
  const bestPhoto = selectBestPhoto(images, classification);

  const bgRemoved = await removeBackground(bestPhoto.buffer);

  const [fullSize, thumbnail] = await Promise.all([
    enhanceAndStandardize(bgRemoved, FULL_SIZE),
    enhanceAndStandardize(bgRemoved, THUMB_SIZE),
  ]);

  return { fullSize, thumbnail };
}
