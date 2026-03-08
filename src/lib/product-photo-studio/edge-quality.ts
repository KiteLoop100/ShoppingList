/**
 * Edge quality scoring for background-removed product images.
 * Analyzes transparency ratio, halo artifacts, and edge smoothness.
 * Uses Sharp raw pixel analysis only — no AI calls.
 */

import sharp from "sharp";
import { log } from "@/lib/utils/logger";

export type EdgeQualityRecommendation = "accept" | "retry" | "fallback";

export interface EdgeQualityResult {
  score: number;
  transparencyRatio: number;
  haloScore: number;
  edgeSmoothness: number;
  isValid: boolean;
  recommendation: EdgeQualityRecommendation;
  diagnostics: {
    nearWhiteEdgePixelRatio: number;
    perimeterAreaRatio: number;
  };
}

const MIN_TRANSPARENCY = 0.03;
const MAX_TRANSPARENCY = 0.97;
const NEAR_WHITE_THRESHOLD = 240;
const HALO_CEILING = 0.4;

/** Weighted score above this → accept the result directly */
export const ACCEPT_THRESHOLD = 0.6;
/** Weighted score above this (but below ACCEPT) → retry with next provider */
export const FALLBACK_THRESHOLD = 0.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Analyze edge quality of a background-removed RGBA image.
 *
 * Transparency is a hard gate (3-97%). When valid, the weighted score
 * (transparency 0.4 + halo 0.35 + edge 0.25) determines the recommendation:
 *   - score >= ACCEPT_THRESHOLD  → "accept"
 *   - score >= FALLBACK_THRESHOLD → "retry" (try next provider)
 *   - otherwise                   → "fallback" (stop, use soft-fallback)
 */
export async function calculateEdgeQualityScore(
  imageBuffer: Buffer,
): Promise<EdgeQualityResult> {
  const invalid: EdgeQualityResult = {
    score: 0,
    transparencyRatio: 0,
    haloScore: 0,
    edgeSmoothness: 0,
    isValid: false,
    recommendation: "fallback",
    diagnostics: { nearWhiteEdgePixelRatio: 0, perimeterAreaRatio: 0 },
  };

  let data: Buffer;
  let width: number;
  let height: number;
  let channels: number;

  try {
    const result = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = result.data;
    ({ width, height, channels } = result.info);
  } catch {
    log.warn("[EdgeQuality] failed to decode image buffer");
    return invalid;
  }

  if (channels < 4) {
    log.warn("[EdgeQuality] image has no alpha channel, channels =", channels);
    return invalid;
  }

  const totalPixels = width * height;

  // ── Transparency ratio ──
  let transparentPixels = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] < 10) transparentPixels++;
  }
  const transparencyRatio = transparentPixels / totalPixels;
  const transparencyValid =
    transparencyRatio >= MIN_TRANSPARENCY &&
    transparencyRatio <= MAX_TRANSPARENCY;

  // ── Halo detection ──
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  const rgbAt = (x: number, y: number) => {
    const off = (y * width + x) * 4;
    return { r: data[off], g: data[off + 1], b: data[off + 2] };
  };

  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  let edgePixelCount = 0;
  let nearWhiteNeighborTotal = 0;
  let neighborSampleTotal = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const alpha = alphaAt(x, y);
      if (alpha <= 128) continue;

      let hasTransparentNeighbor = false;
      for (let d = 0; d < 4; d++) {
        if (alphaAt(x + dx[d], y + dy[d]) < 128) {
          hasTransparentNeighbor = true;
          break;
        }
      }
      if (!hasTransparentNeighbor) continue;

      edgePixelCount++;

      // Check 2 nearest opaque neighbors toward the image interior
      for (let d = 0; d < 4; d++) {
        const nx1 = x + dx[d];
        const ny1 = y + dy[d];
        if (nx1 < 0 || nx1 >= width || ny1 < 0 || ny1 >= height) continue;
        if (alphaAt(nx1, ny1) < 128) continue;

        const c1 = rgbAt(nx1, ny1);
        neighborSampleTotal++;
        if (
          c1.r > NEAR_WHITE_THRESHOLD &&
          c1.g > NEAR_WHITE_THRESHOLD &&
          c1.b > NEAR_WHITE_THRESHOLD
        ) {
          nearWhiteNeighborTotal++;
        }

        const nx2 = x + dx[d] * 2;
        const ny2 = y + dy[d] * 2;
        if (nx2 < 0 || nx2 >= width || ny2 < 0 || ny2 >= height) continue;
        if (alphaAt(nx2, ny2) < 128) continue;

        const c2 = rgbAt(nx2, ny2);
        neighborSampleTotal++;
        if (
          c2.r > NEAR_WHITE_THRESHOLD &&
          c2.g > NEAR_WHITE_THRESHOLD &&
          c2.b > NEAR_WHITE_THRESHOLD
        ) {
          nearWhiteNeighborTotal++;
        }
      }
    }
  }

  const nearWhiteEdgePixelRatio =
    neighborSampleTotal > 0 ? nearWhiteNeighborTotal / neighborSampleTotal : 0;
  const haloScore = 1 - clamp(nearWhiteEdgePixelRatio / HALO_CEILING, 0, 1);

  // ── Edge smoothness ──
  let perimeterPixels = 0;
  let opaqueArea = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 128) continue;
      opaqueArea++;

      let touchesTransparent = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          touchesTransparent = true;
          break;
        }
        if (data[(ny * width + nx) * 4 + 3] <= 128) {
          touchesTransparent = true;
          break;
        }
      }
      if (touchesTransparent) perimeterPixels++;
    }
  }

  const expectedPerimeter =
    opaqueArea > 0 ? 2 * Math.sqrt(Math.PI * opaqueArea) : 0;
  const perimeterAreaRatio =
    perimeterPixels > 0 ? expectedPerimeter / perimeterPixels : 0;
  const edgeSmoothness = clamp(perimeterAreaRatio, 0, 1);

  // ── Weighted score ──
  const transparencyComponent = transparencyValid ? 1 : 0;
  const score =
    transparencyComponent * 0.4 + haloScore * 0.35 + edgeSmoothness * 0.25;

  // ── Decision: transparency is a hard gate, then score drives the recommendation ──
  let isValid: boolean;
  let recommendation: EdgeQualityRecommendation;

  if (!transparencyValid) {
    isValid = false;
    recommendation = "fallback";
  } else if (score >= ACCEPT_THRESHOLD) {
    isValid = true;
    recommendation = "accept";
  } else if (score >= FALLBACK_THRESHOLD) {
    isValid = false;
    recommendation = "retry";
  } else {
    isValid = false;
    recommendation = "fallback";
  }

  const diagnostics = { nearWhiteEdgePixelRatio, perimeterAreaRatio };

  log.info(
    `[EdgeQuality] score=${score.toFixed(3)} recommendation=${recommendation} transparency=${transparencyRatio.toFixed(3)} halo=${haloScore.toFixed(3)} edge=${edgeSmoothness.toFixed(3)} diagnostics=${JSON.stringify(diagnostics)}`,
  );

  return {
    score,
    transparencyRatio,
    haloScore,
    edgeSmoothness,
    isValid,
    recommendation,
    diagnostics,
  };
}
