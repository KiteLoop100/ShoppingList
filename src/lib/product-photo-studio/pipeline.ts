/**
 * Product Photo Studio pipeline orchestrator.
 * Coordinates classification, extraction, thumbnail creation, and verification
 * with two parallel groups gated by content moderation.
 */

import { classifyPhotos } from "./validate-classify";
import { extractProductInfo, scanBarcodesFromAll } from "./extract-product-info";
import { createThumbnail } from "./create-thumbnail";
import { verifyThumbnailQuality } from "./verify-quality";
import type { ProductPhotoStudioInput, ProductPhotoStudioResult } from "./types";
import { log } from "@/lib/utils/logger";

export const processProductPhotos = processCompetitorPhotos;

export async function processCompetitorPhotos(
  input: ProductPhotoStudioInput,
): Promise<ProductPhotoStudioResult> {
  const startMs = Date.now();

  log.debug("[photo-studio] processing", input.images.length, "photos");

  // ── PARALLEL GROUP 1: Barcode scan + Classification ──
  const [barcodeResults, classification] = await Promise.all([
    scanBarcodesFromAll(input.images),
    classifyPhotos(input.images),
  ]);

  // ── GATE: Content moderation ──
  const rejected = classification.photos.filter((p) => !p.is_product_photo);
  if (rejected.length > 0 || classification.suspicious_content) {
    log.warn(
      "[photo-studio] moderation gate: rejected",
      rejected.length,
      "photos",
    );
    return {
      status: "review_required",
      reviewReason: rejected[0]?.rejection_reason ?? "suspicious_content",
      classification,
      extractedData: null,
      processingTimeMs: Date.now() - startMs,
    };
  }

  const scannedEan = barcodeResults.find((e) => e !== null) ?? null;

  // ── PARALLEL GROUP 2: Extraction + Thumbnail ──
  const [extractedData, thumbnailResult] = await Promise.all([
    extractProductInfo(input.images, scannedEan),
    createThumbnail(input.images, classification),
  ]);

  // ── SEQUENTIAL: Verify thumbnail quality ──
  const verification = await verifyThumbnailQuality(thumbnailResult.fullSize);

  const finalEan = scannedEan ?? extractedData.ean_barcode;
  const isRejected = verification.recommendation === "reject";

  log.debug(
    "[photo-studio] completed in",
    Date.now() - startMs,
    "ms, status:",
    isRejected ? "review_required" : "success",
  );

  return {
    status: isRejected ? "review_required" : "success",
    reviewReason: isRejected ? verification.issues.join("; ") : undefined,
    classification,
    extractedData: { ...extractedData, ean_barcode: finalEan },
    thumbnailFull: thumbnailResult.fullSize,
    thumbnailSmall: thumbnailResult.thumbnail,
    qualityScore: verification.quality_score,
    processingTimeMs: Date.now() - startMs,
  };
}
