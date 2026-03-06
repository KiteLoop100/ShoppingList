/**
 * Product Photo Studio pipeline orchestrator.
 * Coordinates classification, extraction, thumbnail creation, and verification
 * with two parallel groups gated by content moderation.
 *
 * Supports optional PipelineRunner for step-by-step persistence and resumability.
 */

import { classifyPhotos } from "./validate-classify";
import { extractProductInfo, scanBarcodesFromAll } from "./extract-product-info";
import { createThumbnail } from "./create-thumbnail";
import { verifyThumbnailQuality } from "./verify-quality";
import type { ProductPhotoStudioInput, ProductPhotoStudioResult } from "./types";
import type { PipelineRunner } from "./pipeline-runner";
import { log } from "@/lib/utils/logger";

export const processProductPhotos = processCompetitorPhotos;

export interface ProcessOptions {
  runner?: PipelineRunner;
}

export async function processCompetitorPhotos(
  input: ProductPhotoStudioInput,
  options?: ProcessOptions,
): Promise<ProductPhotoStudioResult> {
  const startMs = Date.now();
  const runner = options?.runner;

  if (runner) {
    await runner.loadState();
  }

  log.debug("[photo-studio] processing", input.images.length, "photos");

  // ── STEP 1: Barcode scan + Classification ──
  const classifyFn = async () => {
    const [barcodeResults, classification] = await Promise.all([
      scanBarcodesFromAll(input.images),
      classifyPhotos(input.images),
    ]);
    return { barcodeResults, classification };
  };

  const { barcodeResults, classification } = runner
    ? await runner.runStep("classify", classifyFn)
    : await classifyFn();

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

  const scannedEan = barcodeResults.find((e: string | null) => e !== null) ?? null;

  // ── STEP 2: Extraction + Thumbnail ──
  const extractFn = async () => {
    const [extractedData, thumbnailResult] = await Promise.all([
      extractProductInfo(input.images, scannedEan),
      createThumbnail(input.images, classification),
    ]);
    return { extractedData, thumbnailResult };
  };

  const { extractedData, thumbnailResult } = runner
    ? await runner.runStep("extract", extractFn)
    : await extractFn();

  // ── STEP 3: Verify thumbnail quality ──
  const verifyFn = async () =>
    verifyThumbnailQuality(thumbnailResult.fullSize, thumbnailResult.fullSizeFormat);

  const verification = runner
    ? await runner.runStep("verify", verifyFn)
    : await verifyFn();

  const finalEan = scannedEan ?? extractedData.ean_barcode;
  const isRejected = verification.recommendation === "reject";

  if (runner) {
    if (isRejected) {
      await runner.markError(verification.issues.join("; "));
    } else {
      await runner.markCompleted();
    }
  }

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
    thumbnailFullFormat: thumbnailResult.fullSizeFormat,
    thumbnailSmall: thumbnailResult.thumbnail,
    qualityScore: verification.quality_score,
    processingTimeMs: Date.now() - startMs,
  };
}
