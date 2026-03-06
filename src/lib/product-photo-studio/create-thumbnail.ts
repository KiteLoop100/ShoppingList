/**
 * Stage 3: Create a professional product thumbnail.
 * 3a: Select the best front-facing photo(s) based on quality metrics.
 *     If no single photo scores above the threshold, process the top 2 in parallel.
 * 3b: Remove background via provider chain.
 * 3c-3d: Enhance and composite via shared image-enhance module.
 */

import sharp from "sharp";
import { removeBackground } from "./background-removal";
import { enhanceProduct, compositeOnCanvas, FULL_SIZE, THUMB_SIZE } from "./image-enhance";
import { getProductBoundingBox } from "@/lib/api/photo-processing/image-utils";
import { log } from "@/lib/utils/logger";
import type {
  PhotoInput,
  PhotoClassification,
  ClassificationResponse,
  ThumbnailResult,
} from "./types";

export { enhanceProduct, compositeOnCanvas, FULL_SIZE, THUMB_SIZE } from "./image-enhance";

const HERO_QUALITY_THRESHOLD = 0.75;

/**
 * 3a: Select the best candidate photo(s) for the thumbnail.
 * Returns 1 photo if the best candidate scores above the threshold,
 * or up to 2 photos for parallel processing when quality is uncertain.
 */
function selectHeroCandidates(
  images: PhotoInput[],
  classification: ClassificationResponse,
): PhotoInput[] {
  if (images.length === 1) return [images[0]];

  const eligiblePhotos = classification.photos
    .filter((p) => p.is_product_photo && p.photo_type !== "price_tag" && p.photo_type !== "barcode")
    .sort((a, b) => {
      const aIsFront = a.photo_type === "product_front" ? 1 : 0;
      const bIsFront = b.photo_type === "product_front" ? 1 : 0;
      if (aIsFront !== bIsFront) return bIsFront - aIsFront;
      return b.quality_score - a.quality_score;
    });

  if (eligiblePhotos.length === 0) return [images[0]];

  const best = eligiblePhotos[0];
  const resolve = (p: PhotoClassification) =>
    p.photo_index >= 0 && p.photo_index < images.length
      ? images[p.photo_index]
      : null;

  const bestImage = resolve(best);
  if (!bestImage) return [images[0]];

  if (best.quality_score >= HERO_QUALITY_THRESHOLD || eligiblePhotos.length < 2) {
    return [bestImage];
  }

  const secondImage = resolve(eligiblePhotos[1]);
  if (secondImage) {
    log.debug(
      "[photo-studio] best hero score",
      best.quality_score.toFixed(2),
      "< threshold, processing top 2 in parallel",
    );
    return [bestImage, secondImage];
  }

  return [bestImage];
}

/** Margin added around the AI-detected bounding box so tall/narrow products (e.g. bottles) are not clipped. */
const PRECROP_MARGIN = 0.15;

/**
 * 3b-pre: Crop to product region before background removal.
 * Uses Claude-guided bounding box to remove table/shelf/hand areas,
 * giving remove.bg a cleaner source image.
 * An 8% margin is added on all sides so tall products like bottles
 * are never cut off by overly tight AI bounding boxes.
 */
export async function preCropToProduct(imageBuffer: Buffer): Promise<Buffer> {
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) return oriented;
  try {
    const base64 = oriented.toString("base64");
    const box = await getProductBoundingBox(base64, "image/jpeg", width, height);
    if (!box) return oriented;

    const padX = Math.round(box.crop_width * PRECROP_MARGIN);
    const padY = Math.round(box.crop_height * PRECROP_MARGIN);
    const left = Math.max(0, box.crop_x - padX);
    const top = Math.max(0, box.crop_y - padY);
    const cropWidth = Math.min(width - left, box.crop_width + 2 * padX);
    const cropHeight = Math.min(height - top, box.crop_height + 2 * padY);

    return sharp(oriented)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toBuffer();
  } catch (err) {
    log.warn("[photo-studio] pre-crop failed, using original:", err instanceof Error ? err.message : err);
    return oriented;
  }
}

async function processCandidate(photo: PhotoInput): Promise<ThumbnailResult> {
  const preCropped = await preCropToProduct(photo.buffer);
  const bgResult = await removeBackground(preCropped);
  const enhanced = await enhanceProduct(bgResult.imageBuffer);
  const addShadow = bgResult.hasTransparency;

  const [fullSizeResult, thumbnailResult] = await Promise.all([
    compositeOnCanvas(enhanced, FULL_SIZE, addShadow),
    compositeOnCanvas(enhanced, THUMB_SIZE, false),
  ]);

  return {
    fullSize: fullSizeResult.buffer,
    fullSizeFormat: fullSizeResult.format,
    thumbnail: thumbnailResult.buffer,
    thumbnailFormat: thumbnailResult.format,
  };
}

/**
 * Pick the better result from two candidates by comparing sharpness
 * via the variance of the Laplacian (higher = sharper).
 */
async function pickBetterResult(
  a: ThumbnailResult,
  b: ThumbnailResult,
): Promise<ThumbnailResult> {
  const [statsA, statsB] = await Promise.all([
    sharp(a.fullSize).stats(),
    sharp(b.fullSize).stats(),
  ]);

  const sharpnessA = statsA.sharpness;
  const sharpnessB = statsB.sharpness;
  log.debug("[photo-studio] candidate sharpness:", sharpnessA.toFixed(1), "vs", sharpnessB.toFixed(1));

  return sharpnessA >= sharpnessB ? a : b;
}

export async function createThumbnail(
  images: PhotoInput[],
  classification: ClassificationResponse,
): Promise<ThumbnailResult> {
  const candidates = selectHeroCandidates(images, classification);

  if (candidates.length === 1) {
    return processCandidate(candidates[0]);
  }

  const results = await Promise.all(candidates.map(processCandidate));
  return pickBetterResult(results[0], results[1]);
}
