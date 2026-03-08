import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

import { removeBackground, hasSignificantTransparency } from "../background-removal";

async function makeTestBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Create a PNG with a product-like alpha: opaque center, transparent edges.
 * Approximately 50% transparent pixels.
 */
async function makeGoodBgRemovalResult(size = 100): Promise<Buffer> {
  const half = Math.floor(size / 2);
  const opaqueCenter = await sharp({
    create: { width: half, height: half, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: opaqueCenter, left: Math.floor(half / 2), top: Math.floor(half / 2) }])
    .png()
    .toBuffer();
}

/** Fully opaque PNG — simulates failed bg removal (no background removed). */
async function makeFullyOpaquePng(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();
}

/** Nearly fully transparent PNG — simulates over-removal. */
async function makeFullyTransparentPng(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REMOVE_BG_API_KEY;
  delete process.env.SELF_HOSTED_BG_REMOVAL_URL;
  delete process.env.REPLICATE_API_TOKEN;
  delete process.env.REPLICATE_BG_MODEL;
});

describe("hasSignificantTransparency", () => {
  test("returns true for image with reasonable transparency (product on transparent bg)", async () => {
    const good = await makeGoodBgRemovalResult();
    expect(await hasSignificantTransparency(good)).toBe(true);
  });

  test("returns false for fully opaque image (bg removal failed)", async () => {
    const opaque = await makeFullyOpaquePng();
    expect(await hasSignificantTransparency(opaque)).toBe(false);
  });

  test("returns false for nearly fully transparent image (over-removal)", async () => {
    const transparent = await makeFullyTransparentPng();
    expect(await hasSignificantTransparency(transparent)).toBe(false);
  });

  test("returns false for image without alpha channel", async () => {
    const noAlpha = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 100, g: 100, b: 100 } },
    }).png().toBuffer();
    expect(await hasSignificantTransparency(noAlpha)).toBe(false);
  });
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

  test("sets noProvidersConfigured when no real providers are available", async () => {
    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.providerUsed).toBe("crop-fallback");
    expect(result.noProvidersConfigured).toBe(true);
  });

  test("does not set noProvidersConfigured when providers fail", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.providerUsed).toBe("crop-fallback");
    expect(result.noProvidersConfigured).toBe(false);

    vi.unstubAllGlobals();
  });

  test("self-hosted provider is checked first when URL is set", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const goodResult = await makeGoodBgRemovalResult(50);

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(goodResult.buffer.slice(goodResult.byteOffset, goodResult.byteOffset + goodResult.byteLength)),
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

  test("replicate provider is tried when token is set", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";

    const goodResult = await makeGoodBgRemovalResult(50);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "succeeded",
          output: "https://replicate.delivery/test/output.png",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          goodResult.buffer.slice(goodResult.byteOffset, goodResult.byteOffset + goodResult.byteLength),
        ),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.hasTransparency).toBe(true);
    expect(result.providerUsed).toBe("replicate");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.replicate.com/v1/predictions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.version).toBe("lucataco/remove-bg");

    vi.unstubAllGlobals();
  });

  test("replicate provider falls through on API error", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve("invalid input"),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.providerUsed).toBe("crop-fallback");
    expect(result.noProvidersConfigured).toBe(false);

    vi.unstubAllGlobals();
  });

  test("replicate provider falls through on failed prediction", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: "failed",
        error: "model crashed",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.providerUsed).toBe("crop-fallback");
    expect(result.noProvidersConfigured).toBe(false);

    vi.unstubAllGlobals();
  });

  test("falls through to next provider when transparency validation fails", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const opaqueResult = await makeFullyOpaquePng(50);

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(opaqueResult.buffer.slice(opaqueResult.byteOffset, opaqueResult.byteOffset + opaqueResult.byteLength)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result.providerUsed).toBe("crop-fallback");
    expect(result.hasTransparency).toBe(false);

    vi.unstubAllGlobals();
  });

  test("uses custom Replicate model from env var", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    process.env.REPLICATE_BG_MODEL = "cjwbw/rembg";

    const goodResult = await makeGoodBgRemovalResult(50);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "succeeded",
          output: "https://replicate.delivery/test/output.png",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          goodResult.buffer.slice(goodResult.byteOffset, goodResult.byteOffset + goodResult.byteLength),
        ),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    await removeBackground(input);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.version).toBe("cjwbw/rembg");

    vi.unstubAllGlobals();
  });
});
