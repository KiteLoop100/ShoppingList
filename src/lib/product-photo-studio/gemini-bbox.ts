/**
 * Smart pre-crop via a single Gemini Flash call that returns
 * bounding box, cardinal rotation, and fine tilt in one shot.
 * Replaces three separate Claude calls (bbox/rotation/tilt).
 *
 * Fallback: consolidated Claude Sonnet call with the same output contract.
 */

import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { callClaude, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { log } from "@/lib/utils/logger";

export interface PreCropData {
  bbox: { x: number; y: number; width: number; height: number };
  rotation: 0 | 90 | 180 | 270;
  tilt: number;
}

const VALID_ROTATIONS = new Set([0, 90, 180, 270]);
const MIN_BBOX_AREA_RATIO = 0.20;
const MAX_TILT = 15;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 5_000;
const CLAUDE_TIMEOUT_MS = 8_000;

export type PreCropPhotoType = "price_tag";

const GEMINI_PROMPT_DEFAULT = `Analyze this product photo. Return ONLY a JSON object, no other text:
{
  "bbox": { "x": <left 0-1000>, "y": <top 0-1000>, "width": <0-1000>, "height": <0-1000> },
  "rotation": <0 | 90 | 180 | 270>,
  "tilt": <float -15.0 to 15.0>
}

bbox: Bounding box of the main product using normalized 0-1000 coordinates. Add 3% padding on each side.
rotation: Cardinal rotation to make product text readable left-to-right. 0 if already correct.
tilt: Fine rotation correction in degrees. Positive = clockwise needed. 0 if no tilt visible.`;

const GEMINI_PROMPT_PRICE_TAG = `Analyze this price tag photo. Return ONLY a JSON object, no other text:
{
  "bbox": { "x": <left 0-1000>, "y": <top 0-1000>, "width": <0-1000>, "height": <0-1000> },
  "rotation": <0 | 90 | 180 | 270>,
  "tilt": <float -15.0 to 15.0>
}

bbox: Find the price tag borders precisely. Use normalized 0-1000 coordinates. Add only 1% padding — crop tightly to the price tag edges.
rotation: Cardinal rotation to make price tag text readable left-to-right. 0 if already correct.
tilt: Fine rotation correction in degrees. Positive = clockwise needed. 0 if no tilt visible.`;

const CLAUDE_PROMPT_DEFAULT = `Analyze this product photo. Return ONLY a JSON object:
{
  "bbox": { "x_pct": <0-100>, "y_pct": <0-100>, "w_pct": <0-100>, "h_pct": <0-100> },
  "rotation": <0 | 90 | 180 | 270>,
  "tilt": <float -15.0 to 15.0>
}

bbox: Bounding box as percentage of image dimensions. Add 3% padding.
rotation: Cardinal rotation to make text readable. 0 if correct.
tilt: Fine rotation correction. 0 if none needed.`;

const CLAUDE_PROMPT_PRICE_TAG = `Analyze this price tag photo. Return ONLY a JSON object:
{
  "bbox": { "x_pct": <0-100>, "y_pct": <0-100>, "w_pct": <0-100>, "h_pct": <0-100> },
  "rotation": <0 | 90 | 180 | 270>,
  "tilt": <float -15.0 to 15.0>
}

bbox: Find the price tag borders precisely as percentage of image dimensions. Add only 1% padding — crop tightly to the price tag edges.
rotation: Cardinal rotation to make price tag text readable. 0 if correct.
tilt: Fine rotation correction. 0 if none needed.`;

interface GeminiRawResponse {
  bbox?: { x?: number; y?: number; width?: number; height?: number };
  rotation?: number;
  tilt?: number;
}

interface ClaudeRawResponse {
  bbox?: { x_pct?: number; y_pct?: number; w_pct?: number; h_pct?: number };
  rotation?: number;
  tilt?: number;
}

function extractJsonFromText(text: string): string {
  const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match?.[0] ?? cleaned;
}

function sanitizeRotation(raw: unknown): 0 | 90 | 180 | 270 {
  const n = Number(raw);
  return VALID_ROTATIONS.has(n) ? (n as 0 | 90 | 180 | 270) : 0;
}

function sanitizeTilt(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, n));
  return Math.round(clamped * 10) / 10;
}

function validateBboxArea(
  bboxPixels: { x: number; y: number; width: number; height: number },
  imgWidth: number,
  imgHeight: number,
): boolean {
  const bboxArea = bboxPixels.width * bboxPixels.height;
  const imgArea = imgWidth * imgHeight;
  if (imgArea === 0) return false;
  return bboxArea / imgArea >= MIN_BBOX_AREA_RATIO;
}

/**
 * Single Gemini Flash call that detects bbox (0-1000 coords), rotation, and tilt.
 * Returns null on any failure — never throws.
 */
