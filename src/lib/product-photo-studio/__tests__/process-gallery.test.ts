import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PhotoInput, ClassificationResponse, ProcessedGalleryPhoto } from "../types";

vi.mock("../create-thumbnail", () => ({
  preCropToProduct: vi.fn(),
}));

vi.mock("../background-removal", () => ({
  removeBackground: vi.fn(),
}));

vi.mock("../image-enhance", () => ({
  compositeOnCanvas: vi.fn(),
}));

import { preCropToProduct } from "../create-thumbnail";
import { removeBackground } from "../background-removal";
import { compositeOnCanvas } from "../image-enhance";
import { processGalleryPhotos, GALLERY_SIZE } from "../process-gallery";

const mockedPreCrop = vi.mocked(preCropToProduct);
const mockedRemoveBg = vi.mocked(removeBackground);
const mockedComposite = vi.mocked(compositeOnCanvas);

function makeImage(id = 0): PhotoInput {
  return { buffer: Buffer.from([0xff, 0xd8, id]), mediaType: "image/jpeg" };
}

function makeClassification(
  photos: Array<{
    index: number;
    type: string;
    isProduct?: boolean;
    quality?: number;
  }>,
): ClassificationResponse {
  return {
    photos: photos.map((p) => ({
      photo_index: p.index,
      is_product_photo: p.isProduct ?? true,
      photo_type: p.type as "product_front" | "product_back" | "price_tag",
      confidence: 0.9,
      rejection_reason: null,
      quality_score: p.quality ?? 0.8,
      has_reflections: false,
      text_readable: true,
    })),
    all_same_product: true,
    suspicious_content: false,
    overall_assessment: "Valid",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedPreCrop.mockResolvedValue(Buffer.from("cropped"));
  mockedRemoveBg.mockResolvedValue({
    imageBuffer: Buffer.from("bg-removed"),
    hasTransparency: true,
    providerUsed: "test-provider",
  });
  mockedComposite.mockResolvedValue({
    buffer: Buffer.from("composited"),
    format: "image/webp",
  });
});

describe("processGalleryPhotos", () => {
  test("skips the hero photo and processes remaining product photos", async () => {
    const images = [makeImage(0), makeImage(1), makeImage(2)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
      { index: 2, type: "product_side" },
    ]);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(2);
    expect(result[0].originalIndex).toBe(1);
    expect(result[1].originalIndex).toBe(2);
    expect(result[0].category).toBe("product");
    expect(mockedPreCrop).toHaveBeenCalledTimes(2);
  });

  test("processes price_tag photos with correct category", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "price_tag" },
    ]);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("price_tag");
    expect(result[0].originalIndex).toBe(1);
  });

  test("returns empty array when only hero photo exists", async () => {
    const images = [makeImage(0)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
    ]);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(0);
    expect(mockedPreCrop).not.toHaveBeenCalled();
  });

  test("limits output to 4 gallery photos", async () => {
    const images = Array.from({ length: 6 }, (_, i) => makeImage(i));
    const classification = makeClassification(
      Array.from({ length: 6 }, (_, i) => ({
        index: i,
        type: i === 0 ? "product_front" : "product_back",
      })),
    );

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(4);
  });

  test("skips non-product photo types (shelf, barcode, other)", async () => {
    const images = [makeImage(0), makeImage(1), makeImage(2), makeImage(3)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "shelf" },
      { index: 2, type: "barcode" },
      { index: 3, type: "other" },
    ]);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(0);
  });

  test("uses compositeOnCanvas with GALLERY_SIZE (800)", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
    ]);

    await processGalleryPhotos(images, classification, 0);

    expect(mockedComposite).toHaveBeenCalledWith(
      expect.any(Buffer),
      GALLERY_SIZE,
      true,
    );
  });

  test("continues when one photo fails (Promise.allSettled)", async () => {
    const images = [makeImage(0), makeImage(1), makeImage(2)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
      { index: 2, type: "product_side" },
    ]);

    mockedPreCrop
      .mockResolvedValueOnce(Buffer.from("cropped"))
      .mockRejectedValueOnce(new Error("sharp failed"));

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(1);
    expect(result[0].originalIndex).toBe(1);
  });

  test("sets backgroundRemoved=false when bg removal returns null", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
    ]);

    mockedRemoveBg.mockResolvedValueOnce(null);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(1);
    expect(result[0].backgroundRemoved).toBe(false);
    expect(mockedComposite).toHaveBeenCalledWith(
      expect.any(Buffer),
      GALLERY_SIZE,
      false,
    );
  });

  test("sets backgroundRemoved=false when hasTransparency is false", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
    ]);

    mockedRemoveBg.mockResolvedValueOnce({
      imageBuffer: Buffer.from("no-alpha"),
      hasTransparency: false,
      providerUsed: "test",
    });

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result[0].backgroundRemoved).toBe(false);
  });

  test("handles heroIndex=null (no hero) — processes all eligible photos", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
    ]);

    const result = await processGalleryPhotos(images, classification, null);

    expect(result).toHaveLength(2);
  });

  test("skips photos with out-of-range index", async () => {
    const images = [makeImage(0)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 5, type: "product_back" },
    ]);

    const result = await processGalleryPhotos(images, classification, 0);

    expect(result).toHaveLength(0);
  });

  test("passes photoType=price_tag to preCropToProduct for price tag photos", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "price_tag" },
    ]);

    await processGalleryPhotos(images, classification, 0);

    expect(mockedPreCrop).toHaveBeenCalledTimes(1);
    expect(mockedPreCrop).toHaveBeenCalledWith(
      expect.any(Buffer),
      "price_tag",
    );
  });

  test("passes photoType=undefined to preCropToProduct for product photos", async () => {
    const images = [makeImage(0), makeImage(1)];
    const classification = makeClassification([
      { index: 0, type: "product_front" },
      { index: 1, type: "product_back" },
    ]);

    await processGalleryPhotos(images, classification, 0);

    expect(mockedPreCrop).toHaveBeenCalledTimes(1);
    expect(mockedPreCrop).toHaveBeenCalledWith(
      expect.any(Buffer),
      undefined,
    );
  });
});
