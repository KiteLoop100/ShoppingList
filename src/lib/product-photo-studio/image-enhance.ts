/**
 * Pure image enhancement and compositing utilities.
 * Only depends on Sharp — no AI/Claude/Supabase imports.
 * Used by both the photo studio pipeline and the batch processing script.
 */

import sharp from "sharp";
import { log } from "@/lib/utils/logger";

export const FULL_SIZE = 1200;
export const THUMB_SIZE = 150;
const PADDING_RATIO = 0.10;
const WHITE = { r: 255, g: 255, b: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const SHADOW_BLUR_SIGMA = 6;
const SHADOW_OPACITY = 0.18;
const SHADOW_OFFSET_Y = 3;

/**
 * Apply color correction and sharpening to a product image.
 * Processes RGB channels only to preserve alpha transparency.
 */
export async function enhanceProduct(imageBuffer: Buffer): Promise<Buffer> {
  const rotated = await sharp(imageBuffer).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const hasAlpha = (meta.channels ?? 3) >= 4;

  if (!hasAlpha) {
    return sharp(rotated)
      .median(3)
      .modulate({ brightness: 1.05, saturation: 1.12 })
      .linear(1.05, -6)
      .sharpen({ sigma: 1.0, m1: 0.5, m2: 0.4 })
      .toBuffer();
  }

  const alpha = await sharp(rotated).extractChannel(3).toBuffer();
  const rgb = await sharp(rotated)
    .removeAlpha()
    .median(3)
    .modulate({ brightness: 1.05, saturation: 1.12 })
    .linear(1.05, -6)
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 0.4 })
    .toBuffer();

  return sharp(rgb).joinChannel(alpha).png().toBuffer();
}

/**
 * Composite product on white canvas with optional drop shadow.
 * Shadow uses the product's alpha channel blurred + reduced opacity.
 */
export async function compositeOnCanvas(
  imageBuffer: Buffer,
  size: number,
  withShadow: boolean,
): Promise<{ buffer: Buffer; format: "image/webp" | "image/jpeg" }> {
  const productArea = Math.round(size * (1 - 2 * PADDING_RATIO));
  const offset = Math.round((size - productArea) / 2);

  const product = await sharp(imageBuffer)
    .ensureAlpha()
    .resize(productArea, productArea, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

  const layers: sharp.OverlayOptions[] = [];

  if (withShadow) {
    try {
      const { width: pw, height: ph } = await sharp(product).metadata();
      if (pw && ph) {
        const shadowAlpha = await sharp(product)
          .extractChannel(3)
          .linear(SHADOW_OPACITY, 0)
          .blur(SHADOW_BLUR_SIGMA)
          .toBuffer();

        const blackRgb = Buffer.alloc(pw * ph * 3, 0);
        const shadow = await sharp(blackRgb, { raw: { width: pw, height: ph, channels: 3 } })
          .joinChannel(shadowAlpha)
          .png()
          .toBuffer();

        layers.push({ input: shadow, left: offset, top: offset + SHADOW_OFFSET_Y });
      }
    } catch (err) {
      log.warn("[photo-studio] shadow creation failed, skipping:", err instanceof Error ? err.message : err);
    }
  }

  layers.push({ input: product, left: offset, top: offset });

  const isFullSize = size > THUMB_SIZE;
  const canvas = sharp({
    create: { width: size, height: size, channels: 3, background: WHITE },
  });

  if (isFullSize) {
    return {
      buffer: await canvas.composite(layers).webp({ quality: 90 }).toBuffer(),
      format: "image/webp",
    };
  }

  return {
    buffer: await canvas.composite(layers).jpeg({ quality: 85 }).toBuffer(),
    format: "image/jpeg",
  };
}
