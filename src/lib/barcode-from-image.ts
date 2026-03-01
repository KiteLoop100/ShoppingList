/**
 * Decode EAN (EAN-13, EAN-8, UPC-A) from a static image buffer.
 * Used before Claude extraction so we prefer scanned EAN over AI-read digits.
 * Tries full image and optionally scaled/center crop for small barcodes.
 *
 * Uses ZBar WASM – the same engine used client-side in scanner-engine.ts.
 */

import { scanImageData } from "@undecaf/zbar-wasm";
import sharp from "sharp";

const EAN_REGEX = /^\d{8,14}$/;

const ZBAR_EAN_TYPES = new Set([
  "EAN-13", "EAN-8", "UPC-A",
  "ZBAR_EAN13", "ZBAR_EAN8", "ZBAR_UPCA",
]);

function extractEan(rawValue: string | undefined | null): string | null {
  const v = rawValue?.trim();
  return v && EAN_REGEX.test(v) ? v : null;
}

async function tryScan(
  rgba: Buffer,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const data = new Uint8ClampedArray(
      rgba.buffer, rgba.byteOffset, rgba.byteLength,
    );
    const imageData = { data, width, height } as unknown as ImageData;
    const symbols = await scanImageData(imageData);
    for (const sym of symbols) {
      if (!ZBAR_EAN_TYPES.has(sym.typeName)) continue;
      const ean = extractEan(sym.decode());
      if (ean) return ean;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Decode first EAN/UPC found in the image. Tries full image, then 2x upscale
 * of center (helps when barcode is small). Returns null if no barcode found.
 */
export async function decodeEanFromImageBuffer(
  imageBuffer: Buffer,
): Promise<string | null> {
  try {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels !== 4 || width < 50 || height < 50) return null;

    let code = await tryScan(data, width, height);
    if (code) return code;

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

    code = await tryScan(scaled.data, scaled.info.width, scaled.info.height);
    return code ?? null;
  } catch {
    return null;
  }
}
