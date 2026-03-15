/**
 * Image preprocessing and thumbnail generation for photo processing (BL-31).
 */

import sharp from "sharp";
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

/** EXIF rotate + contain-fit to 150x150 on white background (no cropping). */
export async function makeThumbnail(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize(150, 150, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toBuffer();
}
