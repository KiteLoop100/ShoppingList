import { describe, test, expect } from "vitest";
import sharp from "sharp";
import { enhanceProduct, removeReflections, compositeOnCanvas } from "../image-enhance";

async function makeTestImage(
  width = 100,
  height = 100,
  channels: 3 | 4 = 3,
): Promise<Buffer> {
  const bg = channels === 4
    ? { r: 200, g: 100, b: 50, alpha: 255 }
    : { r: 200, g: 100, b: 50 };
  return sharp({
    create: { width, height, channels, background: bg },
  })
    .png()
    .toBuffer();
}

describe("enhanceProduct", () => {
  test("returns buffer with same dimensions for opaque image", async () => {
    const input = await makeTestImage(100, 100, 3);
    const result = await enhanceProduct(input);

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  test("preserves alpha channel for transparent images", async () => {
    const input = await makeTestImage(100, 100, 4);
    const result = await enhanceProduct(input);

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.channels).toBe(4);
  });

  test("increases saturation (brighter colors than input)", async () => {
    const input = await makeTestImage(50, 50, 3);
    const result = await enhanceProduct(input);

    const inputStats = await sharp(input).stats();
    const outputStats = await sharp(result).stats();

    const inputMean = inputStats.channels.reduce((s, c) => s + c.mean, 0) / 3;
    const outputMean = outputStats.channels.reduce((s, c) => s + c.mean, 0) / 3;
    expect(outputMean).not.toBe(inputMean);
  });
});

async function makeProductOnTransparentBg(
  productW: number,
  productH: number,
  padX: number,
  padY: number,
): Promise<Buffer> {
  const totalW = productW + 2 * padX;
  const totalH = productH + 2 * padY;
  const product = await sharp({
    create: { width: productW, height: productH, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();
  return sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: product, left: padX, top: padY }])
    .png()
    .toBuffer();
}

describe("compositeOnCanvas", () => {
  test("produces 1200x1200 WebP for full-size (RGB)", async () => {
    const input = await makeTestImage(100, 100, 3);
    const { buffer, format } = await compositeOnCanvas(input, 1200, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
    expect(meta.format).toBe("webp");
    expect(format).toBe("image/webp");
  });

  test("produces 150x150 JPEG for thumbnail (RGB)", async () => {
    const input = await makeTestImage(100, 100, 3);
    const { buffer, format } = await compositeOnCanvas(input, 150, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
    expect(meta.format).toBe("jpeg");
    expect(format).toBe("image/jpeg");
  });

  test("RGB image fills full canvas axis (no padding)", async () => {
    const input = await makeTestImage(400, 200, 3);
    const { buffer } = await compositeOnCanvas(input, 1200, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);

    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const isWhite = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return data[idx] >= 250 && data[idx + 1] >= 250 && data[idx + 2] >= 250;
    };
    const cy = Math.round(info.height / 2);
    expect(isWhite(2, cy)).toBe(false);
    expect(isWhite(info.width - 3, cy)).toBe(false);
  });

  test("RGBA tall image fills full canvas height (edge-to-edge)", async () => {
    const input = await makeProductOnTransparentBg(200, 400, 10, 20);
    const { buffer } = await compositeOnCanvas(input, 1200, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);

    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const isWhite = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return data[idx] >= 250 && data[idx + 1] >= 250 && data[idx + 2] >= 250;
    };

    // Center column, top and bottom rows should be non-white (product fills height)
    const cx = Math.round(info.width / 2);
    expect(isWhite(cx, 2)).toBe(false);
    expect(isWhite(cx, info.height - 3)).toBe(false);
  });

  test("RGBA wide image fills full canvas width", async () => {
    const input = await makeProductOnTransparentBg(400, 200, 20, 10);
    const { buffer } = await compositeOnCanvas(input, 1200, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);

    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const isWhite = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return data[idx] >= 250 && data[idx + 1] >= 250 && data[idx + 2] >= 250;
    };

    // Center row, left and right edges should be non-white (product fills width)
    const cy = Math.round(info.height / 2);
    expect(isWhite(2, cy)).toBe(false);
    expect(isWhite(info.width - 3, cy)).toBe(false);
  });

  test("RGBA narrow product with large transparent margin fills full height", async () => {
    // Simulates a bottle: 100px wide x 400px tall on a 500x500 transparent canvas
    // After trim, the product is 20% of image area — previously skipped by TRIM_MIN_PIXEL_RATIO=0.5
    const input = await makeProductOnTransparentBg(100, 400, 200, 50);
    const { buffer } = await compositeOnCanvas(input, 1200, false);

    const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
    const isWhite = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return data[idx] >= 250 && data[idx + 1] >= 250 && data[idx + 2] >= 250;
    };

    const cx = Math.round(info.width / 2);
    expect(isWhite(cx, 2)).toBe(false);
    expect(isWhite(cx, info.height - 3)).toBe(false);

    expect(isWhite(2, Math.round(info.height / 2))).toBe(true);
    expect(isWhite(info.width - 3, Math.round(info.height / 2))).toBe(true);
  });

  test("RGBA thumbnail (150px) also uses edge-to-edge", async () => {
    const input = await makeProductOnTransparentBg(100, 200, 10, 10);
    const { buffer, format } = await compositeOnCanvas(input, 150, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
    expect(meta.format).toBe("jpeg");
    expect(format).toBe("image/jpeg");
  });

  test("with shadow still produces correct dimensions", async () => {
    const input = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
    }).png().toBuffer();

    const { buffer } = await compositeOnCanvas(input, 1200, true);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
  });
});

describe("removeReflections", () => {
  test("returns original when no significant highlights are present", async () => {
    const input = await makeTestImage(100, 100, 3);
    const result = await removeReflections(input);

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  test("reduces highlight intensity for images with reflections", async () => {
    // Create image with a large white (reflection) area
    const base = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 100, b: 100 } },
    }).png().toBuffer();

    // Add a white rectangle simulating a reflection (top-left quarter)
    const whiteRect = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 252, g: 252, b: 252 } },
    }).png().toBuffer();

    const input = await sharp(base)
      .composite([{ input: whiteRect, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const result = await removeReflections(input);

    expect(result).toBeInstanceOf(Buffer);
    // The result should have reduced highlight intensity
    const resultStats = await sharp(result).stats();
    const inputStats = await sharp(input).stats();

    // At least one channel's max should be reduced
    const inputMaxMean = Math.max(...inputStats.channels.map((c) => c.max));
    const resultMaxMean = Math.max(...resultStats.channels.map((c) => c.max));
    expect(resultMaxMean).toBeLessThanOrEqual(inputMaxMean);
  });

  test("preserves alpha channel", async () => {
    const input = await makeTestImage(100, 100, 4);
    const result = await removeReflections(input);

    const meta = await sharp(result).metadata();
    expect(meta.channels).toBe(4);
  });

  test("handles RGBA image with reflections without 'unsupported image format' error", async () => {
    const base = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 100, g: 100, b: 100, alpha: 200 } },
    }).png().toBuffer();

    const whiteRect = await sharp({
      create: { width: 30, height: 30, channels: 4, background: { r: 252, g: 252, b: 252, alpha: 255 } },
    }).png().toBuffer();

    const input = await sharp(base)
      .composite([{ input: whiteRect, left: 10, top: 10 }])
      .png()
      .toBuffer();

    const result = await removeReflections(input);

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe("png");
    expect(meta.channels).toBe(4);
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });
});
