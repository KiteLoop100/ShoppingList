import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PhotoInput } from "../types";

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

vi.mock("../verify-quality", () => ({
  verifyThumbnailQuality: vi.fn(),
}));

import { classifyPhotos } from "../validate-classify";
import { extractProductInfo, scanBarcodesFromAll } from "../extract-product-info";
import { createThumbnail } from "../create-thumbnail";
import { verifyThumbnailQuality } from "../verify-quality";
import { processCompetitorPhotos } from "../pipeline";

const mockedClassify = vi.mocked(classifyPhotos);
const mockedExtract = vi.mocked(extractProductInfo);
const mockedScanBarcodes = vi.mocked(scanBarcodesFromAll);
const mockedCreateThumb = vi.mocked(createThumbnail);
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

const validExtraction = {
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
  mockedExtract.mockResolvedValue(validExtraction);
  mockedCreateThumb.mockResolvedValue(validThumbnail);
  mockedVerify.mockResolvedValue(approvedVerification);
});

describe("processCompetitorPhotos", () => {
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

  test("returns review_required when suspicious content detected", async () => {
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

  test("returns success even when thumbnail QA recommends reject (has thumbnail + data)", async () => {
    mockedVerify.mockResolvedValueOnce({
      passes_quality_check: false,
      quality_score: 0.2,
      issues: ["Blurry"],
      recommendation: "reject",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("success");
    expect(result.extractedData).not.toBeNull();
    expect(result.thumbnailFull).toBeDefined();
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

  test("includes backgroundRemovalFailed in result", async () => {
    mockedCreateThumb.mockResolvedValueOnce({
      ...validThumbnail,
      backgroundRemovalFailed: true,
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.backgroundRemovalFailed).toBe(true);
    expect(result.status).toBe("success");
  });

  test("returns thumbnailType background_removed for successful bg removal", async () => {
    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.thumbnailType).toBe("background_removed");
  });

  test("returns success even when verification recommends review", async () => {
    mockedVerify.mockResolvedValueOnce({
      passes_quality_check: false,
      quality_score: 0.6,
      issues: ["Minor issue"],
      recommendation: "review",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.status).toBe("success");
  });

  test("uses scanned EAN over AI-extracted EAN", async () => {
    mockedScanBarcodes.mockResolvedValueOnce(["4001234567890"]);
    mockedExtract.mockResolvedValueOnce({
      ...validExtraction,
      ean_barcode: "0000000000000",
    });

    const result = await processCompetitorPhotos({
      images: [makeImage()],
    });

    expect(result.extractedData?.ean_barcode).toBe("4001234567890");
  });

  test("runs extraction and thumbnail creation in parallel", async () => {
    const callOrder: string[] = [];
    mockedExtract.mockImplementation(async () => {
      callOrder.push("extract-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("extract-end");
      return validExtraction;
    });
    mockedCreateThumb.mockImplementation(async () => {
      callOrder.push("thumb-start");
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push("thumb-end");
      return validThumbnail;
    });

    await processCompetitorPhotos({ images: [makeImage()] });

    expect(callOrder[0]).toBe("extract-start");
    expect(callOrder[1]).toBe("thumb-start");
  });
});
