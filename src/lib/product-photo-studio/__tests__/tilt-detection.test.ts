import { describe, test, expect } from "vitest";
import sharp from "sharp";
import { detectTilt } from "../tilt-detection";

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

  // 3-channel: dark object on white, output as JPEG (no alpha)
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

describe("detectTilt", () => {
  test("returns 0 for a perfectly vertical product (alpha)", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 0, true);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
    expect(result.method).toBe("alpha");
  });

  test("returns 0 for a perfectly vertical product (brightness)", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 0, false);
    const result = await detectTilt(img);
    expect(result.angle).toBe(0);
    expect(result.method).toBe("brightness");
  });

  test("detects ~15° CW tilt via alpha mask", async () => {
    // sharp.rotate(-15) = CW rotation of the content
    const img = await createTiltedProduct(400, 600, 100, 400, -15, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-12);
    expect(result.angle).toBeGreaterThan(-18);
    expect(result.method).toBe("alpha");
  });

  test("detects ~15° CCW tilt via alpha mask", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, 15, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeGreaterThan(12);
    expect(result.angle).toBeLessThan(18);
  });

  test("detects ~10° CW tilt via brightness fallback", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -10, false);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-8);
    expect(result.angle).toBeGreaterThan(-12);
    expect(result.method).toBe("brightness");
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

  test("detects ~25° tilt accurately", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -25, true);
    const result = await detectTilt(img);
    expect(result.angle).toBeLessThan(-22);
    expect(result.angle).toBeGreaterThan(-28);
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

  test("returns high confidence for well-filled product image", async () => {
    const img = await createTiltedProduct(400, 600, 200, 500, -10, true);
    const result = await detectTilt(img);
    expect(result.confidence).toBe("high");
    expect(Math.abs(result.angle)).toBeGreaterThan(8);
  });

  test("correction straightens a 12° tilted product", async () => {
    const img = await createTiltedProduct(400, 600, 100, 400, -12, true);

    const detected = await detectTilt(img);
    expect(Math.abs(detected.angle + 12)).toBeLessThan(2);

    const corrected = await sharp(img)
      .rotate(-detected.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const afterCorrection = await detectTilt(corrected);
    expect(Math.abs(afterCorrection.angle)).toBeLessThan(1.5);
  });

  test("correction straightens a 25° tilted product", async () => {
    const img = await createTiltedProduct(500, 700, 120, 500, -25, true);

    const detected = await detectTilt(img);
    expect(Math.abs(detected.angle + 25)).toBeLessThan(2);

    const corrected = await sharp(img)
      .rotate(-detected.angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const afterCorrection = await detectTilt(corrected);
    expect(Math.abs(afterCorrection.angle)).toBeLessThan(1.5);
  });
});
