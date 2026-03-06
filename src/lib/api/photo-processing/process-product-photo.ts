/**
 * Vision photo handler: product_front, product_back, shelf, receipt, image flyer (BL-31).
 *
 * Calls Claude Vision, determines photo type, generates thumbnails,
 * routes to review flow (product_front/back/shelf) or product upsert (receipt/flyer).
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { decodeEanFromImageBuffer } from "@/lib/barcode-from-image";
import { VISION_PROMPT, type ClaudeResponse } from "./prompts";
import { removeBackground } from "@/lib/product-photo-studio/background-removal";
import {
  preCropToProduct,
  enhanceProduct,
  compositeOnCanvas,
} from "@/lib/product-photo-studio/create-thumbnail";
import { upsertExtractedProducts } from "./process-receipt";
import { log } from "@/lib/utils/logger";

export async function processVisionPhoto(
  supabase: SupabaseClient,
  uploadId: string,
  photoUrl: string,
  imageBase64: string,
  mediaType: string,
  imageBuffer: Buffer | null,
  now: string,
): Promise<NextResponse> {
  let claudeJson: ClaudeResponse;
  let visionScannedEan: string | null = null;

  try {
    visionScannedEan =
      imageBuffer != null
        ? await decodeEanFromImageBuffer(imageBuffer)
        : null;
    if (visionScannedEan) {
      log.debug("[process-photo] Vision: EAN from barcode scan:", visionScannedEan);
    }

    const visionPromptText =
      visionScannedEan != null
        ? `${VISION_PROMPT}\n\nHinweis: Ein Barcode wurde bereits aus dem Bild gelesen (${visionScannedEan}). Setze bei allen Produkten "ean_barcode" auf null; der EAN wird nach der Auswertung aus dem Scan übernommen.`
        : VISION_PROMPT;

    const content = [
      {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mediaType as
            | "image/jpeg"
            | "image/png"
            | "image/gif"
            | "image/webp",
          data: imageBase64,
        },
      },
      { type: "text" as const, text: visionPromptText },
    ];

    const text = await callClaude({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    });
    if (!text) {
      await supabase
        .from("photo_uploads")
        .update({
          status: "error",
          error_message: "No response from Claude",
          processed_at: now,
        })
        .eq("upload_id", uploadId);
      return NextResponse.json(
        { error: "No Claude response" },
        { status: 502 },
      );
    }

    log.debug("[process-photo] Claude response length:", text.length);

    let parsed: ClaudeResponse | null = null;
    try {
      parsed = parseClaudeJsonResponse<ClaudeResponse>(text);
    } catch {
      // handled below
    }
    if (!parsed) {
      const parseMsg = "JSON parse failed (truncated or invalid)";
      const rawPreview =
        text.length > 2000 ? text.slice(0, 2000) + "…" : text;
      const error_message = `JSON parse: ${parseMsg}. Raw response: ${rawPreview}`;
      log.error("[process-photo] JSON parse error after repair attempt, raw length:", text.length);
      await supabase
        .from("photo_uploads")
        .update({ status: "error", error_message, processed_at: now })
        .eq("upload_id", uploadId);
      return NextResponse.json({ error: parseMsg }, { status: 502 });
    }
    claudeJson = parsed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", uploadId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const photoType =
    claudeJson.photo_type &&
    [
      "product_front",
      "product_back",
      "receipt",
      "flyer",
      "shelf",
      "flyer_pdf",
    ].includes(claudeJson.photo_type)
      ? claudeJson.photo_type
      : "product_front";

  const products = Array.isArray(claudeJson.products)
    ? claudeJson.products
    : [];
  if (visionScannedEan && products.length > 0) {
    products[0].ean_barcode = visionScannedEan;
  }

  let thumbnailUrl: string | null = null;
  let backThumbnailUrl: string | null = null;

  if (photoType === "product_front" && imageBuffer) {
    try {
      const preCropped = await preCropToProduct(imageBuffer);
      const bgResult = await removeBackground(preCropped);
      const enhanced = await enhanceProduct(bgResult.buffer);
      const { buffer: thumbBuffer, format } = await compositeOnCanvas(enhanced, 150, false);
      const ext = format === "image/webp" ? "webp" : "jpg";
      const thumbPath = `${uploadId}.${ext}`;
      const { error: thumbUpErr } = await supabase.storage
        .from("product-thumbnails")
        .upload(thumbPath, thumbBuffer, {
          contentType: format,
          upsert: true,
        });
      if (!thumbUpErr) {
        const { data: thumbUrlData } = supabase.storage
          .from("product-thumbnails")
          .getPublicUrl(thumbPath);
        thumbnailUrl = thumbUrlData.publicUrl;
        log.debug("[process-photo] Thumbnail uploaded:", thumbPath);
      } else {
        log.warn("[process-photo] Thumbnail upload failed:", thumbUpErr.message);
      }
    } catch (e) {
      log.warn("[process-photo] Studio thumbnail failed:", e instanceof Error ? e.message : e);
    }
  } else if (photoType === "product_back" && imageBuffer) {
    try {
      const enhanced = await enhanceProduct(imageBuffer);
      const { buffer: thumbBuffer, format } = await compositeOnCanvas(enhanced, 150, false);
      const ext = format === "image/webp" ? "webp" : "jpg";
      const thumbPath = `back-${uploadId}.${ext}`;
      const { error: thumbUpErr } = await supabase.storage
        .from("product-thumbnails")
        .upload(thumbPath, thumbBuffer, {
          contentType: format,
          upsert: true,
        });
      if (!thumbUpErr) {
        const { data: thumbUrlData } = supabase.storage
          .from("product-thumbnails")
          .getPublicUrl(thumbPath);
        backThumbnailUrl = thumbUrlData.publicUrl;
        log.debug("[process-photo] Back thumbnail uploaded:", thumbPath);
      } else {
        log.warn("[process-photo] Back thumbnail upload failed:", thumbUpErr.message);
      }
    } catch (e) {
      log.warn("[process-photo] Studio back thumbnail failed:", e instanceof Error ? e.message : e);
    }
  }

  const needsReview =
    photoType === "product_front" ||
    photoType === "product_back" ||
    photoType === "shelf";

  if (needsReview) {
    const extractedData = {
      ...claudeJson,
      ...(thumbnailUrl != null ? { thumbnail_url: thumbnailUrl } : {}),
      ...(backThumbnailUrl != null
        ? { thumbnail_back_url: backThumbnailUrl }
        : {}),
    };
    const { error: reviewErr } = await supabase
      .from("photo_uploads")
      .update({
        status: "pending_review",
        photo_type: photoType,
        extracted_data:
          extractedData as unknown as Record<string, unknown>,
        products_created: 0,
        products_updated: 0,
        processed_at: now,
        error_message: null,
        pending_thumbnail_overwrites: null,
      })
      .eq("upload_id", uploadId);

    if (reviewErr) {
      log.error(
        "[process-photo] pending_review update failed (Review-Fenster erscheint nicht). Migration 20250220110000 anwenden:",
        reviewErr.message,
      );
      const { error: fallbackErr } = await supabase
        .from("photo_uploads")
        .update({
          status: "completed",
          photo_type: photoType,
          extracted_data:
            extractedData as unknown as Record<string, unknown>,
          products_created: 0,
          products_updated: 0,
          processed_at: now,
          error_message:
            "Review-Status nicht verfügbar – bitte Migration 20250220110000 anwenden.",
          pending_thumbnail_overwrites: null,
        })
        .eq("upload_id", uploadId);
      if (fallbackErr) {
        log.error("[process-photo] Fallback update also failed:", fallbackErr.message);
      }
      return NextResponse.json({
        ok: true,
        upload_id: uploadId,
        photo_type: photoType,
        status: "completed",
        warning:
          "pending_review constraint missing – run migration 20250220110000",
      });
    }

    log.debug("[process-photo] Saved for review", uploadId, "photo_type:", photoType);
    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      photo_type: photoType,
      status: "pending_review",
    });
  }

  const { productsCreated, productsUpdated, pendingThumbnailOverwrites } =
    await upsertExtractedProducts(
      supabase,
      products,
      {
        photoType,
        claudeJson,
        uploadId,
        photoUrl,
        thumbnailUrl,
        backThumbnailUrl,
        flyerIdForProducts: null,
        flyerCountry: "DE",
      },
      now,
    );

  const { error: finalErr } = await supabase
    .from("photo_uploads")
    .update({
      status: "completed",
      photo_type: photoType,
      extracted_data:
        claudeJson as unknown as Record<string, unknown>,
      products_created: productsCreated,
      products_updated: productsUpdated,
      processed_at: now,
      error_message: null,
      pending_thumbnail_overwrites:
        pendingThumbnailOverwrites.length > 0
          ? pendingThumbnailOverwrites
          : null,
    })
    .eq("upload_id", uploadId);

  if (finalErr) {
    log.error("[process-photo] Finalize failed:", finalErr.message);
    return NextResponse.json(
      { error: "Failed to finalize" },
      { status: 500 },
    );
  }

  log.debug(
    "[process-photo] Completed",
    uploadId,
    "products_created:",
    productsCreated,
    "products_updated:",
    productsUpdated,
  );
  return NextResponse.json({
    ok: true,
    upload_id: uploadId,
    photo_type: photoType,
    products_created: productsCreated,
    products_updated: productsUpdated,
    pending_thumbnail_overwrites: pendingThumbnailOverwrites.length,
  });
}
