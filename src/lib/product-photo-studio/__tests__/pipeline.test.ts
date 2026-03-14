import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PhotoInput, ExtractionResult } from "../types";

vi.mock("../validate-classify", () => ({
  classifyPhotos: vi.fn(),
}));

vi.mock("../extract-product-info", () => ({
  extractProductInfo: vi.fn(),
  scanBarcodesFromAll: vi.fn(),
}));

vi.mock("../create-thumbnail", () => ({
  createThumbnail: vi.fn(),
}));

vi.mock("../process-gallery", () => ({
  processGalleryPhotos: vi.fn(),
}));

vi.mock("../verify-quality", () => ({
  verifyThumbnailQuality: vi.fn(),
}));

import { classifyPhotos } from "../validate-classify";
import { extractProductInfo, scanBarcodesFromAll } from "../extract-product-info";
import { createThumbnail } from "../create-thumbnail";
import { processGalleryPhotos } from "../process-gallery";
import { verifyThumbnailQuality } from "../verify-quality";
import { processCompetitorPhotos } from "../pipeline";

const mockedClassify = vi.mocked(classifyPhotos);
const mockedExtract = vi.mocked(extractProductInfo);
const mockedScanBarcodes = vi.mocked(scanBarcodesFromAll);
const mockedCreateThumb = vi.mocked(createThumbnail);
const mockedGallery = vi.mocked(processGalleryPhotos);
const mockedVerify = vi.mocked(verifyThumbnailQuality);

function makeImage(): PhotoInput {
  return { buffer: Buffer.from([0xff, 0xd8]), mediaType: "image/jpeg" };
}

const validClassification = {
  photos: [
    {
      photo_index: 0,
      is_product_photo: true,
      photo_type: "product_front" as const,
      confidence: 0.95,
      rejection_reason: null,
      quality_score: 0.9,
      has_reflections: false,
      text_readable: true,
    },
  ],
  all_same_product: true,
  suspicious_content: false,
  overall_assessment: "Valid",
};

const validExtractedData = {
  name: "Test Product",
  brand: "TestBrand",
  ean_barcode: null,
  article_number: null,
  price: 1.99,
  retailer_from_price_tag: "REWE",
  unit_price: null,
  weight_or_quantity: "500g",
  ingredients: "Water, Salt",
  nutrition_info: null,
  allergens: null,
  nutri_score: null as const,
  is_bio: false,
  is_vegan: false,
  is_gluten_free: false,
  is_lactose_free: false,
  animal_welfare_level: null,
  country_of_origin: null,
};

const validExtractionResult: ExtractionResult = {
  data: validExtractedData,
  suspicious_content: false,
};

const validThumbnail = {
  fullSize: Buffer.from("full"),
  fullSizeFormat: "image/webp" as const,
  thumbnail: Buffer.from("thumb"),
  thumbnailFormat: "image/jpeg" as const,
  backgroundRemoved: true,
  backgroundProvider: "remove.bg",
};

const approvedVerification = {
  passes_quality_check: true,
  quality_score: 0.85,
  issues: [] as string[],
  recommendation: "approve" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedClassify.mockResolvedValue(validClassification);
  mockedScanBarcodes.mockResolvedValue([null]);
  mockedExtract.mockResolvedValue(validExtractionResult);
  mockedCreateThumb.mockResolvedValue(validThumbnail);
  mockedGallery.mockResolvedValue([]);
  mockedVerify.mockResolvedValue(approvedVerification);
});

