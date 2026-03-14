/**
 * Tilt detection for product photos using Hough-Transform line detection.
 *
 * Primary method: Sobel edge detection + Hough transform to find dominant
 * line angles. Detects the skew of text/edges on product packaging.
 *
 * Fallback: PCA on binary mask (image moments) when Hough finds no lines
 * (e.g. products without text or strong edges).
 *
 * Works on either:
 * - RGBA images (uses alpha channel as mask — ideal after bg-removal)
 * - RGB images (uses brightness threshold — fallback for pre-crop)
 *
 * Returns the tilt angle in degrees:
 * - Negative = object leans clockwise (needs CCW correction = positive sharp.rotate)
 * - Positive = object leans counterclockwise (needs CW correction = negative sharp.rotate)
 *
 * To correct: sharp.rotate(-detectedTilt)
 */

import sharp from "sharp";
import { log } from "@/lib/utils/logger";

const MAX_ANALYSIS_DIM = 512;
const MIN_OPAQUE_RATIO = 0.05;
const MIN_TILT_THRESHOLD = 0.5;
const MAX_TILT = 30;

const HOUGH_ANGLE_RANGE_DEG = 30;
const HOUGH_ANGLE_STEP_DEG = 0.5;
const HOUGH_MIN_VOTES = 15;
const HOUGH_CONSISTENCY_MIN_LINES = 3;
const HOUGH_CONSISTENCY_MAX_SPREAD_DEG = 5;
const SOBEL_EDGE_THRESHOLD = 40;

export interface TiltResult {
  angle: number;
  confidence: "high" | "medium" | "low";
  method: "hough" | "pca-alpha" | "pca-brightness";
  opaquePixelRatio: number;
}

/**
 * Detect the tilt angle of the primary object in an image.
 * Uses Hough transform on edge-detected image as primary method,
 * falls back to PCA on binary mask if Hough finds no strong lines.
 */
export async function detectTilt(imageBuffer: Buffer): Promise<TiltResult> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const hasAlpha = (meta.channels ?? 0) >= 4;

    const resized = await sharp(imageBuffer)
      .resize(MAX_ANALYSIS_DIM, MAX_ANALYSIS_DIM, { fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const { width, height, channels } = info;
    const totalPixels = width * height;

    const mask = new Uint8Array(totalPixels);
    let opaqueCount = 0;

    if (hasAlpha && channels >= 4) {
      for (let i = 0; i < totalPixels; i++) {
        if (data[i * channels + 3] >= 128) {
          mask[i] = 1;
          opaqueCount++;
        }
      }
    } else {
      for (let i = 0; i < totalPixels; i++) {
        const r = data[i * channels];
        const g = data[i * channels + 1];
        const b = data[i * channels + 2];
        if (0.299 * r + 0.587 * g + 0.114 * b < 200) {
          mask[i] = 1;
          opaqueCount++;
        }
      }
    }

    const opaqueRatio = opaqueCount / totalPixels;
    if (opaqueRatio < MIN_OPAQUE_RATIO) {
      log.debug("[tilt-detection] too few opaque pixels:", (opaqueRatio * 100).toFixed(1) + "%");
      return { angle: 0, confidence: "low", method: "hough", opaquePixelRatio: opaqueRatio };
    }

    const grayscale = computeGrayscale(data, width, height, channels, hasAlpha ? mask : undefined);
    const houghResult = detectTiltViaHough(grayscale, width, height, hasAlpha ? mask : undefined);

    if (houghResult.confidence !== "low") {
      return finalizeTilt(houghResult.angle, houghResult.confidence, houghResult.method, opaqueRatio);
    }

    log.debug("[tilt-detection] Hough inconclusive, falling back to PCA");
    const pcaAngle = computeOrientationAngle(mask, width, height);
    const pcaMethod = hasAlpha ? "pca-alpha" as const : "pca-brightness" as const;
    const pcaConfidence = opaqueRatio > 0.15 ? "medium" as const : "low" as const;

    return finalizeTilt(pcaAngle, pcaConfidence, pcaMethod, opaqueRatio);
  } catch (err) {
    log.warn("[tilt-detection] failed:", err instanceof Error ? err.message : err);
    return { angle: 0, confidence: "low", method: "hough", opaquePixelRatio: 0 };
  }
}

