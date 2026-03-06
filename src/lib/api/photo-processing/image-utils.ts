/**
 * Image preprocessing and thumbnail generation for photo processing (BL-31).
 */

import sharp from "sharp";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { CROP_PROMPT } from "./prompts";
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

interface BoundingBox {
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

/** Ask Claude for product bounding box. Returns null on failure or invalid response. */
export async function getProductBoundingBox(
  imageBase64: string,
  mediaType: string,
  imageWidth: number,
  imageHeight: number,
): Promise<BoundingBox | null> {
  try {
    const prompt = `${CROP_PROMPT}\n\nThe image is ${imageWidth} x ${imageHeight} pixels.`;
    const parsed = await callClaudeJSON<{
      crop_x?: number;
      crop_y?: number;
      crop_width?: number;
      crop_height?: number;
    }>({
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
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    const raw_x = Math.max(0, Math.floor(Number(parsed.crop_x) ?? 0));
    const raw_y = Math.max(0, Math.floor(Number(parsed.crop_y) ?? 0));
    const raw_w = Math.max(1, Math.floor(Number(parsed.crop_width) ?? 0));
    const raw_h = Math.max(1, Math.floor(Number(parsed.crop_height) ?? 0));
    // Clamp to image bounds instead of rejecting — model coords may slightly overshoot
    const crop_x = Math.min(raw_x, imageWidth - 1);
    const crop_y = Math.min(raw_y, imageHeight - 1);
    const crop_width = Math.min(raw_w, imageWidth - crop_x);
    const crop_height = Math.min(raw_h, imageHeight - crop_y);
    if (crop_width < 1 || crop_height < 1) return null;
    return { crop_x, crop_y, crop_width, crop_height };
  } catch {
    return null;
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
    const box = await getProductBoundingBox(orientedBase64, mediaType, w, h);
    if (box) {
      return sharp(orientedBuffer)
        .extract({
          left: box.crop_x,
          top: box.crop_y,
          width: box.crop_width,
          height: box.crop_height,
        })
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
