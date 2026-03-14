/**
 * Product Photo Studio pipeline orchestrator.
 *
 * Two execution paths:
 * 1. Fast path (photoRoles provided): skips classification, runs everything
 *    in parallel. Moderation via suspicious_content in the extract response.
 * 2. Legacy path (no photoRoles): full classify → extract → verify sequence.
 *
 * Supports optional PipelineRunner for step-by-step persistence and resumability.
 */

import { classifyPhotos } from "./validate-classify";
import { extractProductInfo, scanBarcodesFromAll } from "./extract-product-info";
import { createThumbnail } from "./create-thumbnail";
import { processGalleryPhotos } from "./process-gallery";
import { verifyThumbnailQuality } from "./verify-quality";
import { selectThumbnailIndex } from "@/lib/product-photos/classify-photo-category";
import type {
  ProductPhotoStudioInput,
  ProductPhotoStudioResult,
  ThumbnailVerification,
  ThumbnailType,
  ExtractionResult,
} from "./types";
import type { PipelineRunner } from "./pipeline-runner";
import { log } from "@/lib/utils/logger";

export const processProductPhotos = processCompetitorPhotos;

export interface ProcessOptions {
  runner?: PipelineRunner;
}

const PIPELINE_TIMEOUT_MS = 28_000;

function elapsedMs(startMs: number): number {
  return Date.now() - startMs;
}

/**
 * Fast path: photoRoles are known from the UI, so classification is skipped.
 * All work runs in parallel from t=0.
 */
async function processFastPath(
  input: ProductPhotoStudioInput,
  startMs: number,
): Promise<ProductPhotoStudioResult> {
  const photoRoles = input.photoRoles!;
  const heroIndex = photoRoles.indexOf("front");
  const hasFront = heroIndex >= 0;
  const effectiveHeroIndex = hasFront ? heroIndex : 0;

  log.debug("[photo-studio] fast path: heroIndex =", effectiveHeroIndex,
    "hasFront =", hasFront, "roles =", photoRoles);

  // When no front photo is provided, skip thumbnail creation entirely and
  // process all photos as gallery. The heroIndex sentinel null tells
  // processGalleryPhotos to not skip any photo.
  const [barcodeResults, thumbnailResult, galleryPhotos] = await Promise.all([
    scanBarcodesFromAll(input.images),
    hasFront
      ? createThumbnail(input.images, effectiveHeroIndex)
      : Promise.resolve(null),
    processGalleryPhotos(input.images, photoRoles, hasFront ? effectiveHeroIndex : null),
  ]);

  log.debug("[photo-studio] fast path phase 1 (images) took", elapsedMs(startMs), "ms");

  // Phase 2: Extract with scanned EAN (runs while thumbnail/gallery may still be settling)
  const scannedEan = barcodeResults.find((e: string | null) => e !== null) ?? null;
  const extractionResult = await extractProductInfo(input.images, scannedEan);

  log.debug("[photo-studio] fast path phase 2 (extract) took", elapsedMs(startMs), "ms total");

  if (extractionResult.suspicious_content) {
    log.warn("[photo-studio] moderation gate: suspicious content detected (from extract)");
    return {
      status: "review_required",
      reviewReason: "suspicious_content",
      extractedData: null,
      backgroundRemoved: false,
      processingTimeMs: elapsedMs(startMs),
    };
  }

  const extractedData = extractionResult.data;
  const finalEan = scannedEan ?? extractedData.ean_barcode;

  const bgFailed = thumbnailResult?.backgroundRemovalFailed === true;
  const hasThumbnail = thumbnailResult?.fullSize != null;

  if (bgFailed) {
    log.warn("[photo-studio] background removal failed, provider used:", thumbnailResult?.backgroundProvider);
  }

  const thumbnailType: ThumbnailType | undefined = hasThumbnail
    ? (thumbnailResult!.backgroundRemoved ? "background_removed" : "soft_fallback")
    : undefined;

  const qualityScore = bgFailed ? 0.3 : hasThumbnail ? 0.6 : 0.5;

  log.debug(
    "[photo-studio] fast path completed in",
    elapsedMs(startMs),
    "ms, thumbnailType:",
    thumbnailType ?? "none",
  );

  return {
    status: "success",
    extractedData: { ...extractedData, ean_barcode: finalEan },
    thumbnailFull: thumbnailResult?.fullSize,
    thumbnailFullFormat: thumbnailResult?.fullSizeFormat,
    thumbnailSmall: thumbnailResult?.thumbnail,
    qualityScore,
    backgroundRemoved: thumbnailResult?.backgroundRemoved ?? false,
    backgroundRemovalFailed: bgFailed,
    backgroundProvider: thumbnailResult?.backgroundProvider,
    thumbnailType,
    galleryPhotos: galleryPhotos.length > 0 ? galleryPhotos : undefined,
    processingTimeMs: elapsedMs(startMs),
  };
}

/**
 * Legacy path: full classify → extract → verify sequence.
 * Used when photoRoles are not provided (backward compatibility).
 */
