import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

import { callClaudeJSON } from "@/lib/api/claude-client";
import { getProductBoundingBox, makeThumbnail } from "../image-utils";

const mockedClaude = vi.mocked(callClaudeJSON);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProductBoundingBox", () => {
  test("returns parsed bounding box when coordinates are within bounds", async () => {
    mockedClaude.mockResolvedValueOnce({
      crop_x: 50,
      crop_y: 100,
      crop_width: 400,
      crop_height: 600,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).toEqual({ crop_x: 50, crop_y: 100, crop_width: 400, crop_height: 600 });
  });

  test("clamps crop_width when it exceeds right image boundary", async () => {
    // crop_x=100, crop_width=450 → right edge = 550 > 500 → should clamp to 400
    mockedClaude.mockResolvedValueOnce({
      crop_x: 100,
      crop_y: 0,
      crop_width: 450,
      crop_height: 300,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 400);

    expect(result).not.toBeNull();
    expect(result!.crop_x + result!.crop_width).toBeLessThanOrEqual(500);
    expect(result!.crop_width).toBe(400);
  });

  test("clamps crop_height when it exceeds bottom image boundary (tall product like Maggi bottle)", async () => {
    // Simulates a bounding box for a tall bottle where Claude slightly overshoots
    // crop_y=10, crop_height=1595 → bottom = 1605 > 1600 → should clamp to 1590
    mockedClaude.mockResolvedValueOnce({
      crop_x: 100,
      crop_y: 10,
      crop_width: 800,
      crop_height: 1595,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 1000, 1600);

    expect(result).not.toBeNull();
    expect(result!.crop_y + result!.crop_height).toBeLessThanOrEqual(1600);
    expect(result!.crop_height).toBe(1590);
  });

  test("clamps both dimensions when both exceed bounds", async () => {
    mockedClaude.mockResolvedValueOnce({
      crop_x: 490,
      crop_y: 790,
      crop_width: 200,
      crop_height: 200,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).not.toBeNull();
    expect(result!.crop_x + result!.crop_width).toBeLessThanOrEqual(500);
    expect(result!.crop_y + result!.crop_height).toBeLessThanOrEqual(800);
  });

  test("returns null when Claude throws", async () => {
    mockedClaude.mockRejectedValueOnce(new Error("API error"));

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).toBeNull();
  });

  test("clamps crop_x to imageWidth-1 when it exceeds bounds", async () => {
    // crop_x beyond image width → should be clamped, not rejected
    mockedClaude.mockResolvedValueOnce({
      crop_x: 600,
      crop_y: 0,
      crop_width: 100,
      crop_height: 100,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).not.toBeNull();
    expect(result!.crop_x).toBeLessThan(500);
    expect(result!.crop_x + result!.crop_width).toBeLessThanOrEqual(500);
  });

  test("floors float values from Claude", async () => {
    mockedClaude.mockResolvedValueOnce({
      crop_x: 10.7,
      crop_y: 20.3,
      crop_width: 300.9,
      crop_height: 400.1,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 600);

    expect(result).toEqual({ crop_x: 10, crop_y: 20, crop_width: 300, crop_height: 400 });
  });
});

describe("makeThumbnail", () => {
  test("preserves full product in 150×150 without cropping (tall image like Maggi bottle)", async () => {
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
