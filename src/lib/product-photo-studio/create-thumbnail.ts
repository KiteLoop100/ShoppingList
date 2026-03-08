/**
 * Stage 3: Create a professional product thumbnail.
 * 3a: Select the best front-facing photo(s) based on quality metrics.
 *     If no single photo scores above the threshold, process the top 2 in parallel.
 * 3b: Remove background via provider chain.
 * 3c-3d: Enhance and composite via shared image-enhance module.
 */

import sharp from "sharp";
import { removeBackground } from "./background-removal";
import { enhanceProduct, removeReflections, compositeOnCanvas, FULL_SIZE, THUMB_SIZE } from "./image-enhance";
import { getProductBoundingBox, detectTextRotation, detectTiltCorrection } from "@/lib/api/photo-processing/image-utils";
import { log } from "@/lib/utils/logger";
import type {
  PhotoInput,
  PhotoClassification,
  ClassificationResponse,
  ThumbnailResult,
} from "./types";

export { enhanceProduct, removeReflections, compositeOnCanvas, FULL_SIZE, THUMB_SIZE } from "./image-enhance";

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

const PRECROP_MARGIN = 0.20;
const MIN_PAD_PX = 50;

/**
 * 3b-pre: Crop to product region before background removal.
 * Uses Claude-guided bounding box to remove table/shelf/hand areas,
 * giving remove.bg a cleaner source image.
 * Padding is the larger of 20% of crop dimension or 50px per side,
 * preventing tall/narrow products from being clipped.
 */
export async function preCropToProduct(imageBuffer: Buffer): Promise<Buffer> {
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) return oriented;
  try {
    const base64 = oriented.toString("base64");

    const [cropRegion, rotation] = await Promise.all([
      getProductBoundingBox(base64, "image/jpeg", width, height),
      detectTextRotation(base64, "image/jpeg"),
    ]);

    let output = oriented;

    if (cropRegion) {
      const padX = Math.max(MIN_PAD_PX, Math.round(cropRegion.crop_width * PRECROP_MARGIN));
      const padY = Math.max(MIN_PAD_PX, Math.round(cropRegion.crop_height * PRECROP_MARGIN));
      const left = Math.max(0, cropRegion.crop_x - padX);
      const top = Math.max(0, cropRegion.crop_y - padY);
      const cropWidth = Math.min(width - left, cropRegion.crop_width + 2 * padX);
      const cropHeight = Math.min(height - top, cropRegion.crop_height + 2 * padY);

      log.debug(
        "[photo-studio] pre-crop: bbox",
        `${cropRegion.crop_width}x${cropRegion.crop_height}`,
        "pad", `${padX}x${padY}`,
        "final", `${cropWidth}x${cropHeight}`,
      );

      output = await sharp(oriented)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .toBuffer();
    }

    if (rotation !== 0) {
      log.debug("[photo-studio] applying content-aware rotation:", rotation, "degrees");
      output = await sharp(output)
        .rotate(rotation, { background: { r: 255, g: 255, b: 255 } })
        .toBuffer();

      const tiltBase64 = output.toString("base64");
      const tilt = await detectTiltCorrection(tiltBase64, "image/jpeg");
      if (tilt !== 0) {
        log.debug("[photo-studio] applying tilt correction:", tilt, "degrees");
        output = await sharp(output)
          .rotate(tilt, { background: { r: 255, g: 255, b: 255 } })
          .toBuffer();
      }
    }

    return output;
  } catch (err) {
    log.warn("[photo-studio] pre-crop failed, using original:", err instanceof Error ? err.message : err);
    return oriented;
  }
}

/**
 * Check if non-transparent content touches any edge of the image,
 * which indicates the product was likely clipped by the bounding box.
 */
async function isProductClipped(imageBuffer: Buffer, hasAlpha: boolean): Promise<boolean> {
  if (!hasAlpha) return false;
  try {
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels < 4) return false;

    const ALPHA_THRESHOLD = 128;
    const EDGE_SAMPLE_RATIO = 0.15;
    let opaqueEdgePixels = 0;
    let totalEdgePixels = 0;

    for (let x = 0; x < width; x++) {
      const topAlpha = data[(x * channels) + 3];
      const bottomAlpha = data[((height - 1) * width + x) * channels + 3];
      if (topAlpha >= ALPHA_THRESHOLD) opaqueEdgePixels++;
      if (bottomAlpha >= ALPHA_THRESHOLD) opaqueEdgePixels++;
      totalEdgePixels += 2;
    }
    for (let y = 0; y < height; y++) {
      const leftAlpha = data[(y * width) * channels + 3];
      const rightAlpha = data[(y * width + width - 1) * channels + 3];
      if (leftAlpha >= ALPHA_THRESHOLD) opaqueEdgePixels++;
      if (rightAlpha >= ALPHA_THRESHOLD) opaqueEdgePixels++;
      totalEdgePixels += 2;
    }

    const edgeRatio = opaqueEdgePixels / totalEdgePixels;
    if (edgeRatio > EDGE_SAMPLE_RATIO) {
      log.warn("[photo-studio] product clipped: ", (edgeRatio * 100).toFixed(1) + "% opaque edge pixels");
      return true;
    }
    return false;
  } catch (err) {
    log.warn("[photo-studio] clipping check failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Shared thumbnail processing: bg removal -> enhance -> composite.
 * Used by both the photo studio pipeline and the single-photo capture flow.
 */
export async function processImageToThumbnail(
  imageBuffer: Buffer,
  skipPreCrop = false,
): Promise<ThumbnailResult> {
  const input = skipPreCrop ? imageBuffer : await preCropToProduct(imageBuffer);
  const bgResult = await removeBackground(input);
  const deReflected = await removeReflections(bgResult.imageBuffer);
  const enhanced = await enhanceProduct(deReflected);
  const addShadow = bgResult.hasTransparency;

  if (bgResult.hasTransparency && !skipPreCrop) {
    const clipped = await isProductClipped(bgResult.imageBuffer, true);
    if (clipped) {
      log.warn("[photo-studio] retrying without pre-crop due to clipping");
      return processImageToThumbnail(imageBuffer, true);
    }
  }

  const [fullSizeResult, thumbnailResult] = await Promise.all([
    compositeOnCanvas(enhanced, FULL_SIZE, addShadow),
    compositeOnCanvas(enhanced, THUMB_SIZE, false),
  ]);

  const bgFailed =
    (bgResult.providerUsed === "crop-fallback" && !bgResult.noProvidersConfigured)
    || bgResult.providerUsed === "none";
  if (bgFailed) {
    log.warn("[photo-studio] background removal failed, provider:", bgResult.providerUsed);
  }

  return {
    fullSize: fullSizeResult.buffer,
    fullSizeFormat: fullSizeResult.format,
    thumbnail: thumbnailResult.buffer,
    thumbnailFormat: thumbnailResult.format,
    backgroundRemoved: bgResult.hasTransparency,
    backgroundProvider: bgResult.providerUsed,
    backgroundRemovalFailed: bgFailed,
  };
}

async function processCandidate(photo: PhotoInput): Promise<ThumbnailResult> {
  return processImageToThumbnail(photo.buffer);
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
