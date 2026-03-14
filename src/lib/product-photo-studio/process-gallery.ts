/**
 * Gallery photo processing: crops, removes background, and composites
 * all non-hero photos onto 800x800 canvases.
 *
 * Uses Promise.allSettled() so one failure doesn't block others.
 * Respects the product_photos 5-row limit: 1 thumbnail + max 4 gallery.
 */

import { preCropToProduct } from "./create-thumbnail";
import { removeBackground } from "./background-removal";
import { compositeOnCanvas } from "./image-enhance";
import { toPhotoCategory } from "@/lib/product-photos/classify-photo-category";
import { log } from "@/lib/utils/logger";
import type {
  PhotoInput,
  ClassificationResponse,
  ProcessedGalleryPhoto,
  ImageFormat,
} from "./types";

export const GALLERY_SIZE = 800;
const MAX_GALLERY_PHOTOS = 4;

async function processOnePhoto(
  image: PhotoInput,
  originalIndex: number,
  category: "product" | "price_tag",
): Promise<ProcessedGalleryPhoto> {
  const cropped = await preCropToProduct(
    image.buffer,
    category === "price_tag" ? "price_tag" : undefined,
  );
  const bgResult = await removeBackground(cropped);

  let finalBuffer: Buffer;
  let backgroundRemoved: boolean;

  if (bgResult && bgResult.hasTransparency) {
    finalBuffer = bgResult.imageBuffer;
    backgroundRemoved = true;
  } else {
    finalBuffer = cropped;
    backgroundRemoved = false;
  }

  const { buffer: composited, format } = await compositeOnCanvas(
    finalBuffer,
    GALLERY_SIZE,
    backgroundRemoved,
  );

  return {
    originalIndex,
    category,
    processed: composited,
    processedFormat: format as ImageFormat,
    backgroundRemoved,
  };
}

/**
 * Process all classified photos except the hero candidate.
 * Returns up to MAX_GALLERY_PHOTOS processed results;
 * individual failures are logged and skipped.
 */
export async function processGalleryPhotos(
  images: PhotoInput[],
  classification: ClassificationResponse,
  heroIndex: number | null,
): Promise<ProcessedGalleryPhoto[]> {
  const candidates: Array<{
    image: PhotoInput;
    originalIndex: number;
    category: "product" | "price_tag";
  }> = [];

  for (const photo of classification.photos) {
    if (photo.photo_index === heroIndex) continue;
    if (photo.photo_index < 0 || photo.photo_index >= images.length) continue;

    const category = toPhotoCategory(photo.photo_type);
    if (category === null || category === "thumbnail") continue;

    candidates.push({
      image: images[photo.photo_index],
      originalIndex: photo.photo_index,
      category,
    });
  }

  const toProcess = candidates.slice(0, MAX_GALLERY_PHOTOS);
  if (toProcess.length === 0) return [];

  log.debug("[photo-studio] processing", toProcess.length, "gallery photos");

  const results = await Promise.allSettled(
    toProcess.map((c) => processOnePhoto(c.image, c.originalIndex, c.category)),
  );

  const processed: ProcessedGalleryPhoto[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      processed.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      log.warn(
        "[photo-studio] gallery photo",
        toProcess[i].originalIndex,
        "failed:",
        reason,
      );
    }
  }

  log.debug("[photo-studio] gallery processed:", processed.length, "/", toProcess.length);
  return processed;
}
