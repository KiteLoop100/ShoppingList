/**
 * Stage 3: Create a professional product thumbnail.
 * 3a: Select the best front-facing photo(s) based on quality metrics.
 *     If no single photo scores above the threshold, process the top 2 in parallel.
 * 3b: Remove background via provider chain.
 * 3c-3d: Enhance and composite via shared image-enhance module.
 */

import sharp from "sharp";
import { removeBackground } from "./background-removal";
import { calculateEdgeQualityScore } from "./edge-quality";
import { enhanceProduct, removeReflections, compositeOnCanvas, FULL_SIZE, THUMB_SIZE } from "./image-enhance";
import { geminiSmartPreCrop, claudeSmartPreCrop } from "./gemini-bbox";
import type { PreCropData, PreCropPhotoType } from "./gemini-bbox";
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

const PRECROP_MARGIN_PRICE_TAG = 0.05;
const MIN_PAD_PX_PRICE_TAG = 20;

interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transform bbox coordinates for a cardinal rotation (90/180/270).
 * The AI returns bbox relative to the original orientation;
 * after rotating the full image we need to map those coordinates
 * into the new coordinate system.
 */
export function transformBboxForCardinalRotation(
  bbox: Bbox,
  origW: number,
  origH: number,
  rotation: 0 | 90 | 180 | 270,
): Bbox {
  switch (rotation) {
    case 90:
      return {
        x: origH - bbox.y - bbox.height,
        y: bbox.x,
        width: bbox.height,
        height: bbox.width,
      };
    case 180:
      return {
        x: origW - bbox.x - bbox.width,
        y: origH - bbox.y - bbox.height,
        width: bbox.width,
        height: bbox.height,
      };
    case 270:
      return {
        x: bbox.y,
        y: origW - bbox.x - bbox.width,
        width: bbox.height,
        height: bbox.width,
      };
    default:
      return { ...bbox };
  }
}

/**
 * Apply PreCropData to an image buffer.
 *
 * Order: rotate on the FULL image first, then transform bbox
 * coordinates into the rotated coordinate system, then crop.
 * This avoids white-corner artifacts from rotating a cropped region
 * and ensures the bbox aligns correctly after straightening.
 */
async function applyPreCropData(
  imageBuffer: Buffer,
  data: PreCropData,
  imgWidth: number,
  imgHeight: number,
  photoType?: PreCropPhotoType,
): Promise<Buffer> {
  let output = imageBuffer;
  let currentW = imgWidth;
  let currentH = imgHeight;

  if (data.rotation !== 0) {
    log.debug("[photo-studio] applying rotation:", data.rotation, "degrees");
    output = await sharp(output)
      .rotate(data.rotation, { background: { r: 255, g: 255, b: 255 } })
      .toBuffer();
    const meta = await sharp(output).metadata();
    currentW = meta.width ?? currentW;
    currentH = meta.height ?? currentH;
  }

  const rotatedBbox = transformBboxForCardinalRotation(
    data.bbox, imgWidth, imgHeight, data.rotation,
  );

  rotatedBbox.x = Math.max(0, rotatedBbox.x);
  rotatedBbox.y = Math.max(0, rotatedBbox.y);
  rotatedBbox.width = Math.min(currentW - rotatedBbox.x, Math.max(1, rotatedBbox.width));
  rotatedBbox.height = Math.min(currentH - rotatedBbox.y, Math.max(1, rotatedBbox.height));

  const margin = photoType === "price_tag" ? PRECROP_MARGIN_PRICE_TAG : PRECROP_MARGIN;
  const minPad = photoType === "price_tag" ? MIN_PAD_PX_PRICE_TAG : MIN_PAD_PX;
  const padX = Math.max(minPad, Math.round(rotatedBbox.width * margin));
  const padY = Math.max(minPad, Math.round(rotatedBbox.height * margin));
  const left = Math.max(0, rotatedBbox.x - padX);
  const top = Math.max(0, rotatedBbox.y - padY);
  const cropWidth = Math.min(currentW - left, rotatedBbox.width + 2 * padX);
  const cropHeight = Math.min(currentH - top, rotatedBbox.height + 2 * padY);

  log.debug("[photo-studio] pre-crop: bbox",
    `${rotatedBbox.width}x${rotatedBbox.height}`,
    "pad", `${padX}x${padY}`,
    "final", `${cropWidth}x${cropHeight}`);

  output = await sharp(output)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .toBuffer();

  return output;
}

/**
 * 3b-pre: Crop to product region before background removal.
 * Uses a single Gemini Flash call for bbox + rotation detection,
 * with a consolidated Claude Sonnet call as fallback.
 * Padding is the larger of 20% of crop dimension or 50px per side,
 * preventing tall/narrow products from being clipped.
 */
