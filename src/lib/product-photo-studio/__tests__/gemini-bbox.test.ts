import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
  },
}));

vi.mock("@/lib/api/claude-client", () => ({
  callClaude: vi.fn(),
  parseClaudeJsonResponse: vi.fn((raw: string) => {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned);
  }),
}));

vi.mock("@/lib/api/config", () => ({
  CLAUDE_MODEL_SONNET: "claude-sonnet-test",
}));

import { callClaude } from "@/lib/api/claude-client";
import { geminiSmartPreCrop, claudeSmartPreCrop } from "../gemini-bbox";

const mockedCallClaude = vi.mocked(callClaude);

async function makeTestBuffer(width = 500, height = 800): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).jpeg().toBuffer();
}

function mockGeminiResponse(json: object) {
  mockGenerateContent.mockResolvedValue({
    text: JSON.stringify(json),
  });
}

describe("geminiSmartPreCrop", () => {
  const originalEnv = process.env.GOOGLE_GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GOOGLE_GEMINI_API_KEY = originalEnv;
  });

  test("returns null when API key is missing", async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY;
    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);
    expect(result).toBeNull();
  });

  test("parses valid bbox and returns pixel coordinates", async () => {
    mockGeminiResponse({
      bbox: { x: 100, y: 200, width: 600, height: 500 },
      rotation: 0,
      tilt: 0,
    });

    const buf = await makeTestBuffer(500, 800);
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.bbox.x).toBe(Math.round((100 / 1000) * 500));
    expect(result!.bbox.y).toBe(Math.round((200 / 1000) * 800));
    expect(result!.bbox.width).toBe(Math.round((600 / 1000) * 500));
    expect(result!.bbox.height).toBe(Math.round((500 / 1000) * 800));
    expect(result!.rotation).toBe(0);
    expect(result!.tilt).toBe(0);
  });

  test("returns rotation and tilt values when present", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 90,
      tilt: 2.5,
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.rotation).toBe(90);
    expect(result!.tilt).toBe(2.5);
  });

  test("sanitizes invalid rotation to 0", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 45,
      tilt: 0,
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.rotation).toBe(0);
  });

  test("clamps tilt exceeding ±15 range", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 0,
      tilt: 25.3,
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.tilt).toBe(15);
  });

  test("clamps negative tilt exceeding -15", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 0,
      tilt: -20,
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.tilt).toBe(-15);
  });

  test("returns null when bbox covers < 20% of image", async () => {
    mockGeminiResponse({
      bbox: { x: 0, y: 0, width: 100, height: 100 },
      rotation: 0,
      tilt: 0,
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).toBeNull();
  });

  test("returns null on API error", async () => {
    mockGenerateContent.mockRejectedValue(new Error("API error"));

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).toBeNull();
  });

  test("handles JSON wrapped in markdown fences", async () => {
    mockGenerateContent.mockResolvedValue({
      text: '```json\n{"bbox":{"x":100,"y":100,"width":800,"height":800},"rotation":0,"tilt":0}\n```',
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.bbox.width).toBeGreaterThan(0);
  });

  test("clamps bbox coordinates to image boundaries", async () => {
    mockGeminiResponse({
      bbox: { x: 900, y: 900, width: 200, height: 200 },
      rotation: 0,
      tilt: 0,
    });

    const buf = await makeTestBuffer(500, 800);
    const result = await geminiSmartPreCrop(buf);

    if (result) {
      expect(result.bbox.x + result.bbox.width).toBeLessThanOrEqual(500);
      expect(result.bbox.y + result.bbox.height).toBeLessThanOrEqual(800);
    }
  });

  test("handles non-finite tilt as 0", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 0,
      tilt: "NaN",
    });

    const buf = await makeTestBuffer();
    const result = await geminiSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.tilt).toBe(0);
  });

  test("uses price tag prompt when photoType is price_tag", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 0,
      tilt: 0,
    });

    const buf = await makeTestBuffer();
    await geminiSmartPreCrop(buf, "price_tag");

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[1].text;
    expect(promptText).toContain("price tag");
    expect(promptText).toContain("1% padding");
  });

  test("uses default product prompt when photoType is undefined", async () => {
    mockGeminiResponse({
      bbox: { x: 50, y: 50, width: 900, height: 900 },
      rotation: 0,
      tilt: 0,
    });

    const buf = await makeTestBuffer();
    await geminiSmartPreCrop(buf);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    const promptText = callArgs.contents[0].parts[1].text;
    expect(promptText).toContain("product photo");
    expect(promptText).toContain("3% padding");
  });
});

describe("claudeSmartPreCrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("parses percentage-based bbox and converts to pixels", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 10, y_pct: 20, w_pct: 60, h_pct: 50 },
      rotation: 0,
      tilt: 0,
    }));

    const buf = await makeTestBuffer(500, 800);
    const result = await claudeSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.bbox.x).toBe(Math.round(0.10 * 500));
    expect(result!.bbox.y).toBe(Math.round(0.20 * 800));
    expect(result!.bbox.width).toBe(Math.round(0.60 * 500));
    expect(result!.bbox.height).toBe(Math.round(0.50 * 800));
  });

  test("returns null when bbox is too small", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 0, y_pct: 0, w_pct: 5, h_pct: 5 },
      rotation: 0,
      tilt: 0,
    }));

    const buf = await makeTestBuffer();
    const result = await claudeSmartPreCrop(buf);

    expect(result).toBeNull();
  });

  test("returns rotation and tilt from Claude response", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
      rotation: 270,
      tilt: -3.5,
    }));

    const buf = await makeTestBuffer();
    const result = await claudeSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.rotation).toBe(270);
    expect(result!.tilt).toBe(-3.5);
  });

  test("returns null on Claude API error", async () => {
    mockedCallClaude.mockRejectedValue(new Error("Claude unavailable"));

    const buf = await makeTestBuffer();
    const result = await claudeSmartPreCrop(buf);

    expect(result).toBeNull();
  });

  test("sanitizes invalid rotation to 0", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
      rotation: 120,
      tilt: 0,
    }));

    const buf = await makeTestBuffer();
    const result = await claudeSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.rotation).toBe(0);
  });

  test("clamps tilt to ±15 range", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
      rotation: 0,
      tilt: -30,
    }));

    const buf = await makeTestBuffer();
    const result = await claudeSmartPreCrop(buf);

    expect(result).not.toBeNull();
    expect(result!.tilt).toBe(-15);
  });

  test("uses price tag prompt when photoType is price_tag", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
      rotation: 0,
      tilt: 0,
    }));

    const buf = await makeTestBuffer();
    await claudeSmartPreCrop(buf, "price_tag");

    const callArgs = mockedCallClaude.mock.calls[0][0] as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
    const promptText = callArgs.messages[0].content[1].text!;
    expect(promptText).toContain("price tag");
    expect(promptText).toContain("1% padding");
  });

  test("uses default product prompt when photoType is undefined", async () => {
    mockedCallClaude.mockResolvedValue(JSON.stringify({
      bbox: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
      rotation: 0,
      tilt: 0,
    }));

    const buf = await makeTestBuffer();
    await claudeSmartPreCrop(buf);

    const callArgs = mockedCallClaude.mock.calls[0][0] as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
    const promptText = callArgs.messages[0].content[1].text!;
    expect(promptText).toContain("product photo");
    expect(promptText).toContain("3% padding");
  });
});
