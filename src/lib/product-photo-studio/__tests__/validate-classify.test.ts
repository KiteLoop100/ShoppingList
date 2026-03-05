import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PhotoInput } from "../types";

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

import { callClaudeJSON } from "@/lib/api/claude-client";
import { classifyPhotos } from "../validate-classify";

const mockedCallClaude = vi.mocked(callClaudeJSON);

function makeTestImage(): PhotoInput {
  return {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    mediaType: "image/jpeg",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyPhotos", () => {
  test("returns classification for a valid product photo", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: true,
          photo_type: "product_front",
          confidence: 0.95,
          rejection_reason: null,
          quality_score: 0.9,
          has_reflections: false,
          text_readable: true,
        },
      ],
      all_same_product: true,
      suspicious_content: false,
      overall_assessment: "Valid product photo",
    });

    const result = await classifyPhotos([makeTestImage()]);

    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].is_product_photo).toBe(true);
    expect(result.photos[0].photo_type).toBe("product_front");
    expect(result.all_same_product).toBe(true);
    expect(result.suspicious_content).toBe(false);
  });

  test("flags non-product photos with rejection reason", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: false,
          photo_type: "other",
          confidence: 0.92,
          rejection_reason: "selfie",
          quality_score: 0,
          has_reflections: false,
          text_readable: false,
        },
      ],
      all_same_product: false,
      suspicious_content: true,
      overall_assessment: "Not a product photo",
    });

    const result = await classifyPhotos([makeTestImage()]);

    expect(result.photos[0].is_product_photo).toBe(false);
    expect(result.photos[0].rejection_reason).toBe("selfie");
    expect(result.suspicious_content).toBe(true);
  });

  test("handles mixed batch with valid and invalid photos", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      photos: [
        {
          photo_index: 0,
          is_product_photo: true,
          photo_type: "product_front",
          confidence: 0.95,
          rejection_reason: null,
          quality_score: 0.85,
          has_reflections: false,
          text_readable: true,
        },
        {
          photo_index: 1,
          is_product_photo: false,
          photo_type: "other",
          confidence: 0.88,
          rejection_reason: "screenshot",
          quality_score: 0,
          has_reflections: false,
          text_readable: false,
        },
      ],
      all_same_product: false,
      suspicious_content: false,
      overall_assessment: "Mixed batch",
    });

    const result = await classifyPhotos([makeTestImage(), makeTestImage()]);

    expect(result.photos).toHaveLength(2);
    const rejected = result.photos.filter((p) => !p.is_product_photo);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].rejection_reason).toBe("screenshot");
  });

  test("sanitizes missing fields with defaults", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      photos: [{ photo_index: 0, is_product_photo: true }],
      all_same_product: true,
    });

    const result = await classifyPhotos([makeTestImage()]);

    expect(result.photos[0].photo_type).toBe("other");
    expect(result.photos[0].confidence).toBe(0);
    expect(result.photos[0].quality_score).toBe(0);
    expect(result.photos[0].text_readable).toBe(true);
    expect(result.suspicious_content).toBe(false);
  });

  test("propagates API errors", async () => {
    mockedCallClaude.mockRejectedValueOnce(new Error("API timeout"));

    await expect(classifyPhotos([makeTestImage()])).rejects.toThrow(
      "API timeout",
    );
  });
});
