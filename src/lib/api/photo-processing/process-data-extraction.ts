/**
 * Data extraction sub-flow: barcode, nutri-score, ingredients (BL-31).
 * Single photo → extract fields → optionally auto-fill existing product.
 * No new product creation.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { decodeEanFromImageBuffer } from "@/lib/barcode-from-image";
import { loadDemandGroups, loadDemandSubGroups, buildDemandGroupsAndSubGroupsPrompt } from "@/lib/categories/constants";
import { buildDataExtractionPrompt } from "./prompts";
import { log } from "@/lib/utils/logger";

export async function processDataExtraction(
  supabase: SupabaseClient,
  uploadId: string,
  imageBase64: string,
  mediaType: string,
  imageBuffer: Buffer | null,
  now: string,
): Promise<NextResponse> {
  try {
    const [groups, subGroups, scannedEan] = await Promise.all([
      loadDemandGroups(supabase),
      loadDemandSubGroups(supabase),
      imageBuffer != null ? decodeEanFromImageBuffer(imageBuffer) : Promise.resolve(null),
    ]);
    if (scannedEan) {
      log.debug("[process-photo] Data extraction: EAN from barcode scan:", scannedEan);
    }

    const demandGroupsBlock = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);
    const basePrompt = buildDataExtractionPrompt(demandGroupsBlock);
    const dataExtractionPrompt =
      scannedEan != null
        ? `${basePrompt}\n\nWICHTIG: Der EAN-Code wurde bereits per Barcode-Scanner aus dem Bild erkannt: ${scannedEan}. Setze im JSON "ean_barcode" auf genau diesen Wert (nur diese Zahl). Lies den EAN nicht aus dem Bild ab.`
        : basePrompt;

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
      { type: "text" as const, text: dataExtractionPrompt },
    ];

    const parsed = await callClaudeJSON<Record<string, unknown>>({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });

    const product = {
      name: parsed.name ?? null,
      brand: parsed.brand ?? null,
      ean_barcode: scannedEan ?? parsed.ean_barcode ?? null,
      article_number: parsed.article_number ?? null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      weight_or_quantity: parsed.weight_or_quantity ?? null,
      ingredients: parsed.ingredients ?? null,
      nutrition_info:
        (parsed.nutrition_info as Record<string, unknown>) ?? null,
      allergens: parsed.allergens ?? null,
      demand_sub_group: parsed.demand_sub_group ?? null,
    };

    let autoFilledProductId: string | null = null;
    const eanForLookup = product.ean_barcode;
    if (eanForLookup) {
      const { data: existingProduct } = await supabase
        .from("products")
        .select(
          "product_id, nutrition_info, ingredients, allergens, weight_or_quantity",
        )
        .eq("ean_barcode", eanForLookup)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (existingProduct) {
        autoFilledProductId = existingProduct.product_id;
        const updates: Record<string, unknown> = {};
        if (
          existingProduct.nutrition_info == null &&
          product.nutrition_info != null
        ) {
          updates.nutrition_info = product.nutrition_info;
        }
        if (
          existingProduct.ingredients == null &&
          product.ingredients != null
        ) {
          updates.ingredients = product.ingredients;
        }
        if (existingProduct.allergens == null && product.allergens != null) {
          updates.allergens = product.allergens;
        }
        if (
          existingProduct.weight_or_quantity == null &&
          product.weight_or_quantity != null
        ) {
          updates.weight_or_quantity = product.weight_or_quantity;
        }
        if (Object.keys(updates).length > 0) {
          updates.updated_at = now;
          await supabase
            .from("products")
            .update(updates)
            .eq("product_id", existingProduct.product_id);
          log.debug(
            "[process-photo] data_extraction auto-filled",
            Object.keys(updates).length,
            "fields for product",
            existingProduct.product_id,
          );
        }
      }
    }

    await supabase
      .from("photo_uploads")
      .update({
        status: "completed",
        extracted_data: {
          photo_type: "data_extraction",
          products: [product],
        } as unknown as Record<string, unknown>,
        photo_type: "data_extraction",
        processed_at: now,
      })
      .eq("upload_id", uploadId);

    return NextResponse.json({
      ok: true,
      extracted_data: product,
      auto_filled_product_id: autoFilledProductId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Data extraction failed";
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", uploadId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
