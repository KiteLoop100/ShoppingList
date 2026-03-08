/**
 * Background removal providers with strategy pattern.
 * Priority chain:
 * 1. Self-hosted model (BiRefNet/RMBG-2.0 via SELF_HOSTED_BG_REMOVAL_URL)
 * 2. Replicate API (lucataco/remove-bg via REPLICATE_API_TOKEN)
 * 3. remove.bg API with type=product (requires REMOVE_BG_API_KEY)
 * 4. remove.bg API with type=auto (fallback for similar-color packaging)
 * 5. AI-guided crop via Claude bounding box + Sharp (always available)
 */

import sharp from "sharp";
import type { BackgroundRemovalProvider, BackgroundRemovalResult } from "./types";
import { log } from "@/lib/utils/logger";

const EXTERNAL_FETCH_TIMEOUT_MS = 15_000;
const REPLICATE_TIMEOUT_MS = 30_000;

async function callRemoveBgApi(imageBuffer: Buffer, apiKey: string, type: "product" | "auto"): Promise<Buffer> {
  const formData = new FormData();
  formData.append("image_file", new Blob([new Uint8Array(imageBuffer)]), "image.jpg");
  formData.append("size", "full");
  formData.append("type", type);
  formData.append("crop", "false");
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

/**
 * Background removal via Replicate API (e.g. lucataco/remove-bg).
 * Uses `Prefer: wait` header for synchronous prediction.
 * Configurable model via REPLICATE_BG_MODEL env var.
 */
class ReplicateProvider implements BackgroundRemovalProvider {
  name = "replicate";

  isAvailable(): boolean {
    return !!process.env.REPLICATE_API_TOKEN;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN not configured");

    const model = process.env.REPLICATE_BG_MODEL ?? "lucataco/remove-bg";
    const b64 = imageBuffer.toString("base64");

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: model,
        input: { image: `data:image/jpeg;base64,${b64}` },
      }),
      signal: AbortSignal.timeout(REPLICATE_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      throw new Error(`Replicate API error ${res.status}: ${errText}`);
    }

    const prediction = (await res.json()) as {
      status: string;
      error?: string;
      output?: string | string[];
    };

    if (prediction.status !== "succeeded") {
      throw new Error(
        `Replicate prediction ${prediction.status}: ${prediction.error ?? "timed out or still processing"}`,
      );
    }

    const outputUrl =
      typeof prediction.output === "string"
        ? prediction.output
        : Array.isArray(prediction.output)
          ? prediction.output[0]
          : null;
    if (!outputUrl) throw new Error("Replicate returned no output URL");

    const imgRes = await fetch(outputUrl, {
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!imgRes.ok) {
      throw new Error(`Failed to download Replicate output: ${imgRes.status}`);
    }

    return Buffer.from(await imgRes.arrayBuffer());
  }
}

class RemoveBgProvider implements BackgroundRemovalProvider {
  name: string;
  private type: "product" | "auto";

  constructor(type: "product" | "auto") {
    this.name = type === "product" ? "remove.bg" : "remove.bg-auto";
    this.type = type;
  }

  isAvailable(): boolean {
    return !!process.env.REMOVE_BG_API_KEY;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) throw new Error("REMOVE_BG_API_KEY not configured");
    return callRemoveBgApi(imageBuffer, apiKey, this.type);
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
  new ReplicateProvider(),
  new RemoveBgProvider("product"),
  new RemoveBgProvider("auto"),
  new CropFallbackProvider(),
];

const MIN_TRANSPARENCY_RATIO = 0.03;
const MAX_TRANSPARENCY_RATIO = 0.97;

/**
 * Validate that bg removal actually produced meaningful transparency.
 * Rejects results where <3% or >97% of pixels are transparent,
 * which indicates the provider silently failed or removed everything.
 */
export async function hasSignificantTransparency(pngBuffer: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(pngBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels < 4) return false;

    const totalPixels = width * height;
    let transparentPixels = 0;
    for (let i = 0; i < totalPixels; i++) {
      if (data[i * channels + 3] < 128) transparentPixels++;
    }

    const ratio = transparentPixels / totalPixels;
    if (ratio < MIN_TRANSPARENCY_RATIO) {
      log.warn("[photo-studio] bg removal produced only", (ratio * 100).toFixed(1) + "% transparency — likely failed");
      return false;
    }
    if (ratio > MAX_TRANSPARENCY_RATIO) {
      log.warn("[photo-studio] bg removal produced", (ratio * 100).toFixed(1) + "% transparency — removed too much");
      return false;
    }
    log.debug("[photo-studio] bg removal transparency:", (ratio * 100).toFixed(1) + "%");
    return true;
  } catch (err) {
    log.warn("[photo-studio] transparency check error:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function removeBackground(imageBuffer: Buffer): Promise<BackgroundRemovalResult> {
  const skipped: string[] = [];
  const failures: string[] = [];

  for (const provider of providers) {
    if (!provider.isAvailable()) {
      skipped.push(provider.name);
      continue;
    }
    try {
      log.debug(`[photo-studio] trying bg removal with ${provider.name}`);
      const resultBuffer = await provider.removeBackground(imageBuffer);

      if (provider.name !== "crop-fallback") {
        const valid = await hasSignificantTransparency(resultBuffer);
        if (!valid) {
          const reason = `${provider.name}: transparency validation failed`;
          failures.push(reason);
          log.warn(`[photo-studio] ${reason}, trying next provider`);
          continue;
        }
      }

      if (provider.name === "crop-fallback") {
        const noRealProviders = failures.length === 0;
        if (noRealProviders && skipped.length > 0) {
          log.warn(
            "[photo-studio] no background removal providers configured.",
            "Set REPLICATE_API_TOKEN, REMOVE_BG_API_KEY, or SELF_HOSTED_BG_REMOVAL_URL.",
            "Skipped:", skipped.join(", "),
          );
        } else if (failures.length > 0) {
          log.warn("[photo-studio] all bg removal providers failed, using crop-fallback.",
            "Failures:", failures.join("; "),
            skipped.length > 0 ? `Skipped: ${skipped.join(", ")}` : "",
          );
        }
        return {
          imageBuffer: resultBuffer,
          hasTransparency: false,
          providerUsed: provider.name,
          noProvidersConfigured: noRealProviders,
        };
      }

      if (skipped.length > 0 || failures.length > 0) {
        log.debug("[photo-studio] bg removal succeeded with", provider.name,
          { skipped, failedBefore: failures });
      }
      return { imageBuffer: resultBuffer, hasTransparency: true, providerUsed: provider.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPayment = msg.includes("402") || msg.includes("payment") || msg.includes("credit");
      const reason = isPayment
        ? `${provider.name}: credits exhausted or payment required`
        : `${provider.name}: ${msg}`;
      failures.push(reason);
      log.warn(`[photo-studio] ${reason}`);
    }
  }

  log.error("[photo-studio] all bg removal providers failed", {
    skipped,
    failures,
    hint: failures.some((f) => f.includes("credits exhausted"))
      ? "remove.bg credits are likely exhausted — consider self-hosted rembg or another provider"
      : "check provider configuration and availability",
  });
  return { imageBuffer, hasTransparency: false, providerUsed: "none" };
}