export async function preCropToProduct(
  imageBuffer: Buffer,
  photoType?: PreCropPhotoType,
): Promise<Buffer> {
  const oriented = await sharp(imageBuffer).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(oriented).metadata();
  if (!width || !height) return oriented;

  try {
    let preCropData = await geminiSmartPreCrop(oriented, photoType);

    if (!preCropData) {
      log.debug("[photo-studio] Gemini pre-crop returned null, trying Claude fallback");
      preCropData = await claudeSmartPreCrop(oriented, photoType);
    }

    if (!preCropData) {
      log.debug("[photo-studio] no pre-crop data from either provider, using original");
      return oriented;
    }

    return await applyPreCropData(oriented, preCropData, width, height, photoType);
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
 * Soft-fallback: enhance the cropped image and composite on a white
 * background without drop shadow. Used when all BG removal providers fail.
 */
async function softFallback(croppedImage: Buffer): Promise<ThumbnailResult> {
  log.warn("[photo-studio] all BG removal providers failed — using soft-fallback (white background)");
  const enhanced = await enhanceProduct(croppedImage);
  const [fullSizeResult, thumbnailResult] = await Promise.all([
    compositeOnCanvas(enhanced, FULL_SIZE, false),
    compositeOnCanvas(enhanced, THUMB_SIZE, false),
  ]);
  return {
    fullSize: fullSizeResult.buffer,
    fullSizeFormat: fullSizeResult.format,
    thumbnail: thumbnailResult.buffer,
    thumbnailFormat: thumbnailResult.format,
    backgroundRemoved: false,
    backgroundProvider: "soft-fallback",
    backgroundRemovalFailed: true,
  };
}

/**
 * Shared thumbnail processing: bg removal -> enhance -> composite.
 * Used by both the photo studio pipeline and the single-photo capture flow.
 *
 * Flow:
 * 1. Pre-crop (unless skipPreCrop)
 * 2. removeBackground (tiered: self-hosted → remove.bg → replicate)
 * 3. If null → soft-fallback (enhance + white bg, no shadow)
 * 4. If valid but clipped → retry without pre-crop
 * 5. If retry also fails → soft-fallback
 */
export async function processImageToThumbnail(
  imageBuffer: Buffer,
  skipPreCrop = false,
): Promise<ThumbnailResult> {
  const input = skipPreCrop ? imageBuffer : await preCropToProduct(imageBuffer);
  const bgResult = await removeBackground(input);

  if (!bgResult) {
    return softFallback(input);
  }

  const deReflected = await removeReflections(bgResult.imageBuffer);
  const enhanced = await enhanceProduct(deReflected);
  const addShadow = bgResult.hasTransparency;

  if (bgResult.hasTransparency && !skipPreCrop) {
    const clipped = await isProductClipped(bgResult.imageBuffer, true);
    if (clipped) {
      log.warn("[photo-studio] retrying without pre-crop due to clipping");
      const retryResult = await removeBackground(imageBuffer);

      if (!retryResult) {
        return softFallback(imageBuffer);
      }

      const retryEq = await calculateEdgeQualityScore(retryResult.imageBuffer);
      log.info(
        `[BG-Removal] retry-no-precrop provider=${retryResult.providerUsed} score=${retryEq.score.toFixed(3)} recommendation=${retryEq.recommendation} halo=${retryEq.haloScore.toFixed(3)} edge=${retryEq.edgeSmoothness.toFixed(3)}`,
      );

      if (retryEq.recommendation !== "accept") {
        return softFallback(imageBuffer);
      }

      const retryClipped = await isProductClipped(retryResult.imageBuffer, true);
      if (retryClipped) {
        log.warn("[photo-studio] retry also clipped, using soft-fallback");
        return softFallback(imageBuffer);
      }

      const retryDeReflected = await removeReflections(retryResult.imageBuffer);
      const retryEnhanced = await enhanceProduct(retryDeReflected);
      const [fullSizeResult, thumbnailResult] = await Promise.all([
        compositeOnCanvas(retryEnhanced, FULL_SIZE, true),
        compositeOnCanvas(retryEnhanced, THUMB_SIZE, false),
      ]);
      return {
        fullSize: fullSizeResult.buffer,
        fullSizeFormat: fullSizeResult.format,
        thumbnail: thumbnailResult.buffer,
        thumbnailFormat: thumbnailResult.format,
        backgroundRemoved: true,
        backgroundProvider: retryResult.providerUsed,
      };
    }
  }

  const [fullSizeResult, thumbnailResult] = await Promise.all([
    compositeOnCanvas(enhanced, FULL_SIZE, addShadow),
    compositeOnCanvas(enhanced, THUMB_SIZE, false),
  ]);

  return {
    fullSize: fullSizeResult.buffer,
    fullSizeFormat: fullSizeResult.format,
    thumbnail: thumbnailResult.buffer,
    thumbnailFormat: thumbnailResult.format,
    backgroundRemoved: bgResult.hasTransparency,
    backgroundProvider: bgResult.providerUsed,
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
  classificationOrHeroIndex: ClassificationResponse | number,
): Promise<ThumbnailResult> {
  if (typeof classificationOrHeroIndex === "number") {
    const heroIndex = classificationOrHeroIndex;
    const hero = images[heroIndex] ?? images[0];
    return processCandidate(hero);
  }

  const candidates = selectHeroCandidates(images, classificationOrHeroIndex);

  if (candidates.length === 1) {
    return processCandidate(candidates[0]);
  }

  const results = await Promise.all(candidates.map(processCandidate));
  return pickBetterResult(results[0], results[1]);
}
