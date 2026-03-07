/**
 * Stage 1: Validate and classify product photos via Claude Vision.
 * Detects non-product content (selfies, screenshots, inappropriate images)
 * and classifies each photo by type (front, back, price tag, etc.).
 */

import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { classifyPhotosPrompt } from "./prompts";
import { buildImageContent } from "./build-image-content";
import type {
  PhotoInput,
  ClassificationResponse,
  PhotoClassification,
} from "./types";
import { log } from "@/lib/utils/logger";

function sanitizeClassification(
  raw: Record<string, unknown>,
  index: number,
): PhotoClassification {
  return {
    photo_index: index,
    is_product_photo: raw.is_product_photo === true,
    photo_type: (raw.photo_type as PhotoClassification["photo_type"]) ?? "other",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    rejection_reason:
      raw.rejection_reason != null ? String(raw.rejection_reason) : null,
    quality_score: typeof raw.quality_score === "number" ? raw.quality_score : 0,
    has_reflections: raw.has_reflections === true,
    text_readable: raw.text_readable !== false,
  };
}

export async function classifyPhotos(
  images: PhotoInput[],
): Promise<ClassificationResponse> {
  try {
    const result = await callClaudeJSON<{
      photos?: Array<Record<string, unknown>>;
      all_same_product?: boolean;
      suspicious_content?: boolean;
      overall_assessment?: string;
    }>({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: buildImageContent(images, classifyPhotosPrompt(images.length)),
      }],
    });

    const photos = (result.photos ?? []).map((p, i) =>
      sanitizeClassification(p, i),
    );

    return {
      photos,
      all_same_product: result.all_same_product !== false,
      suspicious_content: result.suspicious_content === true,
      overall_assessment: result.overall_assessment ?? "",
    };
  } catch (err) {
    log.error("[photo-studio] classification failed:", err);
    throw err;
  }
}