describe("processCompetitorPhotos — legacy path (no photoRoles)", () => {
  test("returns success for valid product photos", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("success");
    expect(result.extractedData?.name).toBe("Test Product");
    expect(result.thumbnailFull).toBeDefined();
    expect(result.thumbnailFullFormat).toBe("image/webp");
    expect(result.thumbnailSmall).toBeDefined();
    expect(result.qualityScore).toBe(0.85);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  test("passes fullSizeFormat to verifyThumbnailQuality", async () => {
    await processCompetitorPhotos({ images: [makeImage()] });

    expect(mockedVerify).toHaveBeenCalledWith(
      validThumbnail.fullSize,
      "image/webp",
      false,
    );
  });

  test("returns review_required when suspicious content detected via classify", async () => {
    mockedClassify.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: false,
          photo_type: "other",
          confidence: 0.9,
          rejection_reason: "selfie",
          quality_score: 0,
          has_reflections: false,
          text_readable: false,
        },
      ],
      all_same_product: false,
      suspicious_content: true,
      overall_assessment: "Not a product",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("review_required");
    expect(result.reviewReason).toBe("suspicious_content");
    expect(result.extractedData).toBeNull();
    expect(mockedExtract).not.toHaveBeenCalled();
    expect(mockedCreateThumb).not.toHaveBeenCalled();
  });

  test("continues pipeline when photo not classified as product (no suspicious content)", async () => {
    mockedClassify.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: false,
          photo_type: "other",
          confidence: 0.8,
          rejection_reason: "organic_product",
          quality_score: 0.5,
          has_reflections: false,
          text_readable: false,
        },
      ],
      all_same_product: false,
      suspicious_content: false,
      overall_assessment: "Unrecognized product",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("success");
    expect(result.extractedData).not.toBeNull();
    expect(result.thumbnailFull).toBeDefined();
    expect(mockedExtract).toHaveBeenCalled();
    expect(mockedCreateThumb).toHaveBeenCalled();
  });

  test("returns success with thumbnailType soft_fallback when background removal failed", async () => {
    mockedCreateThumb.mockResolvedValueOnce({
      ...validThumbnail,
      backgroundRemoved: false,
      backgroundRemovalFailed: true,
      backgroundProvider: "soft-fallback",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("success");
    expect(result.backgroundRemovalFailed).toBe(true);
    expect(result.thumbnailType).toBe("soft_fallback");
  });

  test("passes backgroundRemovalFailed=true to verifyThumbnailQuality when bg removal failed", async () => {
    mockedCreateThumb.mockResolvedValueOnce({
      ...validThumbnail,
      backgroundRemovalFailed: true,
    });

    await processCompetitorPhotos({ images: [makeImage()] });

    expect(mockedVerify).toHaveBeenCalledWith(
      validThumbnail.fullSize,
      "image/webp",
      true,
    );
  });

  test("returns thumbnailType background_removed for successful bg removal", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.thumbnailType).toBe("background_removed");
  });

  test("uses scanned EAN over AI-extracted EAN", async () => {
    mockedScanBarcodes.mockResolvedValueOnce(["4001234567890"]);
    mockedExtract.mockResolvedValueOnce({
      data: { ...validExtractedData, ean_barcode: "0000000000000" },
      suspicious_content: false,
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.extractedData?.ean_barcode).toBe("4001234567890");
  });

  test("runs extraction, thumbnail, and gallery in parallel", async () => {
    const callOrder: string[] = [];
    mockedExtract.mockImplementation(async () => {
      callOrder.push("extract-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("extract-end");
      return validExtractionResult;
    });
    mockedCreateThumb.mockImplementation(async () => {
      callOrder.push("thumb-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("thumb-end");
      return validThumbnail;
    });
    mockedGallery.mockImplementation(async () => {
      callOrder.push("gallery-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("gallery-end");
      return [];
    });

    await processCompetitorPhotos({ images: [makeImage()] });

    expect(callOrder[0]).toBe("extract-start");
    expect(callOrder[1]).toBe("thumb-start");
    expect(callOrder[2]).toBe("gallery-start");
  });

  test("includes galleryPhotos in result when present", async () => {
    mockedGallery.mockResolvedValueOnce([
      {
        originalIndex: 1,
        category: "product",
        processed: Buffer.from("gallery-photo"),
        processedFormat: "image/webp",
        backgroundRemoved: true,
      },
    ]);

    const result = await processCompetitorPhotos({
      images: [makeImage(), makeImage()],
    });

    expect(result.galleryPhotos).toHaveLength(1);
    expect(result.galleryPhotos![0].originalIndex).toBe(1);
    expect(result.galleryPhotos![0].category).toBe("product");
  });

  test("omits galleryPhotos from result when empty", async () => {
    mockedGallery.mockResolvedValueOnce([]);

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.galleryPhotos).toBeUndefined();
  });

  test("does not call processGalleryPhotos when suspicious content detected", async () => {
    mockedClassify.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: false,
          photo_type: "other",
          confidence: 0.9,
          rejection_reason: "selfie",
          quality_score: 0,
          has_reflections: false,
          text_readable: false,
        },
      ],
      all_same_product: false,
      suspicious_content: true,
      overall_assessment: "Not a product",
    });

    await processCompetitorPhotos({ images: [makeImage()] });

    expect(mockedGallery).not.toHaveBeenCalled();
  });

  test("calls classifyPhotos when no photoRoles provided", async () => {
    await processCompetitorPhotos({ images: [makeImage()] });
    expect(mockedClassify).toHaveBeenCalled();
  });
});

