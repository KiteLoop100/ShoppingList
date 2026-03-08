import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import type { PhotoInput, ClassificationResponse } from "../types";

vi.mock("../background-removal", () => ({
  removeBackground: vi.fn(),
}));

vi.mock("../edge-quality", () => ({
  calculateEdgeQualityScore: vi.fn().mockResolvedValue({
    score: 0.8,
    transparencyRatio: 0.5,
    haloScore: 0.9,
    edgeSmoothness: 0.7,
    isValid: true,
    recommendation: "accept",
    diagnostics: { nearWhiteEdgePixelRatio: 0.05, perimeterAreaRatio: 0.6 },
  }),
}));

vi.mock("../gemini-bbox", () => ({
  geminiSmartPreCrop: vi.fn(),
  claudeSmartPreCrop: vi.fn(),
}));

import { removeBackground } from "../background-removal";
import { geminiSmartPreCrop, claudeSmartPreCrop } from "../gemini-bbox";
import { createThumbnail } from "../create-thumbnail";

const mockedRemoveBg = vi.mocked(removeBackground);
const mockedGeminiPreCrop = vi.mocked(geminiSmartPreCrop);
const mockedClaudePreCrop = vi.mocked(claudeSmartPreCrop);

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
  mockedGeminiPreCrop.mockResolvedValue(null);
  mockedClaudePreCrop.mockResolvedValue(null);
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

  test("applies rotation when pre-crop returns rotation", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce({
      bbox: { x: 0, y: 0, width: 100, height: 200 },
      rotation: 90,
      tilt: 0,
    });

    const img = await makeTestImage(100, 200);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  test("applies crop and rotation together from single pre-crop result", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce({
      bbox: { x: 10, y: 10, width: 80, height: 180 },
      rotation: 90,
      tilt: 0,
    });

    const img = await makeTestImage(100, 200);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  test("does not rotate when pre-crop returns rotation 0", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce({
      bbox: { x: 10, y: 10, width: 80, height: 80 },
      rotation: 0,
      tilt: 0,
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

  test("falls back to Claude when Gemini returns null", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce(null);
    mockedClaudePreCrop.mockResolvedValueOnce({
      bbox: { x: 10, y: 10, width: 80, height: 80 },
      rotation: 0,
      tilt: 0,
    });

    const img = await makeTestImage(100, 100);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    expect(mockedGeminiPreCrop).toHaveBeenCalledTimes(1);
    expect(mockedClaudePreCrop).toHaveBeenCalledTimes(1);
  });

  test("pre-crops with 20% margin and minimum 50px padding", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce({
      bbox: { x: 20, y: 30, width: 160, height: 340 },
      rotation: 0,
      tilt: 0,
    });

    const img = await makeTestImage(200, 400);
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    await createThumbnail([img], classification);

    expect(mockedGeminiPreCrop).toHaveBeenCalled();
    const passedBuf = mockedRemoveBg.mock.calls[0][0];
    const meta = await sharp(passedBuf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(400);
  });

  test("pre-crop margin is clamped at image boundaries", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce({
      bbox: { x: 0, y: 0, width: 80, height: 90 },
      rotation: 0,
      tilt: 0,
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

  test("uses soft-fallback when removeBackground returns null", async () => {
    mockedRemoveBg.mockResolvedValue(null);

    const img = await makeTestImage();
    const classification = makeClassification([
      { photo_type: "product_front", quality_score: 0.9 },
    ]);

    const result = await createThumbnail([img], classification);

    expect(result.backgroundRemovalFailed).toBe(true);
    expect(result.backgroundRemoved).toBe(false);
    expect(result.backgroundProvider).toBe("soft-fallback");

    const fullMeta = await sharp(result.fullSize).metadata();
    expect(fullMeta.width).toBe(1200);
    expect(fullMeta.height).toBe(1200);
  });

  test("falls back to full image when both providers return null", async () => {
    mockedGeminiPreCrop.mockResolvedValueOnce(null);
    mockedClaudePreCrop.mockResolvedValueOnce(null);

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
