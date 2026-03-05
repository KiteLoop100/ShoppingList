import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

import { callClaudeJSON } from "@/lib/api/claude-client";
import { verifyThumbnailQuality } from "../verify-quality";

const mockedCallClaude = vi.mocked(callClaudeJSON);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyThumbnailQuality", () => {
  test("returns approval for high-quality thumbnail", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: true,
      quality_score: 0.92,
      issues: [],
      recommendation: "approve",
    });

    const result = await verifyThumbnailQuality(Buffer.from("fake-jpeg"));

    expect(result.passes_quality_check).toBe(true);
    expect(result.quality_score).toBe(0.92);
    expect(result.issues).toEqual([]);
    expect(result.recommendation).toBe("approve");
  });

  test("returns rejection with issues", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: false,
      quality_score: 0.3,
      issues: ["Blurry image", "Background artifacts"],
      recommendation: "reject",
    });

    const result = await verifyThumbnailQuality(Buffer.from("fake-jpeg"));

    expect(result.passes_quality_check).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.recommendation).toBe("reject");
  });

  test("falls back to review on API error", async () => {
    mockedCallClaude.mockRejectedValueOnce(new Error("API timeout"));

    const result = await verifyThumbnailQuality(Buffer.from("fake-jpeg"));

    expect(result.passes_quality_check).toBe(false);
    expect(result.recommendation).toBe("review");
    expect(result.issues).toContain("Verification failed due to an error");
  });

  test("defaults invalid recommendation to review", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: true,
      quality_score: 0.7,
      issues: [],
      recommendation: "invalid_value",
    });

    const result = await verifyThumbnailQuality(Buffer.from("fake-jpeg"));
    expect(result.recommendation).toBe("review");
  });

  test("handles missing fields with defaults", async () => {
    mockedCallClaude.mockResolvedValueOnce({});

    const result = await verifyThumbnailQuality(Buffer.from("fake-jpeg"));

    expect(result.passes_quality_check).toBe(true);
    expect(result.quality_score).toBe(0.5);
    expect(result.issues).toEqual([]);
    expect(result.recommendation).toBe("review");
  });
});