async function processLegacyPath(
  input: ProductPhotoStudioInput,
  startMs: number,
  runner?: PipelineRunner,
): Promise<ProductPhotoStudioResult> {
  // ── STEP 1: Barcode scan + Classification ──
  const classifyStartMs = Date.now();
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
  log.debug("[photo-studio] classify took", Date.now() - classifyStartMs, "ms");

  // ── GATE: Content moderation (suspicious content only) ──
  if (classification.suspicious_content) {
    log.warn("[photo-studio] moderation gate: suspicious content detected");
    return {
      status: "review_required",
      reviewReason: "suspicious_content",
      classification,
      extractedData: null,
      backgroundRemoved: false,
      processingTimeMs: elapsedMs(startMs),
    };
  }

  const rejected = classification.photos.filter((p) => !p.is_product_photo);
  if (rejected.length > 0) {
    log.warn(
      "[photo-studio] moderation:",
      rejected.length,
      "photos not classified as products — continuing pipeline",
    );
  }

  const scannedEan = barcodeResults.find((e: string | null) => e !== null) ?? null;

  const heroIndex = selectThumbnailIndex(
    classification.photos.map((p) => ({
      photoType: p.photo_type,
      qualityScore: p.quality_score,
    })),
  );

  // ── STEP 2: Extraction + Thumbnail + Gallery ──
  const extractStartMs = Date.now();
  const extractFn = async () => {
    const [extractionResult, thumbnailResult, galleryPhotos] = await Promise.all([
      extractProductInfo(input.images, scannedEan),
      createThumbnail(input.images, classification),
      processGalleryPhotos(input.images, classification, heroIndex),
    ]);
    return { extractionResult, thumbnailResult, galleryPhotos };
  };

  const { extractionResult, thumbnailResult, galleryPhotos } = runner
    ? await runner.runStep("extract", extractFn)
    : await extractFn();
  log.debug("[photo-studio] extract+thumbnail+gallery took", Date.now() - extractStartMs, "ms");

  const extractedData = extractionResult.data;

  // ── STEP 3: Verify thumbnail quality (skip if budget exhausted) ──
  const bgFailed = thumbnailResult.backgroundRemovalFailed === true;
  const budgetExhausted = elapsedMs(startMs) > PIPELINE_TIMEOUT_MS;

  if (bgFailed) {
    log.warn("[photo-studio] background removal failed, provider used:", thumbnailResult.backgroundProvider);
  }

  let verification: ThumbnailVerification;
  if (budgetExhausted) {
    log.warn("[photo-studio] timeout budget exhausted after", elapsedMs(startMs), "ms — skipping verification");
    verification = {
      passes_quality_check: !bgFailed,
      quality_score: bgFailed ? 0.3 : 0.6,
      issues: bgFailed
        ? ["Hintergrund konnte nicht entfernt werden. Bitte prüfen Sie den Hintergrundentfernungs-Dienst (Credits aufgebraucht?)."]
        : [],
      recommendation: bgFailed ? "review" : "approve",
    };
  } else {
    const verifyStartMs = Date.now();
    const verifyFn = async () =>
      verifyThumbnailQuality(
        thumbnailResult.fullSize,
        thumbnailResult.fullSizeFormat,
        bgFailed,
      );

    verification = runner
      ? await runner.runStep("verify", verifyFn)
      : await verifyFn();
    log.debug("[photo-studio] verify took", Date.now() - verifyStartMs, "ms");
  }

  const finalEan = scannedEan ?? extractedData.ean_barcode;

  const hasThumbnail = thumbnailResult.fullSize != null;
  const allRejected = classification.photos.every((p) => !p.is_product_photo);

  let finalStatus: "success" | "review_required";
  let finalReviewReason: string | undefined;

  if (allRejected && !hasThumbnail) {
    finalStatus = "review_required";
    finalReviewReason = rejected[0]?.rejection_reason ?? "no_product_photos";
  } else {
    finalStatus = "success";
  }

  const thumbnailType: ThumbnailType | undefined = hasThumbnail
    ? (thumbnailResult.backgroundRemoved ? "background_removed" : "soft_fallback")
    : undefined;

  if (runner) {
    if (finalStatus === "review_required") {
      await runner.markError(finalReviewReason ?? "review_required");
    } else {
      await runner.markCompleted();
    }
  }

  log.debug(
    "[photo-studio] completed in",
    elapsedMs(startMs),
    "ms, status:",
    finalStatus,
    "thumbnailType:",
    thumbnailType ?? "none",
  );

  return {
    status: finalStatus,
    reviewReason: finalReviewReason,
    classification,
    extractedData: { ...extractedData, ean_barcode: finalEan },
    thumbnailFull: thumbnailResult.fullSize,
    thumbnailFullFormat: thumbnailResult.fullSizeFormat,
    thumbnailSmall: thumbnailResult.thumbnail,
    qualityScore: verification.quality_score,
    backgroundRemoved: thumbnailResult.backgroundRemoved,
    backgroundRemovalFailed: bgFailed,
    backgroundProvider: thumbnailResult.backgroundProvider,
    thumbnailType,
    galleryPhotos: galleryPhotos.length > 0 ? galleryPhotos : undefined,
    processingTimeMs: elapsedMs(startMs),
  };
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

  if (input.photoRoles && input.photoRoles.length === input.images.length) {
    return processFastPath(input, startMs);
  }

  return processLegacyPath(input, startMs, runner);
}
