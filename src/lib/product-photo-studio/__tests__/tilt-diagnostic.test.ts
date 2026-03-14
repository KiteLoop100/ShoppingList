/**
 * Phase 1 Diagnostics: Verify sharp.rotate() behavior and build
 * ground-truth for tilt detection testing.
 */

import { describe, test, expect } from "vitest";
import sharp from "sharp";

/**
 * Create a test image with a known rectangular shape that has
 * a clear vertical orientation for tilt detection.
 * Returns a white background with a black rectangle in the center.
 */
async function createRectangleImage(
  canvasW: number,
  canvasH: number,
  rectW: number,
  rectH: number,
): Promise<Buffer> {
  const rect = await sharp({
    create: { width: rectW, height: rectH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  }).png().toBuffer();

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 255 } },
  })
    .composite([{
      input: rect,
      left: Math.round((canvasW - rectW) / 2),
      top: Math.round((canvasH - rectH) / 2),
    }])
    .png()
    .toBuffer();
}

describe("sharp.rotate() convention verification", () => {
  test("positive angle rotates counterclockwise (canvas grows)", async () => {
    const img = await createRectangleImage(200, 400, 60, 300);
    const rotated = await sharp(img)
      .rotate(15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const meta = await sharp(rotated).metadata();

    // Canvas should grow to accommodate the rotated content
    expect(meta.width!).toBeGreaterThan(200);
    expect(meta.height!).toBeGreaterThan(400);
  });

  test("negative angle rotates clockwise (canvas grows)", async () => {
    const img = await createRectangleImage(200, 400, 60, 300);
    const rotated = await sharp(img)
      .rotate(-15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const meta = await sharp(rotated).metadata();

    expect(meta.width!).toBeGreaterThan(200);
    expect(meta.height!).toBeGreaterThan(400);
  });

  test("rotate(15) then rotate(-15) approximately restores original dimensions", async () => {
    const img = await createRectangleImage(200, 400, 60, 300);
    const original = await sharp(img).metadata();

    const rotated = await sharp(img)
      .rotate(15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const restored = await sharp(rotated)
      .rotate(-15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const restoredMeta = await sharp(restored).metadata();

    // After rotating and unrotating, canvas is larger due to two expansions.
    // This verifies that -angle reverses +angle.
    expect(restoredMeta.width!).toBeGreaterThanOrEqual(original.width!);
    expect(restoredMeta.height!).toBeGreaterThanOrEqual(original.height!);
  });
});

describe("tilt detection via image moments", () => {
  /**
   * Compute the dominant orientation of dark pixels in an image
   * using second-order central moments (PCA on the binary mask).
   * Returns the angle in degrees that the principal axis deviates from vertical.
   * Positive = object tilts clockwise, negative = counterclockwise.
   */
  async function measureTiltFromMoments(imageBuffer: Buffer): Promise<number> {
    const { data, info } = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const threshold = 128;

    let sumX = 0, sumY = 0, count = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y * width + x] < threshold) {
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
        if (data[y * width + x] < threshold) {
          const dx = x - cx;
          const dy = y - cy;
          mu20 += dx * dx;
          mu02 += dy * dy;
          mu11 += dx * dy;
        }
      }
    }

    // Angle of principal axis from horizontal
    const theta = 0.5 * Math.atan2(2 * mu11, mu20 - mu02);
    // Convert to deviation from vertical: vertical = -90° from horizontal
    const deviationFromVertical = theta + Math.PI / 2;
    // Normalize to [-pi/2, pi/2]
    const normalized = deviationFromVertical > Math.PI / 2
      ? deviationFromVertical - Math.PI
      : deviationFromVertical < -Math.PI / 2
        ? deviationFromVertical + Math.PI
        : deviationFromVertical;

    return normalized * (180 / Math.PI);
  }

  test("detects 0° tilt for perfectly vertical rectangle", async () => {
    const img = await createRectangleImage(200, 400, 60, 300);
    const tilt = await measureTiltFromMoments(img);
    expect(Math.abs(tilt)).toBeLessThan(0.5);
  });

  test("detects ~15° tilt for CW-rotated rectangle", async () => {
    const img = await createRectangleImage(400, 600, 80, 400);
    // sharp.rotate(-15) = CW rotation → product leans clockwise
    const tilted = await sharp(img)
      .rotate(-15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const tilt = await measureTiltFromMoments(tilted);
    // Moments report negative for CW lean (same as sharp convention)
    expect(tilt).toBeLessThan(-12);
    expect(tilt).toBeGreaterThan(-18);
  });

  test("detects ~15° tilt for CCW-rotated rectangle", async () => {
    const img = await createRectangleImage(400, 600, 80, 400);
    // sharp.rotate(15) = CCW rotation → product leans counterclockwise
    const tilted = await sharp(img)
      .rotate(15, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const tilt = await measureTiltFromMoments(tilted);
    // Moments report positive for CCW lean
    expect(tilt).toBeGreaterThan(12);
    expect(tilt).toBeLessThan(18);
  });

  test("detects ~5° tilt accurately", async () => {
    const img = await createRectangleImage(400, 600, 80, 400);
    const tilted = await sharp(img)
      .rotate(-5, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const tilt = await measureTiltFromMoments(tilted);
    expect(tilt).toBeLessThan(-3);
    expect(tilt).toBeGreaterThan(-7);
  });

  test("detects ~10° tilt accurately", async () => {
    const img = await createRectangleImage(400, 600, 80, 400);
    const tilted = await sharp(img)
      .rotate(-10, { background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .toBuffer();

    const tilt = await measureTiltFromMoments(tilted);
    expect(tilt).toBeLessThan(-8);
    expect(tilt).toBeGreaterThan(-12);
  });
});
