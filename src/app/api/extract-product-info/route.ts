/**
 * Lightweight endpoint for extracting product info (name, brand, EAN, price)
 * from a product photo via Claude Vision + ZXing barcode scan.
 *
 * Reuses DATA_EXTRACTION_PROMPT and decodeEanFromImageBuffer from the existing
 * photo-processing pipeline but skips photo_uploads tracking and ALDI-specific logic.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  claudeRateLimit,
  checkRateLimit,
  getIdentifier,
} from "@/lib/api/rate-limit";
import { requireApiKey } from "@/lib/api/guards";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { DATA_EXTRACTION_PROMPT } from "@/lib/api/photo-processing/prompts";
import { decodeEanFromImageBuffer } from "@/lib/barcode-from-image";
import { log } from "@/lib/utils/logger";

const VALID_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

const schema = z.object({
  image_base64: z.string().min(100),
  media_type: z.enum(VALID_MEDIA_TYPES),
});

interface ExtractedInfo {
  name?: string | null;
  brand?: string | null;
  ean_barcode?: string | null;
  price?: number | null;
  weight_or_quantity?: string | null;
  is_bio?: boolean | null;
}

export async function POST(request: Request) {
  const apiKey = requireApiKey();
  if (apiKey instanceof NextResponse) return apiKey;

  const rateLimitResponse = await checkRateLimit(
    claudeRateLimit,
    getIdentifier(request),
  );
  if (rateLimitResponse) return rateLimitResponse;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { image_base64, media_type } = parsed.data;

  try {
    let scannedEan: string | null = null;
    try {
      const buf = Buffer.from(image_base64, "base64");
      scannedEan = await decodeEanFromImageBuffer(buf);
      if (scannedEan) {
        log.debug("[extract-product-info] EAN from barcode scan:", scannedEan);
      }
    } catch {
      // barcode scan is best-effort
    }

    const prompt =
      scannedEan != null
        ? `${DATA_EXTRACTION_PROMPT}\n\nWICHTIG: Der EAN-Code wurde bereits per Barcode-Scanner aus dem Bild erkannt: ${scannedEan}. Setze im JSON "ean_barcode" auf genau diesen Wert (nur diese Zahl). Lies den EAN nicht aus dem Bild ab.`
        : DATA_EXTRACTION_PROMPT;

    const content = [
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: image_base64,
        },
      },
      { type: "text" as const, text: prompt },
    ];

    const result = await callClaudeJSON<ExtractedInfo>({
      model: CLAUDE_MODEL_HAIKU,
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    });

    return NextResponse.json({
      ok: true,
      name: result.name ?? null,
      brand: result.brand ?? null,
      ean_barcode: scannedEan ?? result.ean_barcode ?? null,
      price: typeof result.price === "number" ? result.price : null,
      weight_or_quantity: result.weight_or_quantity ?? null,
      is_bio: result.is_bio === true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    log.error("[extract-product-info] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
