/**
 * Stage 4: Verify processed thumbnail quality via Claude Haiku.
 * Simple pass/fail check on the already-enhanced product image.
 */

import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { VERIFY_THUMBNAIL_PROMPT } from "./prompts";
import type { ThumbnailVerification } from "./types";
import { log } from "@/lib/utils/logger";

export async function verifyThumbnailQuality(
  thumbnailBuffer: Buffer,
): Promise<ThumbnailVerification> {
  try {
    const base64 = thumbnailBuffer.toString("base64");

    const result = await callClaudeJSON<{
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
                media_type: "image/jpeg",
                data: base64,
              },
            },
            { type: "text", text: VERIFY_THUMBNAIL_PROMPT },
          ],
        },
      ],
    });

    const recommendation = result.recommendation as ThumbnailVerification["recommendation"];
    const validRecommendations = new Set(["approve", "review", "reject"]);

    return {
      passes_quality_check: result.passes_quality_check !== false,
      quality_score: typeof result.quality_score === "number" ? result.quality_score : 0.5,
      issues: Array.isArray(result.issues) ? result.issues.map(String) : [],
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
