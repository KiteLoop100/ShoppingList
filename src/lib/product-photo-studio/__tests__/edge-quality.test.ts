import { describe, test, expect } from "vitest";
import sharp from "sharp";

import { calculateEdgeQualityScore, ACCEPT_THRESHOLD, FALLBACK_THRESHOLD } from "../edge-quality";

async function makeProductOnTransparentBg(size = 100): Promise<Buffer> {
  const half = Math.floor(size / 2);
  const opaqueCenter = await sharp({
    create: { width: half, height: half, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: opaqueCenter, left: Math.floor(half / 2), top: Math.floor(half / 2) }])
    .png()
    .toBuffer();
}

async function makeFullyOpaque(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();
}

async function makeFullyTransparent(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
}

async function makeNoAlpha(size = 50): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 100, g: 100, b: 100 } },
  }).png().toBuffer();
}

async function makeProductWithHalo(size = 100): Promise<Buffer> {
  const raw = Buffer.alloc(size * size * 4, 0);

  const center = Math.floor(size / 2);
  const radius = Math.floor(size * 0.3);
  const haloWidth = 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
      const off = (y * size + x) * 4;

      if (dist < radius) {
        raw[off] = 200; raw[off + 1] = 100; raw[off + 2] = 50; raw[off + 3] = 255;
      } else if (dist < radius + haloWidth) {
        raw[off] = 250; raw[off + 1] = 250; raw[off + 2] = 250; raw[off + 3] = 255;
      }
    }
  }

  return sharp(raw, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
}

describe("calculateEdgeQualityScore", () => {
  test("returns valid result for a good product cutout", async () => {
    const img = await makeProductOnTransparentBg(100);
    const result = await calculateEdgeQualityScore(img);

    expect(result.isValid).toBe(true);
    expect(result.recommendation).toBe("accept");
    expect(result.transparencyRatio).toBeGreaterThan(0.03);
    expect(result.transparencyRatio).toBeLessThan(0.97);
    expect(result.score).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD);
    expect(result.haloScore).toBeGreaterThanOrEqual(0);
    expect(result.haloScore).toBeLessThanOrEqual(1);
    expect(result.edgeSmoothness).toBeGreaterThanOrEqual(0);
    expect(result.edgeSmoothness).toBeLessThanOrEqual(1);
  });

  test("returns fallback recommendation for fully opaque image", async () => {
    const img = await makeFullyOpaque();
    const result = await calculateEdgeQualityScore(img);

    expect(result.isValid).toBe(false);
    expect(result.recommendation).toBe("fallback");
    expect(result.transparencyRatio).toBeLessThan(0.03);
  });

  test("returns fallback recommendation for fully transparent image", async () => {
    const img = await makeFullyTransparent();
    const result = await calculateEdgeQualityScore(img);

    expect(result.isValid).toBe(false);
    expect(result.recommendation).toBe("fallback");
    expect(result.transparencyRatio).toBeGreaterThan(0.97);
  });

  test("returns score=0 and fallback for image without alpha", async () => {
    const img = await makeNoAlpha();
    const result = await calculateEdgeQualityScore(img);

    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
    expect(result.recommendation).toBe("fallback");
  });

  test("detects halo artifacts via nearWhiteEdgePixelRatio", async () => {
    const img = await makeProductWithHalo(100);
    const result = await calculateEdgeQualityScore(img);

    expect(result.diagnostics.nearWhiteEdgePixelRatio).toBeGreaterThan(0);
    expect(result.haloScore).toBeLessThan(1);
  });

  test("score reflects weighted combination of metrics", async () => {
    const img = await makeProductOnTransparentBg(100);
    const result = await calculateEdgeQualityScore(img);

    const transparencyValid =
      result.transparencyRatio >= 0.03 && result.transparencyRatio <= 0.97;
    const expected =
      (transparencyValid ? 1 : 0) * 0.4 +
      result.haloScore * 0.35 +
      result.edgeSmoothness * 0.25;
    expect(result.score).toBeCloseTo(expected, 5);
  });

  test("diagnostics include perimeterAreaRatio", async () => {
    const img = await makeProductOnTransparentBg(100);
    const result = await calculateEdgeQualityScore(img);

    expect(result.diagnostics.perimeterAreaRatio).toBeGreaterThan(0);
  });

  test("handles corrupt buffer gracefully", async () => {
    const result = await calculateEdgeQualityScore(Buffer.from("not an image"));

    expect(result.score).toBe(0);
    expect(result.isValid).toBe(false);
    expect(result.recommendation).toBe("fallback");
  });

  test("recommendation is 'accept' when score >= ACCEPT_THRESHOLD", async () => {
    const img = await makeProductOnTransparentBg(100);
    const result = await calculateEdgeQualityScore(img);

    expect(result.score).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD);
    expect(result.recommendation).toBe("accept");
    expect(result.isValid).toBe(true);
  });

  test("recommendation is always 'fallback' when transparency is invalid", async () => {
    const opaque = await makeFullyOpaque();
    const result = await calculateEdgeQualityScore(opaque);

    expect(result.recommendation).toBe("fallback");
    expect(result.isValid).toBe(false);
  });

  test("thresholds are ordered correctly", () => {
    expect(ACCEPT_THRESHOLD).toBeGreaterThan(FALLBACK_THRESHOLD);
    expect(FALLBACK_THRESHOLD).toBeGreaterThan(0);
    expect(ACCEPT_THRESHOLD).toBeLessThanOrEqual(1);
  });
});
