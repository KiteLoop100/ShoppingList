/**
 * Background removal providers with strategy pattern.
 * Priority chain:
 * 1. Self-hosted model (BiRefNet/RMBG-2.0 via SELF_HOSTED_BG_REMOVAL_URL)
 * 2. remove.bg API with type=product (requires REMOVE_BG_API_KEY)
 * 3. remove.bg API with type=auto (fallback for similar-color packaging)
 * 4. AI-guided crop via Claude bounding box + Sharp
 */

import sharp from "sharp";
import type { BackgroundRemovalProvider, BackgroundRemovalResult } from "./types";
import { log } from "@/lib/utils/logger";

const EXTERNAL_FETCH_TIMEOUT_MS = 15_000;

async function callRemoveBgApi(imageBuffer: Buffer, apiKey: string, type: "product" | "auto"): Promise<Buffer> {
  const formData = new FormData();
  formData.append("image_file", new Blob([new Uint8Array(imageBuffer)]), "image.jpg");
  formData.append("size", "full");
  formData.append("type", type);
  formData.append("crop", "true");
  formData.append("format", "png");

  const response = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`remove.bg API error ${response.status}: ${errText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Self-hosted background removal via BiRefNet, RMBG-2.0, or similar.
 * Expects a service at SELF_HOSTED_BG_REMOVAL_URL that accepts POST with
 * multipart image_file and returns PNG with alpha channel.
 * Deploy with: https://github.com/danielgatis/rembg (Docker) or Replicate API.
 */
class SelfHostedProvider implements BackgroundRemovalProvider {
  name = "self-hosted";

  isAvailable(): boolean {
    return !!process.env.SELF_HOSTED_BG_REMOVAL_URL;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const url = process.env.SELF_HOSTED_BG_REMOVAL_URL;
    if (!url) throw new Error("SELF_HOSTED_BG_REMOVAL_URL not configured");

    const formData = new FormData();
    formData.append("image_file", new Blob([new Uint8Array(imageBuffer)]), "image.jpg");

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`Self-hosted BG removal error ${response.status}: ${errText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

class RemoveBgProvider implements BackgroundRemovalProvider {
  name = "remove.bg";

  isAvailable(): boolean {
    return !!process.env.REMOVE_BG_API_KEY;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured");
    return callRemoveBgApi(imageBuffer, apiKey, "product");
  }
}

class RemoveBgAutoFallbackProvider implements BackgroundRemovalProvider {
  name = "remove.bg-auto";

  isAvailable(): boolean {
    return !!process.env.REMOVE_BG_API_KEY;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured");
    return callRemoveBgApi(imageBuffer, apiKey, "auto");
  }
}

class CropFallbackProvider implements BackgroundRemovalProvider {
  name = "crop-fallback";

  isAvailable(): boolean {
    return true;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    // No additional cropping — preCropToProduct has already isolated the product
    // region via Claude bounding-box detection. A second crop here would
    // double-crop and clip tall/narrow products like bottles.
    return sharp(imageBuffer).rotate().toBuffer();
  }
}

const providers: BackgroundRemovalProvider[] = [
  new SelfHostedProvider(),
  new RemoveBgProvider(),
  new RemoveBgAutoFallbackProvider(),
  new CropFallbackProvider(),
];

export async function removeBackground(imageBuffer: Buffer): Promise<BackgroundRemovalResult> {
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    try {
      log.debug(`[photo-studio] removing background with ${provider.name}`);
      const resultBuffer = await provider.removeBackground(imageBuffer);
      const hasTransparency = provider.name !== "crop-fallback";
      return { imageBuffer: resultBuffer, hasTransparency, providerUsed: provider.name };
    } catch (err) {
      log.warn(
        `[photo-studio] ${provider.name} failed, trying next:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  log.warn("[photo-studio] all background removal providers failed, using original");
  return { imageBuffer, hasTransparency: false, providerUsed: "none" };
}
