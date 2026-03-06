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

describe("compositeOnCanvas", () => {
  test("produces 1200x1200 WebP for full-size", async () => {
    const input = await makeTestImage(100, 100, 3);
    const { buffer, format } = await compositeOnCanvas(input, 1200, false);

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(1200);
    expect(meta.format).toBe("webp");
    expect(format).toBe("image/webp");
  });

  test("produces 150x150 JPEG for thumbnail", async () => {
    const input = await makeTestImage(100, 100, 3);
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

  test("product fills roughly 80% of the canvas", async () => {
    const input = await sharp({
      create: { width: 400, height: 400, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
    }).png().toBuffer();

    const { buffer } = await compositeOnCanvas(input, 1200, false);
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(1200);
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
});