function finalizeTilt(
  rawAngle: number,
  confidence: "high" | "medium" | "low",
  method: TiltResult["method"],
  opaqueRatio: number,
): TiltResult {
  const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, rawAngle));
  const rounded = Math.round(clamped * 10) / 10;

  if (Math.abs(rounded) < MIN_TILT_THRESHOLD) {
    log.debug("[tilt-detection] tilt below threshold:", rounded, "degrees");
    return { angle: 0, confidence, method, opaquePixelRatio: opaqueRatio };
  }

  log.debug("[tilt-detection] detected tilt:", rounded, "degrees",
    "(confidence:", confidence, "method:", method, "opaque:", (opaqueRatio * 100).toFixed(1) + "%)");

  return { angle: rounded, confidence, method, opaquePixelRatio: opaqueRatio };
}

function computeGrayscale(
  data: Buffer, width: number, height: number, channels: number,
  mask?: Uint8Array,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (mask && !mask[i]) {
      gray[i] = 255;
      continue;
    }
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

// --- Hough Transform ---

interface HoughInternalResult {
  angle: number;
  confidence: "high" | "medium" | "low";
  method: "hough";
}

/**
 * Two-pass Hough approach:
 * 1. Standard accumulator in (angle, rho) space
 * 2. For each angle bin, count how many distinct rho values exceed the
 *    per-line threshold — this is the "line count" for that angle.
 *    Multiple parallel lines (same angle, different rho) all reinforce
 *    the same angle, which is exactly what we want for text-on-packaging.
 * 3. The angle with the most distinct lines wins.
 */
function detectTiltViaHough(
  gray: Uint8Array, width: number, height: number,
  mask?: Uint8Array,
): HoughInternalResult {
  const NO_RESULT: HoughInternalResult = { angle: 0, confidence: "low", method: "hough" };

  const edges = sobelEdges(gray, width, height, mask);
  const edgePixels = countOnes(edges, width * height);

  if (edgePixels < HOUGH_MIN_VOTES * 2) {
    log.debug("[tilt-detection] too few edge pixels for Hough:", edgePixels);
    return NO_RESULT;
  }

  const angleMin = -HOUGH_ANGLE_RANGE_DEG;
  const angleMax = HOUGH_ANGLE_RANGE_DEG;
  const numAngleBins = Math.ceil((angleMax - angleMin) / HOUGH_ANGLE_STEP_DEG) + 1;

  const sinTable = new Float64Array(numAngleBins);
  const cosTable = new Float64Array(numAngleBins);
  for (let ai = 0; ai < numAngleBins; ai++) {
    const angleDeg = angleMin + ai * HOUGH_ANGLE_STEP_DEG;
    const angleRad = angleDeg * (Math.PI / 180);
    sinTable[ai] = Math.sin(angleRad);
    cosTable[ai] = Math.cos(angleRad);
  }

  const maxRho = Math.ceil(Math.sqrt(width * width + height * height));
  const numRhoBins = 2 * maxRho + 1;
  const accumulator = new Uint32Array(numAngleBins * numRhoBins);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!edges[y * width + x]) continue;
      for (let ai = 0; ai < numAngleBins; ai++) {
        const rho = Math.round(x * cosTable[ai] + y * sinTable[ai]) + maxRho;
        accumulator[ai * numRhoBins + rho]++;
      }
    }
  }

  const lineThreshold = Math.max(HOUGH_MIN_VOTES, Math.round(edgePixels * 0.03));

  interface AngleBucket { angleDeg: number; lineCount: number; totalVotes: number }
  const buckets: AngleBucket[] = [];

  for (let ai = 0; ai < numAngleBins; ai++) {
    let lineCount = 0;
    let totalVotes = 0;
    const base = ai * numRhoBins;
    for (let ri = 0; ri < numRhoBins; ri++) {
      const v = accumulator[base + ri];
      if (v >= lineThreshold) {
        lineCount++;
        totalVotes += v;
      }
    }
    if (lineCount > 0) {
      buckets.push({ angleDeg: angleMin + ai * HOUGH_ANGLE_STEP_DEG, lineCount, totalVotes });
    }
  }

  if (buckets.length === 0) return NO_RESULT;

  buckets.sort((a, b) => b.lineCount - a.lineCount || b.totalVotes - a.totalVotes);

  const best = buckets[0];
  const nearby = buckets.filter(
    b => Math.abs(b.angleDeg - best.angleDeg) <= HOUGH_CONSISTENCY_MAX_SPREAD_DEG,
  );

  const totalLines = nearby.reduce((s, b) => s + b.lineCount, 0);

  if (totalLines < HOUGH_CONSISTENCY_MIN_LINES) {
    log.debug("[tilt-detection] Hough: only", totalLines,
      "lines found (need", HOUGH_CONSISTENCY_MIN_LINES, ")");
    return NO_RESULT;
  }

  const weightedAngle = nearby.reduce((s, b) => s + b.angleDeg * b.totalVotes, 0)
    / nearby.reduce((s, b) => s + b.totalVotes, 0);

  const confidence: "high" | "medium" = totalLines >= 6 ? "high" : "medium";

  log.debug("[tilt-detection] Hough: angle", weightedAngle.toFixed(1),
    "from", totalLines, "lines",
    "(best bucket:", best.lineCount, "lines at", best.angleDeg, "°)");

  return { angle: weightedAngle, confidence, method: "hough" };
}

