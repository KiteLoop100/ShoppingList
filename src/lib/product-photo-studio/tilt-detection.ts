/**
 * Computational tilt detection using image moments (PCA on binary mask).
 *
 * Replaces unreliable AI-based tilt estimation. Works on either:
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

export interface TiltResult {
  angle: number;
  confidence: "high" | "medium" | "low";
  method: "alpha" | "brightness";
  opaquePixelRatio: number;
}

/**
 * Detect the tilt angle of the primary object in an image.
 * Uses the alpha channel if available (post bg-removal), otherwise
 * falls back to brightness thresholding.
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
        const alpha = data[i * channels + 3];
        if (alpha >= 128) {
          mask[i] = 1;
          opaqueCount++;
        }
      }
    } else {
      for (let i = 0; i < totalPixels; i++) {
        const r = data[i * channels];
        const g = data[i * channels + 1];
        const b = data[i * channels + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness < 200) {
          mask[i] = 1;
          opaqueCount++;
        }
      }
    }

    const opaqueRatio = opaqueCount / totalPixels;

    if (opaqueRatio < MIN_OPAQUE_RATIO) {
      log.debug("[tilt-detection] too few opaque pixels:", (opaqueRatio * 100).toFixed(1) + "%");
      return { angle: 0, confidence: "low", method: hasAlpha ? "alpha" : "brightness", opaquePixelRatio: opaqueRatio };
    }

    const angle = computeOrientationAngle(mask, width, height);
    const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, angle));
    const rounded = Math.round(clamped * 10) / 10;

    const confidence = opaqueRatio > 0.15 ? "high" : opaqueRatio > 0.08 ? "medium" : "low";
    const method = hasAlpha ? "alpha" : "brightness";

    if (Math.abs(rounded) < MIN_TILT_THRESHOLD) {
      log.debug("[tilt-detection] tilt below threshold:", rounded, "degrees");
      return { angle: 0, confidence, method, opaquePixelRatio: opaqueRatio };
    }

    log.debug("[tilt-detection] detected tilt:", rounded, "degrees",
      "(confidence:", confidence, "method:", method, "opaque:", (opaqueRatio * 100).toFixed(1) + "%)");

    return { angle: rounded, confidence, method, opaquePixelRatio: opaqueRatio };
  } catch (err) {
    log.warn("[tilt-detection] failed:", err instanceof Error ? err.message : err);
    return { angle: 0, confidence: "low", method: "brightness", opaquePixelRatio: 0 };
  }
}

/**
 * Compute the deviation angle from vertical using second-order central moments.
 *
 * 1. Compute centroid (cx, cy) of the binary mask
 * 2. Compute central moments mu20, mu02, mu11
 * 3. The principal axis angle from horizontal is 0.5 * atan2(2*mu11, mu20 - mu02)
 * 4. Convert to deviation from vertical
 *
 * Sign convention:
 *   Negative = CW lean, Positive = CCW lean
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