export async function geminiSmartPreCrop(
  imageBuffer: Buffer,
  photoType?: PreCropPhotoType,
): Promise<PreCropData | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    log.warn("[gemini-bbox] GOOGLE_GEMINI_API_KEY not configured, skipping");
    return null;
  }

  try {
    const { width: imgW = 0, height: imgH = 0 } = await sharp(imageBuffer).metadata();
    if (!imgW || !imgH) return null;

    const ai = new GoogleGenAI({ apiKey });
    const base64 = imageBuffer.toString("base64");
    const prompt = photoType === "price_tag" ? GEMINI_PROMPT_PRICE_TAG : GEMINI_PROMPT_DEFAULT;

    const response = await Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
            { text: prompt },
          ],
        }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), GEMINI_TIMEOUT_MS),
      ),
    ]);

    const text = response.text?.trim() ?? "";
    const jsonStr = extractJsonFromText(text);
    const parsed: GeminiRawResponse = JSON.parse(jsonStr);

    const rawX = Number(parsed.bbox?.x) || 0;
    const rawY = Number(parsed.bbox?.y) || 0;
    const rawW = Number(parsed.bbox?.width) || 0;
    const rawH = Number(parsed.bbox?.height) || 0;

    const bbox = {
      x: Math.max(0, Math.round((rawX / 1000) * imgW)),
      y: Math.max(0, Math.round((rawY / 1000) * imgH)),
      width: Math.max(1, Math.round((rawW / 1000) * imgW)),
      height: Math.max(1, Math.round((rawH / 1000) * imgH)),
    };

    bbox.width = Math.min(bbox.width, imgW - bbox.x);
    bbox.height = Math.min(bbox.height, imgH - bbox.y);

    if (!validateBboxArea(bbox, imgW, imgH)) {
      log.warn("[gemini-bbox] bbox too small:",
        ((bbox.width * bbox.height) / (imgW * imgH) * 100).toFixed(1) + "% of image");
      return null;
    }

    const rotation = sanitizeRotation(parsed.rotation);
    const tilt = sanitizeTilt(parsed.tilt);

    log.debug("[gemini-bbox] success: bbox",
      `${bbox.width}x${bbox.height}+${bbox.x}+${bbox.y}`,
      "rotation", rotation, "tilt", tilt);

    return { bbox, rotation, tilt };
  } catch (err) {
    log.warn("[gemini-bbox] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Consolidated Claude Sonnet fallback — one call for bbox + rotation + tilt.
 * Uses percentage-based bbox coordinates. Returns null on any failure.
 */
export async function claudeSmartPreCrop(
  imageBuffer: Buffer,
  photoType?: PreCropPhotoType,
): Promise<PreCropData | null> {
  try {
    const { width: imgW = 0, height: imgH = 0 } = await sharp(imageBuffer).metadata();
    if (!imgW || !imgH) return null;

    const base64 = imageBuffer.toString("base64");
    const prompt = photoType === "price_tag" ? CLAUDE_PROMPT_PRICE_TAG : CLAUDE_PROMPT_DEFAULT;

    const rawText = await Promise.race([
      callClaude({
        model: CLAUDE_MODEL_SONNET,
        max_tokens: 256,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Claude pre-crop timeout")), CLAUDE_TIMEOUT_MS),
      ),
    ]);

    const jsonStr = extractJsonFromText(rawText);
    const parsed: ClaudeRawResponse = parseClaudeJsonResponse(jsonStr);

    const xPct = Number(parsed.bbox?.x_pct) || 0;
    const yPct = Number(parsed.bbox?.y_pct) || 0;
    const wPct = Number(parsed.bbox?.w_pct) || 0;
    const hPct = Number(parsed.bbox?.h_pct) || 0;

    const bbox = {
      x: Math.max(0, Math.round((xPct / 100) * imgW)),
      y: Math.max(0, Math.round((yPct / 100) * imgH)),
      width: Math.max(1, Math.round((wPct / 100) * imgW)),
      height: Math.max(1, Math.round((hPct / 100) * imgH)),
    };

    bbox.width = Math.min(bbox.width, imgW - bbox.x);
    bbox.height = Math.min(bbox.height, imgH - bbox.y);

    if (!validateBboxArea(bbox, imgW, imgH)) {
      log.warn("[claude-bbox] bbox too small:",
        ((bbox.width * bbox.height) / (imgW * imgH) * 100).toFixed(1) + "% of image");
      return null;
    }

    const rotation = sanitizeRotation(parsed.rotation);
    const tilt = sanitizeTilt(parsed.tilt);

    log.debug("[claude-bbox] success: bbox",
      `${bbox.width}x${bbox.height}+${bbox.x}+${bbox.y}`,
      "rotation", rotation, "tilt", tilt);

    return { bbox, rotation, tilt };
  } catch (err) {
    log.warn("[claude-bbox] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