/**
 * Sobel edge detection producing a binary edge map.
 * Computes horizontal and vertical gradients, combines magnitude,
 * and thresholds to produce edge pixels.
 */
function sobelEdges(
  gray: Uint8Array, width: number, height: number,
  mask?: Uint8Array,
): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (mask && !mask[y * width + x]) continue;

      const idx = (yy: number, xx: number) => yy * width + xx;

      const gx =
        -gray[idx(y - 1, x - 1)] + gray[idx(y - 1, x + 1)]
        - 2 * gray[idx(y, x - 1)] + 2 * gray[idx(y, x + 1)]
        - gray[idx(y + 1, x - 1)] + gray[idx(y + 1, x + 1)];

      const gy =
        -gray[idx(y - 1, x - 1)] - 2 * gray[idx(y - 1, x)] - gray[idx(y - 1, x + 1)]
        + gray[idx(y + 1, x - 1)] + 2 * gray[idx(y + 1, x)] + gray[idx(y + 1, x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag >= SOBEL_EDGE_THRESHOLD) {
        edges[y * width + x] = 1;
      }
    }
  }

  return edges;
}

function countOnes(arr: Uint8Array, len: number): number {
  let c = 0;
  for (let i = 0; i < len; i++) if (arr[i]) c++;
  return c;
}

// --- PCA Fallback ---

/**
 * Compute the deviation angle from vertical using second-order central moments.
 * Sign convention: Negative = CW lean, Positive = CCW lean
 */
function computeOrientationAngle(mask: Uint8Array, width: number, height: number): number {
  let sumX = 0, sumY = 0, count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count === 0) return 0;

  const cx = sumX / count;
  const cy = sumY / count;

  let mu20 = 0, mu02 = 0, mu11 = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        const dx = x - cx;
        const dy = y - cy;
        mu20 += dx * dx;
        mu02 += dy * dy;
        mu11 += dx * dy;
      }
    }
  }

  const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
  const deviationFromVertical = theta + Math.PI / 2;

  if (deviationFromVertical > Math.PI / 2) return (deviationFromVertical - Math.PI) * (180 / Math.PI);
  if (deviationFromVertical < -Math.PI / 2) return (deviationFromVertical + Math.PI) * (180 / Math.PI);
  return deviationFromVertical * (180 / Math.PI);
}

/**
 * Detect and correct tilt in one step.
 * Uses transparent background for RGBA images.
 * Returns the original buffer unchanged if no tilt is detected.
 */
export async function applyTiltCorrection(imageBuffer: Buffer): Promise<Buffer> {
  const result = await detectTilt(imageBuffer);
  if (result.angle === 0) return imageBuffer;

  const correctionAngle = -result.angle;
  log.debug("[photo-studio] applying computed tilt correction:",
    result.angle, "degrees → sharp.rotate(", correctionAngle, ")");

  return sharp(imageBuffer)
    .rotate(correctionAngle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
}
