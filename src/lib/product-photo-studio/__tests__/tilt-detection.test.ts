import { describe, test, expect } from "vitest";
import sharp from "sharp";
import { detectTilt } from "../tilt-detection";

/**
 * Create an image with horizontal bands (simulating text blocks on packaging).
 * Alternating dark/light bands produce strong horizontal edges for Hough.
 */
async function createStripedImage(
  canvasW: number,
  canvasH: number,
  tiltDegrees: number,
  useAlpha: boolean,
  bandHeight = 30,
): Promise<Buffer> {
  const channels = useAlpha ? 4 : 3;
  const raw = Buffer.alloc(canvasW * canvasH * channels, useAlpha ? 0 : 255);

  for (let y = 0; y < canvasH; y++) {
    const bandIndex = Math.floor(y / bandHeight);
    const isDark = bandIndex % 2 === 0;
    for (let x = 0; x < canvasW; x++) {
      const inRegion = x > canvasW * 0.1 && x < canvasW * 0.9;
      const idx = (y * canvasW + x) * channels;
      if (inRegion) {
        const val = isDark ? 30 : 220;
        raw[idx] = val;
        raw[idx + 1] = val;
        raw[idx + 2] = val;
        if (useAlpha) raw[idx + 3] = 255;
      } else if (!useAlpha) {
        raw[idx] = 255;
        raw[idx + 1] = 255;
        raw[idx + 2] = 255;
      } else {
        raw[idx + 3] = 0;
      }
    }
  }

  let img = sharp(raw, { raw: { width: canvasW, height: canvasH, channels } });
  let buf = await (useAlpha ? img.png().toBuffer() : img.jpeg().toBuffer());

  if (tiltDegrees !== 0) {
    const bg = useAlpha
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255 };
    buf = await sharp(buf).rotate(tiltDegrees, { background: bg }).toBuffer();
  }

  return buf;
}

/**
 * Create a solid rectangle on a canvas (for PCA fallback testing).
 */
async function createTiltedProduct(
  canvasW: number,
  canvasH: number,
  rectW: number,
  rectH: number,
  tiltDegrees: number,
  useAlpha = true,
): Promise<Buffer> {
  const fgColor = { r: 100, g: 50, b: 150, alpha: 255 };

  if (useAlpha) {
    const rect = await sharp({
      create: { width: rectW, height: rectH, channels: 4, background: fgColor },
    }).png().toBuffer();

    let canvas = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{
        input: rect,
        left: Math.round((canvasW - rectW) / 2),
        top: Math.round((canvasH - rectH) / 2),
      }])
      .png()
      .toBuffer();

    if (tiltDegrees !== 0) {
      canvas = await sharp(canvas)
        .rotate(tiltDegrees, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    }
    return canvas;
  }

  const rect = await sharp({
    create: { width: rectW, height: rectH, channels: 3, background: { r: 100, g: 50, b: 150 } },
  }).jpeg().toBuffer();

  let canvas = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([{
      input: rect,
      left: Math.round((canvasW - rectW) / 2),
      top: Math.round((canvasH - rectH) / 2),
    }])
    .jpeg()
    .toBuffer();

  if (tiltDegrees !== 0) {
    canvas = await sharp(canvas)
      .rotate(tiltDegrees, { background: { r: 255, g: 255, b: 255 } })
      .jpeg()
      .toBuffer();
  }
  return canvas;
}

describe("detectTilt — Hough transform (line-based)", () => {
  test("returns 0 for perfectly horizontal lines", async () => {
    const img = await createStripedImage(400, 600, 0, true);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
  });

  test("detects ~10° CW tilt from horizontal lines (alpha)", async () => {
    const img = await createStripedImage(400, 600, -10, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-7);
    expect(result.angle).toBeGreaterThan(-13);
  });

  test("detects ~10° CCW tilt from horizontal lines (alpha)", async () => {
    const img = await createStripedImage(400, 600, 10, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeGreaterThan(7);
    expect(result.angle).toBeLessThan(13);
  });

  test("detects ~15° tilt from horizontal lines", async () => {
    const img = await createStripedImage(400, 600, -15, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-12);
    expect(result.angle).toBeGreaterThan(-18);
  });

  test("detects ~5° tilt from horizontal lines", async () => {
    const img = await createStripedImage(400, 600, -5, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-3);
    expect(result.angle).toBeGreaterThan(-7);
  });

  test("detects ~3° tilt from horizontal lines", async () => {
    const img = await createStripedImage(400, 600, -3, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-1.5);
    expect(result.angle).toBeGreaterThan(-5);
  });

  test("correction straightens a 12° tilted line image", async () => {
    const img = await createStripedImage(500, 700, -12, true);

    const detected = await detectTilt(img);
    expect(Math.abs(detected.angle + 12)).toBeLessThan(3);

    const corrected = await sharp(img)
      .rotate(-detected.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const afterCorrection = await detectTilt(corrected);
    expect(Math.abs(afterCorrection.angle)).toBeLessThan(2);
  });

  test("detects tilt from horizontal lines without alpha (brightness)", async () => {
    const img = await createStripedImage(400, 600, -10, false);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-7);
    expect(result.angle).toBeGreaterThan(-13);
  });
});

describe("detectTilt — PCA fallback (solid shapes)", () => {
  test("returns 0 for a perfectly vertical product (alpha)", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 0, true);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
  });

  test("returns 0 for a perfectly vertical product (brightness)", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 0, false);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
  });

  test("detects ~15° CW tilt via alpha mask", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -15, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-10);
    expect(result.angle).toBeGreaterThan(-20);
  });

  test("detects ~15° CCW tilt via alpha mask", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 15, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeGreaterThan(10);
    expect(result.angle).toBeLessThan(20);
  });

  test("detects ~10° CW tilt via brightness fallback", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -10, false);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-6);
    expect(result.angle).toBeGreaterThan(-14);
  });

  test("detects ~5° tilt", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -5, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-3);
    expect(result.angle).toBeGreaterThan(-7);
  });

  test("ignores sub-threshold tilt (< 0.5°)", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 0, true);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
  });

  test("clamps tilt to ±30° max", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -40, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeGreaterThanOrEqual(-30);
    expect(result.angle).toBeLessThanOrEqual(30);
  });

  test("returns low confidence for nearly-empty images", async () => {
    const img = await sharp({
      create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();

    const result = await detectTilt(img);
    expect(result.confidence).toBe("low");
    expect(result.angle).toBe(0);
  });
});

describe("detectTilt — edge cases", () => {
  test("returns 0 for uniform white image (no edges, no mask)", async () => {
    const img = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer();

    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
  });

  test("handles very small images gracefully", async () => {
    const img = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 50, g: 50, b: 50, alpha: 255 } },
    }).png().toBuffer();

    const result = await detectTilt(img);
    expect(typeof result.angle).toBe("number");
    expect(result.confidence).toBeDefined();
  });

  test("detects ~20° tilt from horizontal lines", async () => {
    const img = await createStripedImage(500, 700, -20, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-16);
    expect(result.angle).toBeGreaterThan(-24);
  });
});