describe("processCompetitorPhotos — fast path (with photoRoles)", () => {
  test("skips classification when photoRoles provided", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(mockedClassify).not.toHaveBeenCalled();
    expect(result.status).toBe("success");
    expect(result.extractedData?.name).toBe("Test Product");
  });

  test("does not call verifyThumbnailQuality", async () => {
    await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(mockedVerify).not.toHaveBeenCalled();
  });

  test("uses first front role as hero index", async () => {
    await processCompetitorPhotos({
      images: [makeImage(), makeImage(), makeImage()],
      photoRoles: ["price_tag", "front", "extra"],
    });

    expect(mockedCreateThumb).toHaveBeenCalledWith(
      expect.any(Array),
      1,
    );
  });

  test("passes photo roles to gallery processing", async () => {
    const roles = ["front", "price_tag", "extra"] as const;
    await processCompetitorPhotos({
      images: [makeImage(), makeImage(), makeImage()],
      photoRoles: [...roles],
    });

    expect(mockedGallery).toHaveBeenCalledWith(
      expect.any(Array),
      [...roles],
      0,
    );
  });

  test("returns review_required when extract reports suspicious_content", async () => {
    mockedExtract.mockResolvedValueOnce({
      data: validExtractedData,
      suspicious_content: true,
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(result.status).toBe("review_required");
    expect(result.reviewReason).toBe("suspicious_content");
    expect(result.extractedData).toBeNull();
  });

  test("discards thumbnail when suspicious_content detected after parallel processing", async () => {
    mockedExtract.mockResolvedValueOnce({
      data: validExtractedData,
      suspicious_content: true,
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(mockedCreateThumb).toHaveBeenCalled();
    expect(result.thumbnailFull).toBeUndefined();
    expect(result.extractedData).toBeNull();
  });

  test("runs image ops in parallel, then extract sequentially with scanned EAN", async () => {
    const callOrder: string[] = [];
    mockedExtract.mockImplementation(async () => {
      callOrder.push("extract-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("extract-end");
      return validExtractionResult;
    });
    mockedCreateThumb.mockImplementation(async () => {
      callOrder.push("thumb-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("thumb-end");
      return validThumbnail;
    });
    mockedGallery.mockImplementation(async () => {
      callOrder.push("gallery-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("gallery-end");
      return [];
    });
    mockedScanBarcodes.mockImplementation(async () => {
      callOrder.push("barcode-start");
      return [null];
    });

    await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    // Phase 1: thumbnail, gallery, barcode run in parallel
    expect(callOrder).toContain("thumb-start");
    expect(callOrder).toContain("gallery-start");
    expect(callOrder).toContain("barcode-start");

    // Phase 2: extract starts AFTER phase 1 completes
    const extractIdx = callOrder.indexOf("extract-start");
    const thumbEndIdx = callOrder.indexOf("thumb-end");
    const galleryEndIdx = callOrder.indexOf("gallery-end");
    expect(extractIdx).toBeGreaterThan(thumbEndIdx);
    expect(extractIdx).toBeGreaterThan(galleryEndIdx);
  });

  test("uses scanned EAN over AI-extracted EAN", async () => {
    mockedScanBarcodes.mockResolvedValueOnce(["4001234567890"]);
    mockedExtract.mockResolvedValueOnce({
      data: { ...validExtractedData, ean_barcode: "0000000000000" },
      suspicious_content: false,
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(result.extractedData?.ean_barcode).toBe("4001234567890");
  });

  test("passes scanned EAN to extractProductInfo in fast path", async () => {
    mockedScanBarcodes.mockResolvedValueOnce(["4001234567890"]);

    await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(mockedExtract).toHaveBeenCalledWith(
      expect.any(Array),
      "4001234567890",
    );
  });

  test("falls back to legacy path when photoRoles length mismatches images", async () => {
    await processCompetitorPhotos({
      images: [makeImage(), makeImage()],
      photoRoles: ["front"],
    });

    expect(mockedClassify).toHaveBeenCalled();
  });

  test("returns classification as undefined in fast path", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(result.classification).toBeUndefined();
  });

  test("returns thumbnailType background_removed for successful bg removal", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(result.thumbnailType).toBe("background_removed");
  });

  test("returns thumbnailType soft_fallback when bg removal failed", async () => {
    mockedCreateThumb.mockResolvedValueOnce({
      ...validThumbnail,
      backgroundRemoved: false,
      backgroundRemovalFailed: true,
      backgroundProvider: "soft-fallback",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
      photoRoles: ["front"],
    });

    expect(result.backgroundRemovalFailed).toBe(true);
    expect(result.thumbnailType).toBe("soft_fallback");
  });
});
