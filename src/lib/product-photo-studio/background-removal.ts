/**
 * Background removal providers with strategy pattern.
 * Primary: remove.bg API (requires REMOVE_BG_API_KEY).
 * Fallback: AI-guided crop via existing Claude bounding box + Sharp white background.
 */

import sharp from "sharp";
import { getProductBoundingBox } from "@/lib/api/photo-processing/image-utils";
import type { BackgroundRemovalProvider } from "./types";
import { log } from "@/lib/utils/logger";

class RemoveBgProvider implements BackgroundRemovalProvider {
  name = "remove.bg";

  isAvailable(): boolean {
    return !!process.env.REMOVE_BG_API_KEY;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured");

    const formData = new FormData();
    formData.append("image_file", new Blob([new Uint8Array(imageBuffer)]), "image.jpg");
    formData.append("size", "regular");
    formData.append("type", "product");
    formData.append("format", "png");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`remove.bg API error ${response.status}: ${errText}`);
    }

    const resultBuf = await response.arrayBuffer();
    return Buffer.from(resultBuf);
  }
}

class CropFallbackProvider implements BackgroundRemovalProvider {
  name = "crop-fallback";

  isAvailable(): boolean {
    return true;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const oriented = await sharp(imageBuffer).rotate().toBuffer();
    const meta = await sharp(oriented).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    if (w > 0 && h > 0) {
      const base64 = oriented.toString("base64");
      const box = await getProductBoundingBox(base64, "image/jpeg", w, h);
      if (box) {
        return sharp(oriented)
          .extract({
            left: box.crop_x,
            top: box.crop_y,
            width: box.crop_width,
            height: box.crop_height,
          })
          .toBuffer();
      }
    }

    return oriented;
  }
}

const providers: BackgroundRemovalProvider[] = [
  new RemoveBgProvider(),
  new CropFallbackProvider(),
];

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    try {
      log.debug(`[photo-studio] removing background with ${provider.name}`);
      return await provider.removeBackground(imageBuffer);
    } catch (err) {
      log.warn(
        `[photo-studio] ${provider.name} failed, trying next:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  log.warn("[photo-studio] all background removal providers failed, using original");
  return imageBuffer;
}
