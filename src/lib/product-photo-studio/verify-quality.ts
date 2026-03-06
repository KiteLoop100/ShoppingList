/**
 * Stage 4: Verify processed thumbnail quality.
 * 1. Sharp-based highlight detection (overexposed/reflection areas).
 * 2. Claude Haiku visual quality check (composition, artifacts, completeness).
 */

import sharp from "sharp";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { VERIFY_THUMBNAIL_PROMPT } from "./prompts";
import type { ImageFormat, ThumbnailVerification } from "./types";
import { log } from "@/lib/utils/logger";

const HIGHLIGHT_THRESHOLD = 250;
const HIGHLIGHT_WARN_RATIO = 0.03;

/**
 * Detect overexposed / reflection areas by counting near-white pixels.
 * Returns the ratio of clipped pixels (0-1) and whether it exceeds the warning threshold.
 */
async function detectHighlights(imageBuffer: Buffer): Promise<{
  highlightRatio: number;
  hasProblematicHighlights: boolean;
}> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    let clippedPixels = 0;

    for (let i = 0; i < data.length; i += 3) {
      if (
        data[i] >= HIGHLIGHT_THRESHOLD &&
        data[i + 1] >= HIGHLIGHT_THRESHOLD &&
        data[i + 2] >= HIGHLIGHT_THRESHOLD
      ) {
        clippedPixels++;
      }
    }

    const ratio = clippedPixels / totalPixels;
    return {
      highlightRatio: ratio,
      hasProblematicHighlights: ratio > HIGHLIGHT_WARN_RATIO,
    };
  } catch (err) {
    log.warn("[photo-studio] highlight detection failed:", err instanceof Error ? err.message : err);
    return { highlightRatio: 0, hasProblematicHighlights: false };
  }
}

export async function verifyThumbnailQuality(
  thumbnailBuffer: Buffer,
  mediaType: ImageFormat = "image/webp",
): Promise<ThumbnailVerification> {
  try {
    const [highlightResult, claudeResult] = await Promise.all([
      detectHighlights(thumbnailBuffer),
      callClaudeJSON<{
        passes_quality_check?: boolean;
        quality_score?: number;
        issues?: string[];
        recommendation?: string;
      }>({
        model: CLAUDE_MODEL_HAIKU,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: thumbnailBuffer.toString("base64"),
                },
              },
              { type: "text", text: VERIFY_THUMBNAIL_PROMPT },
            ],
          },
        ],
      }),
    ]);

    const recommendation = claudeResult.recommendation as ThumbnailVerification["recommendation"];
    const validRecommendations = new Set(["approve", "review", "reject"]);
    const issues = Array.isArray(claudeResult.issues) ? claudeResult.issues.map(String) : [];

    if (highlightResult.hasProblematicHighlights) {
      const pct = (highlightResult.highlightRatio * 100).toFixed(1);
      issues.push(`Highlight clipping detected: ${pct}% overexposed pixels (reflections/glare)`);
    }

    return {
      passes_quality_check: claudeResult.passes_quality_check !== false,
      quality_score: typeof claudeResult.quality_score === "number" ? claudeResult.quality_score : 0.5,
      issues,
      recommendation: validRecommendations.has(recommendation) ? recommendation : "review",
    };
  } catch (err) {
    log.error("[photo-studio] thumbnail verification failed:", err);
    return {
      passes_quality_check: false,
      quality_score: 0,
      issues: ["Verification failed due to an error"],
      recommendation: "review",
    };
  }
}
