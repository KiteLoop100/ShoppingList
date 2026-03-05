/**
 * Stage 3: Create a professional product thumbnail.
 * 3a: Select the best front-facing photo based on quality metrics.
 * 3b: Remove background via provider chain.
 * 3c: Enhance and standardize to 800x800 + 150x150 thumbnails.
 */

import sharp from "sharp";
import { removeBackground } from "./background-removal";
import { getProductBoundingBox } from "@/lib/api/photo-processing/image-utils";
import { log } from "@/lib/utils/logger";
import type {
  PhotoInput,
  ClassificationResponse,
  ThumbnailResult,
} from "./types";

const FULL_SIZE = 800;
const THUMB_SIZE = 150;
const PADDING_RATIO = 0.08;
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
 * 3b-pre: Crop to product region before background removal.
 * Uses Claude-guided bounding box to remove table/shelf/hand areas,
 * giving remove.bg a cleaner source image.
 * Falls back to the oriented original if detection fails.
 */
async function preCropToProduct(imageBuffer: Buffer): Promise<Buffer> {
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) return oriented;
  try {
    const base64 = oriented.toString("base64");
    const box = await getProductBoundingBox(base64, "image/jpeg", width, height);
    if (!box) return oriented;
    return sharp(oriented)
      .extract({ left: box.crop_x, top: box.crop_y, width: box.crop_width, height: box.crop_height })
      .toBuffer();
  } catch (err) {
    log.warn("[photo-studio] pre-crop failed, using original:", err instanceof Error ? err.message : err);
    return oriented;
  }
}

/**
 * 3c: Enhance the image and produce standardized output.
 * Phase 1: Flatten alpha, denoise, gentle color correction, sharpen.
 * Phase 2: Add padding so the product "breathes", then resize.
 */
async function enhanceAndStandardize(
  imageBuffer: Buffer,
  size: number,
): Promise<Buffer> {
  const pad = Math.round(size * PADDING_RATIO);

  const enhanced = await sharp(imageBuffer)
    .rotate()
    .flatten({ background: WHITE })
    .median(3)
    .modulate({ brightness: 1.03, saturation: 1.06 })
    .sharpen({ sigma: 0.8 })
    .toBuffer();

  const padded = await sharp(enhanced)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: WHITE })
    .toBuffer();

  return sharp(padded)
    .resize(size, size, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function createThumbnail(
  images: PhotoInput[],
  classification: ClassificationResponse,
): Promise<ThumbnailResult> {
  const bestPhoto = selectBestPhoto(images, classification);

  const preCropped = await preCropToProduct(bestPhoto.buffer);
  const bgRemoved = await removeBackground(preCropped);

  const [fullSize, thumbnail] = await Promise.all([
    enhanceAndStandardize(bgRemoved, FULL_SIZE),
    enhanceAndStandardize(bgRemoved, THUMB_SIZE),
  ]);

  return { fullSize, thumbnail };
}
