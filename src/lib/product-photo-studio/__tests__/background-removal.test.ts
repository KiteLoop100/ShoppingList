import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

import { removeBackground } from "../background-removal";

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
  test("crop fallback returns oriented image without additional cropping", async () => {
    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.imageBuffer).toBeInstanceOf(Buffer);
    expect(result.imageBuffer.length).toBeGreaterThan(0);
    expect(result.hasTransparency).toBe(false);
    expect(result.providerUsed).toBe("crop-fallback");

    const meta = await sharp(result.imageBuffer).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
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
    expect(result.providerUsed).toBe("self-hosted");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/remove",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });
});
