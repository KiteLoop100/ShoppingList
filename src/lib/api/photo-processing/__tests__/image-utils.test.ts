import { describe, test, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

vi.mock("@/lib/api/claude-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/claude-client")>();
  return {
    ...actual,
    callClaude: vi.fn(),
    callClaudeJSON: vi.fn(),
  };
});

import { callClaude, callClaudeJSON } from "@/lib/api/claude-client";
import { getProductBoundingBox, detectTextRotation, detectTiltCorrection, makeThumbnail } from "../image-utils";

const mockedCallClaudeJSON = vi.mocked(callClaudeJSON);
const mockedCallClaude = vi.mocked(callClaude);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProductBoundingBox", () => {
  test("returns crop region when coordinates are within bounds", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 50,
      crop_y: 100,
      crop_width: 400,
      crop_height: 600,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).toEqual({ crop_x: 50, crop_y: 100, crop_width: 400, crop_height: 600 });
  });

  test("clamps crop_width when it exceeds right image boundary", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 100,
      crop_y: 0,
      crop_width: 450,
      crop_height: 300,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 400);

    expect(result).not.toBeNull();
    expect(result!.crop_x + result!.crop_width).toBeLessThanOrEqual(500);
    expect(result!.crop_width).toBe(400);
  });

  test("clamps crop_height when it exceeds bottom image boundary (tall product like Maggi bottle)", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 100,
      crop_y: 10,
      crop_width: 800,
      crop_height: 1595,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 1000, 1600);

    expect(result).not.toBeNull();
    expect(result!.crop_y + result!.crop_height).toBeLessThanOrEqual(1600);
    expect(result!.crop_height).toBe(1590);
  });

  test("returns null when clamped bbox is too small", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 490,
      crop_y: 790,
      crop_width: 200,
      crop_height: 200,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).toBeNull();
  });

  test("returns null when Claude throws", async () => {
    mockedCallClaudeJSON.mockRejectedValueOnce(new Error("API error"));

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 800);

    expect(result).toBeNull();
  });

  test("returns null when bbox covers > 98% of image area", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 0,
      crop_y: 0,
      crop_width: 800,
      crop_height: 600,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 800, 600);

    expect(result).toBeNull();
  });

  test("returns null when bbox is too small (< 5% of image area)", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 0,
      crop_y: 0,
      crop_width: 10,
      crop_height: 10,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 800, 600);

    expect(result).toBeNull();
  });

  test("floors float values from Claude", async () => {
    mockedCallClaudeJSON.mockResolvedValueOnce({
      crop_x: 10.7,
      crop_y: 20.3,
      crop_width: 300.9,
      crop_height: 400.1,
    });

    const result = await getProductBoundingBox("base64data", "image/jpeg", 500, 600);

    expect(result).toEqual({ crop_x: 10, crop_y: 20, crop_width: 300, crop_height: 400 });
  });
});

describe("detectTextRotation", () => {
  test("returns 0 when first letter is on the left (horizontal text)", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Milka","first_letter_position":"left"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("returns 90 when first letter is at bottom (text runs upward)", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Toppits","first_letter_position":"bottom"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(90);
  });

  test("returns 270 when first letter is at top (text runs downward)", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Maggi","first_letter_position":"top"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(270);
  });

  test("returns 180 when first letter is on the right (upside-down text)", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Nivea","first_letter_position":"right"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(180);
  });

  test("defaults to 0 when position is unrecognized", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Test","first_letter_position":"center"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("defaults to 0 when field is missing", async () => {
    mockedCallClaude.mockResolvedValueOnce('{}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("returns 0 when Claude throws", async () => {
    mockedCallClaude.mockRejectedValueOnce(new Error("API error"));

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("handles case-insensitive position values", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"brand_name":"Toppits","first_letter_position":"BOTTOM"}');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(90);
  });

  test("handles JSON wrapped in markdown fences", async () => {
    mockedCallClaude.mockResolvedValueOnce('```json\n{"brand_name":"Toppits","first_letter_position":"bottom"}\n```');

    const result = await detectTextRotation("base64data", "image/jpeg");

    expect(result).toBe(90);
  });
});

describe("detectTiltCorrection", () => {
  test("returns 0 when text is perfectly horizontal", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":0}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("returns positive tilt for clockwise deviation", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":3.5}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(3.5);
  });

  test("returns negative tilt for counter-clockwise deviation", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":-2.3}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(-2.3);
  });

  test("clamps tilt to ±15 degrees", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":30}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(15);
  });

  test("clamps negative tilt to ±15 degrees", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":-25}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(-15);
  });

  test("defaults to 0 when field is missing", async () => {
    mockedCallClaude.mockResolvedValueOnce('{}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("returns 0 when Claude throws", async () => {
    mockedCallClaude.mockRejectedValueOnce(new Error("API error"));

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(0);
  });

  test("rounds to 1 decimal place", async () => {
    mockedCallClaude.mockResolvedValueOnce('{"tilt_degrees":2.567}');

    const result = await detectTiltCorrection("base64data", "image/jpeg");

    expect(result).toBe(2.6);
  });
});

describe("makeThumbnail", () => {
  test("preserves full product in 150×150 without cropping (tall image like Maggi bottle)", async () => {
    const tallImage = await sharp({
      create: { width: 200, height: 800, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(tallImage);
    const meta = await sharp(result).metadata();

    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
  });

  test("produces JPEG output", async () => {
    const img = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 128, b: 0 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(img);
    const meta = await sharp(result).metadata();

    expect(meta.format).toBe("jpeg");
  });

  test("contain-fits wide image without cropping", async () => {
    const wideImage = await sharp({
      create: { width: 800, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).jpeg().toBuffer();

    const result = await makeThumbnail(wideImage);
    const meta = await sharp(result).metadata();

    expect(meta.width).toBe(150);
    expect(meta.height).toBe(150);
  });
});
