import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import type { PhotoInput, ClassificationResponse } from "../types";

vi.mock("../background-removal", () => ({
  removeBackground: vi.fn(),
}));

vi.mock("@/lib/api/photo-processing/image-utils", () => ({
  getProductBoundingBox: vi.fn(),
}));

import { removeBackground } from "../background-removal";
import { getProductBoundingBox } from "@/lib/api/photo-processing/image-utils";
import { createThumbnail } from "../create-thumbnail";

const mockedRemoveBg = vi.mocked(removeBackground);
const mockedGetBBox = vi.mocked(getProductBoundingBox);

async function makeTestImage(width = 100, height = 100): Promise<PhotoInput> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer();
  return { buffer, mediaType: "image/jpeg" };
}

function makeClassification(
  photos: Array<{ photo_type: string; quality_score: number }>,
): ClassificationResponse {
  return {
    photos: photos.map((p, i) => ({
      photo_index: i,
      is_product_photo: true,
      photo_type: p.photo_type as ClassificationResponse["photos"][0]["photo_type"],
      confidence: 0.9,
      rejection_reason: null,
      quality_score: p.quality_score,
      has_reflections: false,
      text_readable: true,
    })),
    all_same_product: true,
    suspicious_content: false,
    overall_assessment: "test",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRemoveBg.mockImplementation(async (buf) => buf);
  mockedGetBBox.mockResolvedValue(null);
});

describe("createThumbnail", () => {
  test("produces 800x800 full-size and 150x150 thumbnail JPEGs", async () => {
    const img = await makeTestImage();
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    const result = await createThumbnail([img], classification);

    const fullMeta = await sharp(result.fullSize).metadata();
    expect(fullMeta.width).toBe(800);
    expect(fullMeta.height).toBe(800);
    expect(fullMeta.format).toBe("jpeg");

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(150);
    expect(thumbMeta.height).toBe(150);
    expect(thumbMeta.format).toBe("jpeg");
  });

  test("selects front photo over other types", async () => {
    const backImg = await makeTestImage(80, 80);
    const frontImg = await makeTestImage(120, 120);
    const classification = makeClassification([
      { photo_type: "product_back", quality_score: 0.9 },
      { photo_type: "product_front", quality_score: 0.8 },
    ]);

    await createThumbnail([backImg, frontImg], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(120);
  });

  test("selects highest quality when multiple front photos", async () => {
    const lowQ = await makeTestImage(80, 80);
    const highQ = await makeTestImage(120, 120);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.5 },
      { photo_type: "product_front", quality_score: 0.95 },
    ]);

    await createThumbnail([lowQ, highQ], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(120);
    expect(meta.height).toBe(120);
  });

  test("skips price_tag and barcode for thumbnail selection", async () => {
    const priceTag = await makeTestImage(90, 90);
    const sidePhoto = await makeTestImage(110, 110);
    const classification = makeClassification([
      { photo_type: "price_tag", quality_score: 0.99 },
      { photo_type: "product_side", quality_score: 0.7 },
    ]);

    await createThumbnail([priceTag, sidePhoto], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(110);
    expect(meta.height).toBe(110);
  });

  test("passes through single photo directly", async () => {
    const img = await makeTestImage(100, 100);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    expect(mockedRemoveBg).toHaveBeenCalledTimes(1);
    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  test("pre-crops to bounding box when available", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 10,
      crop_y: 10,
      crop_width: 60,
      crop_height: 80,
    });

    const img = await makeTestImage(100, 100);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    expect(mockedGetBBox).toHaveBeenCalled();
    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(60);
    expect(meta.height).toBe(80);
  });

  test("falls back to full image when bounding box detection fails", async () => {
    mockedGetBBox.mockRejectedValueOnce(new Error("Claude unavailable"));

    const img = await makeTestImage(100, 100);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });
});
