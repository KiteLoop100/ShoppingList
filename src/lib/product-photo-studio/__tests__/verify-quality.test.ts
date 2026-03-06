import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

import { callClaudeJSON } from "@/lib/api/claude-client";
import { verifyThumbnailQuality } from "../verify-quality";

const mockedCallClaude = vi.mocked(callClaudeJSON);

async function makeTestBuffer(
  color = { r: 100, g: 150, b: 200 },
): Promise<Buffer> {
  return sharp({
    create: { width: 50, height: 50, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

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

    const buf = await makeTestBuffer();
    const result = await verifyThumbnailQuality(buf, "image/jpeg");

    expect(result.passes_quality_check).toBe(true);
    expect(result.quality_score).toBe(0.92);
    expect(result.recommendation).toBe("approve");
  });

  test("returns rejection with issues", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: false,
      quality_score: 0.3,
      issues: ["Blurry image", "Background artifacts"],
      recommendation: "reject",
    });

    const buf = await makeTestBuffer();
    const result = await verifyThumbnailQuality(buf, "image/jpeg");

    expect(result.passes_quality_check).toBe(false);
    expect(result.issues).toContain("Blurry image");
    expect(result.recommendation).toBe("reject");
  });

  test("falls back to review on API error", async () => {
    mockedCallClaude.mockRejectedValueOnce(new Error("API timeout"));

    const buf = await makeTestBuffer();
    const result = await verifyThumbnailQuality(buf, "image/jpeg");

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

    const buf = await makeTestBuffer();
    const result = await verifyThumbnailQuality(buf, "image/jpeg");
    expect(result.recommendation).toBe("review");
  });

  test("handles missing fields with defaults", async () => {
    mockedCallClaude.mockResolvedValueOnce({});

    const buf = await makeTestBuffer();
    const result = await verifyThumbnailQuality(buf, "image/jpeg");

    expect(result.passes_quality_check).toBe(true);
    expect(result.quality_score).toBe(0.5);
    expect(result.recommendation).toBe("review");
  });

  test("detects highlight clipping in overexposed images", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: true,
      quality_score: 0.8,
      issues: [],
      recommendation: "approve",
    });

    const overexposed = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).jpeg().toBuffer();

    const result = await verifyThumbnailQuality(overexposed, "image/jpeg");

    const highlightIssue = result.issues.find((i) => i.includes("Highlight clipping"));
    expect(highlightIssue).toBeDefined();
  });

  test("does not flag highlight for normal images", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: true,
      quality_score: 0.9,
      issues: [],
      recommendation: "approve",
    });

    const normal = await makeTestBuffer({ r: 100, g: 100, b: 100 });
    const result = await verifyThumbnailQuality(normal, "image/jpeg");

    const highlightIssue = result.issues.find((i) => i.includes("Highlight clipping"));
    expect(highlightIssue).toBeUndefined();
  });

  test("passes correct media type to Claude", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      passes_quality_check: true,
      quality_score: 0.9,
      issues: [],
      recommendation: "approve",
    });

    const buf = await makeTestBuffer();
    await verifyThumbnailQuality(buf, "image/webp");

    const callArgs = mockedCallClaude.mock.calls[0][0];
    const imageContent = (callArgs as { messages: Array<{ content: Array<{ type: string; source?: { media_type: string } }> }> })
      .messages[0].content[0];
    expect(imageContent.source?.media_type).toBe("image/webp");
  });
});
