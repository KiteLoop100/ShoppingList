/**
 * Background removal with tiered provider logic and edge-quality scoring.
 * Priority chain:
 * 1. Self-hosted model (BiRefNet/RMBG-2.0 via SELF_HOSTED_BG_REMOVAL_URL)
 * 2. remove.bg API with type=product (requires REMOVE_BG_API_KEY) — only if #1 recommends retry
 * 3. Replicate API (lucataco/remove-bg via REPLICATE_API_TOKEN) — only if #2 recommends retry
 *
 * Each result is scored via calculateEdgeQualityScore (transparency + halo + edge smoothness).
 * Recommendation drives the decision:
 *   - "accept" → use this result
 *   - "retry"  → try next provider in chain
 *   - "fallback" → stop immediately, caller applies soft-fallback
 * Returns null when all providers fail or recommend fallback.
 */

import sharp from "sharp";
import type { BackgroundRemovalProvider, BackgroundRemovalResult } from "./types";
import { calculateEdgeQualityScore, type EdgeQualityRecommendation } from "./edge-quality";
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

class ReplicateProvider implements BackgroundRemovalProvider {
  name = "replicate";
  private cachedModel: string | null = null;
  private cachedVersion: string | null = null;

  isAvailable(): boolean {
    return !!process.env.REPLICATE_API_TOKEN;
  }

  private async resolveVersion(token: string): Promise<string> {
    const model = process.env.REPLICATE_BG_MODEL ?? "lucataco/remove-bg";
    if (this.cachedVersion && this.cachedModel === model) return this.cachedVersion;

    if (model.length === 64 && /^[a-f0-9]+$/.test(model)) {
      this.cachedModel = model;
      this.cachedVersion = model;
      return model;
    }

    const res = await fetch(`https://api.replicate.com/v1/models/${model}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Replicate model lookup failed ${res.status} for ${model}`);
    }
    const data = (await res.json()) as { latest_version?: { id?: string } };
    const versionId = data.latest_version?.id;
    if (!versionId) throw new Error(`No version found for Replicate model ${model}`);

    log.debug("[photo-studio] replicate: resolved", model, "→", versionId.substring(0, 12) + "…");
    this.cachedModel = model;
    this.cachedVersion = versionId;
    return versionId;
  }

  async removeBackground(imageBuffer: Buffer): Promise<Buffer> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN not configured");

    const version = await this.resolveVersion(token);
    const b64 = imageBuffer.toString("base64");

    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version,
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

const selfHostedProvider = new SelfHostedProvider();
const removeBgProvider = new RemoveBgProvider();
const replicateProvider = new ReplicateProvider();

/**
 * Kept for backward compatibility — validates that a PNG has meaningful
 * alpha channel. Delegates to the edge-quality module internally.
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
    if (ratio < 0.03) {
      log.warn("[photo-studio] bg removal produced only", (ratio * 100).toFixed(1) + "% transparency — likely failed");
      return false;
    }
    if (ratio > 0.97) {
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

interface ProviderAttempt {
  provider: BackgroundRemovalProvider;
  buffer: Buffer;
  isValid: boolean;
  recommendation: EdgeQualityRecommendation;
}

/**
 * Try a single provider: call it, score the result, log diagnostics.
 * Returns null on provider error (caught and logged).
 */
async function tryProvider(
  provider: BackgroundRemovalProvider,
  imageBuffer: Buffer,
  failures: string[],
): Promise<ProviderAttempt | null> {
  if (!provider.isAvailable()) return null;

  try {
    log.debug(`[BG-Removal] trying provider=${provider.name}`);
    const resultBuffer = await provider.removeBackground(imageBuffer);
    const eq = await calculateEdgeQualityScore(resultBuffer);

    log.info(
      `[BG-Removal] provider=${provider.name} score=${eq.score.toFixed(3)} recommendation=${eq.recommendation} halo=${eq.haloScore.toFixed(3)} edge=${eq.edgeSmoothness.toFixed(3)}`,
    );

    return { provider, buffer: resultBuffer, isValid: eq.isValid, recommendation: eq.recommendation };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isPayment = msg.includes("402") || msg.includes("payment") || msg.includes("credit");
    const reason = isPayment
      ? `${provider.name}: credits exhausted or payment required`
      : `${provider.name}: ${msg}`;
    failures.push(reason);
    log.warn(`[BG-Removal] ${reason}`);
    return null;
  }
}

/**
 * Remove background using a tiered provider strategy:
 * 1. Self-hosted  →  2. remove.bg (product)  →  3. Replicate
 *
 * Returns null when every provider either fails or produces invalid transparency,
 * so the caller can apply a soft-fallback (e.g. white background composite).
 */
export async function removeBackground(imageBuffer: Buffer): Promise<BackgroundRemovalResult | null> {
  const skipped: string[] = [];
  const failures: string[] = [];

  const orderedProviders: BackgroundRemovalProvider[] = [
    selfHostedProvider,
    removeBgProvider,
    replicateProvider,
  ];

  for (const provider of orderedProviders) {
    if (!provider.isAvailable()) {
      skipped.push(provider.name);
      continue;
    }

    const attempt = await tryProvider(provider, imageBuffer, failures);

    if (!attempt) continue;

    if (attempt.recommendation === "accept") {
      if (skipped.length > 0 || failures.length > 0) {
        log.debug("[BG-Removal] succeeded with", provider.name, { skipped, failedBefore: failures });
      }
      return { imageBuffer: attempt.buffer, hasTransparency: true, providerUsed: provider.name };
    }

    if (attempt.recommendation === "fallback") {
      log.warn(`[BG-Removal] ${provider.name}: quality too low (fallback), skipping remaining providers`);
      break;
    }

    log.warn(`[BG-Removal] ${provider.name}: quality marginal (retry), trying next provider`);
    failures.push(`${provider.name}: edge-quality below accept threshold`);
  }

  const noProviders = failures.length === 0 && skipped.length > 0;
  if (noProviders) {
    log.warn(
      "[BG-Removal] no background removal providers configured.",
      "Set SELF_HOSTED_BG_REMOVAL_URL, REMOVE_BG_API_KEY, or REPLICATE_API_TOKEN.",
      "Skipped:", skipped.join(", "),
    );
  } else {
    log.error("[BG-Removal] all providers failed", {
      skipped,
      failures,
      hint: failures.some((f) => f.includes("credits exhausted"))
        ? "remove.bg credits are likely exhausted — consider self-hosted rembg"
        : "check provider configuration and availability",
    });
  }

  return null;
}
