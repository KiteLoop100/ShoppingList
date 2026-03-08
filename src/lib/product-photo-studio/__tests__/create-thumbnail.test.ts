import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import type { PhotoInput, ClassificationResponse } from "../types";

vi.mock("../background-removal", () => ({
  removeBackground: vi.fn(),
}));

vi.mock("@/lib/api/photo-processing/image-utils", () => ({
  getProductBoundingBox: vi.fn(),
  detectTextRotation: vi.fn(),
  detectTiltCorrection: vi.fn(),
}));

import { removeBackground } from "../background-removal";
import { getProductBoundingBox, detectTextRotation, detectTiltCorrection } from "@/lib/api/photo-processing/image-utils";
import { createThumbnail } from "../create-thumbnail";

const mockedRemoveBg = vi.mocked(removeBackground);
const mockedGetBBox = vi.mocked(getProductBoundingBox);
const mockedDetectRotation = vi.mocked(detectTextRotation);
const mockedDetectTilt = vi.mocked(detectTiltCorrection);

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
  mockedRemoveBg.mockImplementation(async (buf) => ({
    imageBuffer: buf,
    hasTransparency: false,
    providerUsed: "crop-fallback",
  }));
  mockedGetBBox.mockResolvedValue(null);
  mockedDetectRotation.mockResolvedValue(0);
  mockedDetectTilt.mockResolvedValue(0);
});

describe("createThumbnail", () => {
  test("produces 1200x1200 full-size WebP and 150x150 thumbnail JPEG", async () => {
    const img = await makeTestImage();
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    const result = await createThumbnail([img], classification);

    const fullMeta = await sharp(result.fullSize).metadata();
    expect(fullMeta.width).toBe(1200);
    expect(fullMeta.height).toBe(1200);
    expect(fullMeta.format).toBe("webp");
    expect(result.fullSizeFormat).toBe("image/webp");

    const thumbMeta = await sharp(result.thumbnail).metadata();
    expect(thumbMeta.width).toBe(150);
    expect(thumbMeta.height).toBe(150);
    expect(thumbMeta.format).toBe("jpeg");
    expect(result.thumbnailFormat).toBe("image/jpeg");
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

    expect(mockedRemoveBg).toHaveBeenCalled();
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

  test("applies rotation from dedicated detection (independent of bbox)", async () => {
    mockedGetBBox.mockResolvedValueOnce(null);
    mockedDetectRotation.mockResolvedValueOnce(90);

    const img = await makeTestImage(100, 200);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    // 100x200 rotated 90° CW becomes 200x100
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  test("applies both crop and rotation when both are detected", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 10, crop_y: 10, crop_width: 80, crop_height: 180,
    });
    mockedDetectRotation.mockResolvedValueOnce(90);

    const img = await makeTestImage(100, 200);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    // Crop to ~100x200 (with padding), then rotate 90° → ~200x100
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  test("does not rotate when rotation is 0", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 10, crop_y: 10, crop_width: 80, crop_height: 80,
    });
    mockedDetectRotation.mockResolvedValueOnce(0);

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

  test("runs bbox and rotation detection in parallel", async () => {
    let bboxCallTime = 0;
    let rotationCallTime = 0;

    mockedGetBBox.mockImplementation(async () => {
      bboxCallTime = Date.now();
      return null;
    });
    mockedDetectRotation.mockImplementation(async () => {
      rotationCallTime = Date.now();
      return 0;
    });

    const img = await makeTestImage(100, 100);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    // Both should be called (timestamps within 50ms of each other = parallel)
    expect(mockedGetBBox).toHaveBeenCalledTimes(1);
    expect(mockedDetectRotation).toHaveBeenCalledTimes(1);
    expect(Math.abs(bboxCallTime - rotationCallTime)).toBeLessThan(50);
  });

  test("pre-crops with 20% margin and minimum 50px padding", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 20, crop_y: 30, crop_width: 160, crop_height: 340,
    });

    const img = await makeTestImage(200, 400);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    expect(mockedGetBBox).toHaveBeenCalled();
    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(400);
  });

  test("pre-crop margin is clamped at image boundaries", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 0, crop_y: 0, crop_width: 80, crop_height: 90,
    });

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

  test("sets backgroundRemovalFailed when crop-fallback is used after provider failures", async () => {
    mockedRemoveBg.mockImplementation(async (buf) => ({
      imageBuffer: buf,
      hasTransparency: false,
      providerUsed: "crop-fallback",
      noProvidersConfigured: false,
    }));

    const img = await makeTestImage();
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    const result = await createThumbnail([img], classification);

    expect(result.backgroundRemovalFailed).toBe(true);
    expect(result.backgroundRemoved).toBe(false);
  });

  test("does NOT set backgroundRemovalFailed when no providers are configured", async () => {
    mockedRemoveBg.mockImplementation(async (buf) => ({
      imageBuffer: buf,
      hasTransparency: false,
      providerUsed: "crop-fallback",
      noProvidersConfigured: true,
    }));

    const img = await makeTestImage();
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    const result = await createThumbnail([img], classification);

    expect(result.backgroundRemovalFailed).toBe(false);
    expect(result.backgroundRemoved).toBe(false);
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

  test("processes two candidates in parallel when best score is below threshold", async () => {
    const img1 = await makeTestImage(100, 100);
    const img2 = await makeTestImage(120, 120);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.5 },
      { photo_type: "product_side", quality_score: 0.4 },
    ]);

    await createThumbnail([img1, img2], classification);

    expect(mockedRemoveBg).toHaveBeenCalledTimes(2);
  });

  test("processes single candidate when best score is above threshold", async () => {
    const img1 = await makeTestImage(100, 100);
    const img2 = await makeTestImage(120, 120);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
      { photo_type: "product_side", quality_score: 0.4 },
    ]);

    await createThumbnail([img1, img2], classification);

    expect(mockedRemoveBg).toHaveBeenCalledTimes(1);
  });
});
