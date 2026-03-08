import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("../edge-quality", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../edge-quality")>();
  return {
    ...actual,
    calculateEdgeQualityScore: vi.fn().mockImplementation(actual.calculateEdgeQualityScore),
  };
});

import { removeBackground, hasSignificantTransparency } from "../background-removal";
import { calculateEdgeQualityScore } from "../edge-quality";

const mockedEdgeQuality = vi.mocked(calculateEdgeQualityScore);

async function makeTestBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

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

async function makeFullyOpaquePng(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 255 } },
  }).png().toBuffer();
}

async function makeFullyTransparentPng(size = 100): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
}


function mockEdgeQualityAccept() {
  mockedEdgeQuality.mockResolvedValueOnce({
    score: 0.8, transparencyRatio: 0.5, haloScore: 0.9, edgeSmoothness: 0.7,
    isValid: true, recommendation: "accept",
    diagnostics: { nearWhiteEdgePixelRatio: 0.05, perimeterAreaRatio: 0.6 },
  });
}

function mockEdgeQualityRetry() {
  mockedEdgeQuality.mockResolvedValueOnce({
    score: 0.5, transparencyRatio: 0.5, haloScore: 0.2, edgeSmoothness: 0.1,
    isValid: false, recommendation: "retry",
    diagnostics: { nearWhiteEdgePixelRatio: 0.35, perimeterAreaRatio: 0.1 },
  });
}

function mockEdgeQualityFallback() {
  mockedEdgeQuality.mockResolvedValueOnce({
    score: 0.2, transparencyRatio: 0.01, haloScore: 0.3, edgeSmoothness: 0.2,
    isValid: false, recommendation: "fallback",
    diagnostics: { nearWhiteEdgePixelRatio: 0.5, perimeterAreaRatio: 0.2 },
  });
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
  test("returns null when no providers are configured", async () => {
    const input = await makeTestBuffer();
    const result = await removeBackground(input);
    expect(result).toBeNull();
  });

  test("self-hosted provider is checked first when URL is set", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const goodResult = await makeGoodBgRemovalResult(50);
    mockEdgeQualityAccept();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(goodResult.buffer.slice(goodResult.byteOffset, goodResult.byteOffset + goodResult.byteLength)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).not.toBeNull();
    expect(result!.hasTransparency).toBe(true);
    expect(result!.providerUsed).toBe("self-hosted");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:5000/remove",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });

  test("falls to remove.bg when self-hosted recommends retry", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";
    process.env.REMOVE_BG_API_KEY = "test-key";

    const anyPng = await makeGoodBgRemovalResult(50);
    mockEdgeQualityRetry();
    mockEdgeQualityAccept();

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).not.toBeNull();
    expect(result!.providerUsed).toBe("remove.bg");
    expect(result!.hasTransparency).toBe(true);

    vi.unstubAllGlobals();
  });

  test("falls to replicate when self-hosted and remove.bg both recommend retry", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";
    process.env.REMOVE_BG_API_KEY = "test-key";
    process.env.REPLICATE_API_TOKEN = "test-token";

    const anyPng = await makeGoodBgRemovalResult(50);
    mockEdgeQualityRetry();
    mockEdgeQualityRetry();
    mockEdgeQualityAccept();

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ latest_version: { id: "abc123def456" } }),
      })
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
          anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength),
        ),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).not.toBeNull();
    expect(result!.providerUsed).toBe("replicate");
    expect(result!.hasTransparency).toBe(true);

    vi.unstubAllGlobals();
  });

  test("returns null immediately when provider recommends fallback", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";
    process.env.REMOVE_BG_API_KEY = "test-key";

    const anyPng = await makeGoodBgRemovalResult(50);
    mockEdgeQualityFallback();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  test("returns null when all providers recommend retry but none accept", async () => {
    process.env.SELF_HOSTED_BG_REMOVAL_URL = "http://localhost:5000/remove";

    const anyPng = await makeGoodBgRemovalResult(50);
    mockEdgeQualityRetry();

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(anyPng.buffer.slice(anyPng.byteOffset, anyPng.byteOffset + anyPng.byteLength)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });

  test("replicate provider is tried when token is set", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    process.env.REPLICATE_BG_MODEL = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

    const goodResult = await makeGoodBgRemovalResult(50);
    mockEdgeQualityAccept();

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

    expect(result).not.toBeNull();
    expect(result!.hasTransparency).toBe(true);
    expect(result!.providerUsed).toBe("replicate");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.replicate.com/v1/predictions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );

    vi.unstubAllGlobals();
  });

  test("replicate provider falls through on API error", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ latest_version: { id: "abc123" } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve("invalid input"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });

  test("replicate provider falls through on failed prediction", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ latest_version: { id: "abc123" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "failed",
          error: "model crashed",
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeNull();

    vi.unstubAllGlobals();
  });

  test("uses custom Replicate model from env var", async () => {
    process.env.REPLICATE_API_TOKEN = "test-token";
    process.env.REPLICATE_BG_MODEL = "cjwbw/rembg";

    const goodResult = await makeGoodBgRemovalResult(50);
    mockEdgeQualityAccept();

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ latest_version: { id: "custom-version-hash" } }),
      })
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

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("api.replicate.com/v1/models/cjwbw/rembg"),
      expect.anything(),
    );
    const predictionBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(predictionBody.version).toBe("custom-version-hash");

    vi.unstubAllGlobals();
  });
});
