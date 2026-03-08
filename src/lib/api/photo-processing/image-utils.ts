/**
 * Image preprocessing and thumbnail generation for photo processing (BL-31).
 */

import sharp from "sharp";
import { callClaude, callClaudeJSON, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_HAIKU, CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { CROP_PROMPT, ROTATION_PROMPT, TILT_PROMPT } from "./prompts";
import { log } from "@/lib/utils/logger";

export interface PreprocessedImage {
  imageBase64: string;
  mediaType: string;
  imageBuffer: Buffer | null;
  isPdf: boolean;
  pdfBuf: ArrayBuffer | null;
}

export async function fetchAndPreprocessImage(
  photoUrl: string,
  isPdfHint?: boolean,
): Promise<PreprocessedImage> {
  const imageRes = await fetch(photoUrl);
  if (!imageRes.ok) throw new Error(`Fetch: ${imageRes.status}`);
  const buf = await imageRes.arrayBuffer();
  const mediaType =
    imageRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const isPdfContent = mediaType === "application/pdf" || isPdfHint === true;

  if (isPdfContent) {
    const sizeMB = (buf.byteLength / (1024 * 1024)).toFixed(1);
    log.debug("[process-photo] PDF size:", sizeMB, "MB");
    if (mediaType === "application/pdf" && !isPdfHint) {
      log.debug("[process-photo] Detected PDF from content-type, processing as flyer");
    }
    return {
      imageBase64: Buffer.from(buf).toString("base64"),
      mediaType,
      imageBuffer: null,
      isPdf: true,
      pdfBuf: buf,
    };
  }

  const imageBuffer = Buffer.from(buf);
  const resized = await sharp(imageBuffer)
    .rotate()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return {
    imageBase64: resized.toString("base64"),
    mediaType: "image/jpeg",
    imageBuffer: resized,
    isPdf: false,
    pdfBuf: null,
  };
}

/** EXIF rotate + contain-fit to 150×150 on white background (no cropping). */
export async function makeThumbnail(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize(150, 150, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export interface CropRegion {
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

export type RotationDegrees = number;

const MIN_BBOX_AREA_RATIO = 0.05;
const MAX_BBOX_AREA_RATIO = 0.98;

/**
 * @deprecated Use `geminiSmartPreCrop()` or `claudeSmartPreCrop()` from `gemini-bbox.ts` instead.
 * Kept for `generateFrontThumbnailBuffer()` compatibility.
 */
export async function getProductBoundingBox(
  imageBase64: string,
  mediaType: string,
  imageWidth: number,
  imageHeight: number,
): Promise<CropRegion | null> {
  try {
    const prompt = `${CROP_PROMPT}\n\nThe image is ${imageWidth} x ${imageHeight} pixels.`;
    const parsed = await callClaudeJSON<{
      crop_x?: number;
      crop_y?: number;
      crop_width?: number;
      crop_height?: number;
    }>({
      model: CLAUDE_MODEL_HAIKU,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const raw_x = Math.max(0, Math.floor(Number(parsed.crop_x) ?? 0));
    const raw_y = Math.max(0, Math.floor(Number(parsed.crop_y) ?? 0));
    const raw_w = Math.max(1, Math.floor(Number(parsed.crop_width) ?? 0));
    const raw_h = Math.max(1, Math.floor(Number(parsed.crop_height) ?? 0));
    const crop_x = Math.min(raw_x, imageWidth - 1);
    const crop_y = Math.min(raw_y, imageHeight - 1);
    const crop_width = Math.min(raw_w, imageWidth - crop_x);
    const crop_height = Math.min(raw_h, imageHeight - crop_y);

    if (crop_width < 1 || crop_height < 1) return null;

    const imageArea = imageWidth * imageHeight;
    const bboxArea = crop_width * crop_height;
    const ratio = bboxArea / imageArea;

    if (ratio < MIN_BBOX_AREA_RATIO) {
      log.warn("[image-utils] bbox too small:", (ratio * 100).toFixed(1) + "% of image, ignoring");
      return null;
    }
    if (ratio > MAX_BBOX_AREA_RATIO) {
      log.debug("[image-utils] bbox covers", (ratio * 100).toFixed(1) + "% of image, skipping crop");
      return null;
    }

    return { crop_x, crop_y, crop_width, crop_height };
  } catch (err) {
    log.warn("[image-utils] bbox detection failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Dedicated text rotation detection via Claude.
 * Uses a focused prompt that only asks about text direction,
 * which is significantly more reliable than combining it with bbox detection.
 */
const POSITION_TO_CARDINAL: Record<string, number> = {
  left: 0,
  bottom: 90,
  right: 180,
  top: 270,
};

/**
 * @deprecated Use `geminiSmartPreCrop()` or `claudeSmartPreCrop()` from `gemini-bbox.ts` instead.
 * Kept for `generateFrontThumbnailBuffer()` compatibility.
 */
export async function detectTextRotation(
  imageBase64: string,
  mediaType: string,
): Promise<RotationDegrees> {
  try {
    const rawText = await callClaude({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: ROTATION_PROMPT },
          ],
        },
      ],
    });

    log.debug("[image-utils] rotation raw response:", rawText);
    const parsed = parseClaudeJsonResponse<{
      brand_name?: string;
      first_letter_position?: string;
    }>(rawText);

    const position = parsed.first_letter_position?.toLowerCase() ?? "";
    const degrees = POSITION_TO_CARDINAL[position] ?? 0;
    if (degrees !== 0) {
      log.debug("[image-utils] detected text rotation:", degrees, "degrees",
        `(first letter at ${position}, brand: ${parsed.brand_name ?? "unknown"})`);
    }
    return degrees;
  } catch (err) {
    log.warn("[image-utils] rotation detection failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

const MAX_TILT = 15;

/**
 * @deprecated Use `geminiSmartPreCrop()` or `claudeSmartPreCrop()` from `gemini-bbox.ts` instead.
 * Kept for `generateFrontThumbnailBuffer()` compatibility.
 */
export async function detectTiltCorrection(
  imageBase64: string,
  mediaType: string,
): Promise<number> {
  try {
    const rawText = await callClaude({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 128,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: TILT_PROMPT },
          ],
        },
      ],
    });

    log.debug("[image-utils] tilt raw response:", rawText);
    const parsed = parseClaudeJsonResponse<{ tilt_degrees?: number }>(rawText);
    const raw = Number(parsed.tilt_degrees) || 0;
    const clamped = Math.max(-MAX_TILT, Math.min(MAX_TILT, raw));
    const rounded = Math.round(clamped * 10) / 10;
    if (rounded !== 0) {
      log.debug("[image-utils] detected tilt correction:", rounded, "degrees");
    }
    return rounded;
  } catch (err) {
    log.warn("[image-utils] tilt detection failed:", err instanceof Error ? err.message : err);
    return 0;
  }
}

/**
 * Generate a product_front thumbnail: Claude bounding-box crop with white
 * background, falling back to center cover crop when detection fails.
 */
export async function generateFrontThumbnailBuffer(
  imageBuffer: Buffer,
  mediaType: string,
): Promise<Buffer> {
  const orientedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  const meta = await sharp(orientedBuffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  if (w > 0 && h > 0) {
    const orientedBase64 = orientedBuffer.toString("base64");
    const [cropRegion, rotation] = await Promise.all([
      getProductBoundingBox(orientedBase64, mediaType, w, h),
      detectTextRotation(orientedBase64, mediaType),
    ]);

    if (cropRegion || rotation !== 0) {
      let processed = orientedBuffer;

      if (cropRegion) {
        processed = await sharp(orientedBuffer)
          .extract({
            left: cropRegion.crop_x,
            top: cropRegion.crop_y,
            width: cropRegion.crop_width,
            height: cropRegion.crop_height,
          })
          .toBuffer();
      }

      if (rotation !== 0) {
        processed = await sharp(processed)
          .rotate(rotation, { background: { r: 255, g: 255, b: 255 } })
          .toBuffer();

        const tiltBase64 = processed.toString("base64");
        const tilt = await detectTiltCorrection(tiltBase64, "image/jpeg");
        if (tilt !== 0) {
          processed = await sharp(processed)
            .rotate(tilt, { background: { r: 255, g: 255, b: 255 } })
            .toBuffer();
        }
      }

      return sharp(processed)
        .resize(150, 150, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255 },
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
  }

  return makeThumbnail(imageBuffer);
}
