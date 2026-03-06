import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("@/lib/api/photo-processing/image-utils", () => ({
  getProductBoundingBox: vi.fn(),
}));

import { getProductBoundingBox } from "@/lib/api/photo-processing/image-utils";
import { removeBackground } from "../background-removal";

const mockedGetBBox = vi.mocked(getProductBoundingBox);

async function makeTestBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REMOVE_BG_API_KEY;
  delete process.env.SELF_HOSTED_BG_REMOVAL_URL;
});

describe("removeBackground", () => {
  test("returns BackgroundRemovalResult with hasTransparency=false for crop fallback", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 10,
      crop_y: 10,
      crop_width: 100,
      crop_height: 100,
    });

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
    expect(result.hasTransparency).toBe(false);
    expect(mockedGetBBox).toHaveBeenCalled();
  });

  test("returns original when crop fallback finds no bounding box", async () => {
    mockedGetBBox.mockResolvedValueOnce(null);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
    expect(result.hasTransparency).toBe(false);
  });

  test("returns original when all providers fail", async () => {
    mockedGetBBox.mockRejectedValueOnce(new Error("Claude failed"));

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.hasTransparency).toBe(false);
  });

  test("self-hosted provider is checked first when URL is set", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const pngWithAlpha = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
    }).png().toBuffer();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(pngWithAlpha.buffer.slice(pngWithAlpha.byteOffset, pngWithAlpha.byteOffset + pngWithAlpha.byteLength)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.hasTransparency).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/remove",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });
});
