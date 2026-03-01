/**
 * Decode EAN (EAN-13, EAN-8, UPC-A) from a static image buffer.
 * Used before Claude extraction so we prefer scanned EAN over AI-read digits.
 * Tries full image and optionally scaled/center crop for small barcodes.
 */

import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from "@zxing/library";
import sharp from "sharp";

const EAN_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
];

function tryDecode(
  luminance: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  try {
    const source = new RGBLuminanceSource(luminance, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, EAN_FORMATS);
    const reader = new MultiFormatReader();
    const result = reader.decode(bitmap, hints);
    const text = result.getText()?.trim();
    if (text && /^\d{8,14}$/.test(text)) return text;
    return null;
  } catch {
    return null;
  }
}

/**
 * Convert RGBA buffer to luminance (one byte per pixel).
 */
function rgbaToLuminance(
  rgba: Buffer,
  width: number,
  height: number
): Uint8ClampedArray {
  const len = width * height;
  const out = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
  }
  return out;
}

/**
 * Decode first EAN/UPC found in the image. Tries full image, then 2x upscale of center
 * (helps when barcode is small). Returns null if no barcode found.
 */
export async function decodeEanFromImageBuffer(
  imageBuffer: Buffer
): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels !== 4 || width < 50 || height < 50) return null;
    const luminance = rgbaToLuminance(data, width, height);
    let code = tryDecode(luminance, width, height);
    if (code) return code;
    // Try 2x upscaled center crop (barcode often in center; more pixels can help)
    const cropW = Math.floor(width * 0.85);
    const cropH = Math.floor(height * 0.85);
    const left = Math.floor((width - cropW) / 2);
    const top = Math.floor((height - cropH) / 2);
    const scaled = await sharp(imageBuffer)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(cropW * 2, cropH * 2, { kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lum2 = rgbaToLuminance(
      scaled.data,
      scaled.info.width,
      scaled.info.height
    );
    code = tryDecode(lum2, scaled.info.width, scaled.info.height);
    return code ?? null;
  } catch {
    return null;
  }
}
