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
});

describe("removeBackground", () => {
  test("uses crop fallback when no REMOVE_BG_API_KEY", async () => {
    mockedGetBBox.mockResolvedValueOnce({
      crop_x: 10,
      crop_y: 10,
      crop_width: 100,
      crop_height: 100,
    });

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
    expect(mockedGetBBox).toHaveBeenCalled();
  });

  test("returns original when crop fallback finds no bounding box", async () => {
    mockedGetBBox.mockResolvedValueOnce(null);

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns original when all providers fail", async () => {
    mockedGetBBox.mockRejectedValueOnce(new Error("Claude failed"));

    const input = await makeTestBuffer();
    const result = await removeBackground(input);

    expect(result).toBeInstanceOf(Buffer);
  });
});
