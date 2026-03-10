/**
 * POST /api/analyze-product-photos
 * Unified product photo analysis endpoint.
 * Accepts multiple product photos, runs the photo studio pipeline
 * (classify, extract, thumbnail, verify), and returns extracted data
 * plus a processed thumbnail.
 *
 * Replaces both /api/analyze-competitor-photos and /api/extract-product-info.
 */

import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/guards";
import {
  claudeRateLimit,
  checkRateLimit,
  getIdentifier,
} from "@/lib/api/rate-limit";
import { analyzeRequestSchema } from "@/lib/product-photo-studio/types";
import { processProductPhotos } from "@/lib/product-photo-studio/pipeline";
import { toPhotoCategory, selectThumbnailIndex } from "@/lib/product-photos/classify-photo-category";
import { log } from "@/lib/utils/logger";

export const maxDuration = 120;

export async function POST(request: Request) {
  const apiKey = requireApiKey();
  if (apiKey instanceof NextResponse) return apiKey;

  const rateLimitResponse = await checkRateLimit(
    claudeRateLimit,
    getIdentifier(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const images = parsed.data.images.map((img) => ({
      buffer: Buffer.from(img.image_base64, "base64"),
      mediaType: img.media_type,
    }));

    const result = await processProductPhotos({ images });

    const classifiedPhotos = result.classification.photos.map((p) => ({
      index: p.photo_index,
      category: toPhotoCategory(p.photo_type),
      photo_type: p.photo_type,
      quality_score: p.quality_score,
      is_product_photo: p.is_product_photo,
    }));

    const suggestedThumbnailIndex = selectThumbnailIndex(
      result.classification.photos.map((p) => ({
        photoType: p.photo_type,
        qualityScore: p.quality_score,
      })),
    );

    return NextResponse.json({
      ok: true,
      status: result.status,
      review_reason: result.reviewReason ?? null,
      extracted_data: result.extractedData,
      thumbnail_base64: result.thumbnailFull
        ? result.thumbnailFull.toString("base64")
        : null,
      thumbnail_format: result.thumbnailFullFormat ?? "image/webp",
      thumbnail_small_base64: result.thumbnailSmall
        ? result.thumbnailSmall.toString("base64")
        : null,
      thumbnail_type: result.thumbnailType ?? null,
      quality_score: result.qualityScore ?? null,
      background_removed: result.backgroundRemoved,
      background_removal_failed: result.backgroundRemovalFailed ?? false,
      background_provider: result.backgroundProvider ?? null,
      processing_time_ms: result.processingTimeMs,
      classified_photos: classifiedPhotos,
      suggested_thumbnail_index: suggestedThumbnailIndex,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    log.error("[analyze-product-photos] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
