import { describe, test, expect } from "vitest";
import sharp from "sharp";

import { makeThumbnail } from "../image-utils";

describe("makeThumbnail", () => {
  test("preserves full product in 150x150 without cropping (tall image like Maggi bottle)", async () => {
    const tallImage = await sharp({
      create: { width: 200, height: 800, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(tallImage);
    const meta = await sharp(result).metadata();

    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
  });

  test("produces JPEG output", async () => {
    const img = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 128, b: 0 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(img);
    const meta = await sharp(result).metadata();

    expect(meta.format).toBe("jpeg");
  });

  test("contain-fits wide image without cropping", async () => {
    const wideImage = await sharp({
      create: { width: 800, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(wideImage);
    const meta = await sharp(result).metadata();

    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
  });
});
