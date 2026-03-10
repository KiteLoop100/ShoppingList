/**
 * Stage 2: Extract comprehensive product information from multiple photos.
 * Sends all photos in a single Claude Sonnet call, treating them as
 * different views of the same product. Combines with ZBar barcode results.
 */

import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { decodeEanFromImageBuffer } from "@/lib/barcode-from-image";
import { extractCompetitorProductPrompt } from "./prompts";
import { buildImageContent } from "./build-image-content";
import type { PhotoInput, ExtractedCompetitorProductInfo, NutritionInfo } from "./types";
import { log } from "@/lib/utils/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadDemandGroups, loadDemandSubGroups, buildDemandGroupsAndSubGroupsPrompt } from "@/lib/categories/constants";

const NUTRI_SCORE_VALUES = new Set(["A", "B", "C", "D", "E"]);

export async function scanBarcodesFromAll(
  images: PhotoInput[],
): Promise<Array<string | null>> {
  return Promise.all(
    images.map(async (img, idx) => {
      try {
        return await decodeEanFromImageBuffer(img.buffer);
      } catch (err) {
        log.warn(`[photo-studio] barcode scan failed for image ${idx}:`, err instanceof Error ? err.message : err);
        return null;
      }
    }),
  );
}

function sanitizeNutrition(raw: unknown): NutritionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  const result: NutritionInfo = {
    energy_kcal: typeof n.energy_kcal === "number" ? n.energy_kcal : null,
    fat: typeof n.fat === "number" ? n.fat : null,
    saturated_fat: typeof n.saturated_fat === "number" ? n.saturated_fat : null,
    carbs: typeof n.carbs === "number" ? n.carbs : null,
    sugar: typeof n.sugar === "number" ? n.sugar : null,
    fiber: typeof n.fiber === "number" ? n.fiber : null,
    protein: typeof n.protein === "number" ? n.protein : null,
    salt: typeof n.salt === "number" ? n.salt : null,
  };
  const hasAny = Object.values(result).some((v) => v !== null);
  return hasAny ? result : null;
}

function sanitizeExtracted(
  raw: Record<string, unknown>,
  scannedEan: string | null,
): ExtractedCompetitorProductInfo {
  const ns = raw.nutri_score;
  const nutri =
    typeof ns === "string" && NUTRI_SCORE_VALUES.has(ns.toUpperCase())
      ? (ns.toUpperCase() as ExtractedCompetitorProductInfo["nutri_score"])
      : null;

  return {
    name: raw.name != null ? String(raw.name) : null,
    brand: raw.brand != null ? String(raw.brand) : null,
    ean_barcode: scannedEan ?? (raw.ean_barcode != null ? String(raw.ean_barcode) : null),
    article_number: raw.article_number != null ? String(raw.article_number) : null,
    price: typeof raw.price === "number" ? raw.price : null,
    retailer_from_price_tag:
      raw.retailer_from_price_tag != null ? String(raw.retailer_from_price_tag) : null,
    unit_price: raw.unit_price != null ? String(raw.unit_price) : null,
    weight_or_quantity: raw.weight_or_quantity != null ? String(raw.weight_or_quantity) : null,
    ingredients: raw.ingredients != null ? String(raw.ingredients) : null,
    nutrition_info: sanitizeNutrition(raw.nutrition_info),
    allergens: raw.allergens != null ? String(raw.allergens) : null,
    nutri_score: nutri,
    is_bio: raw.is_bio === true,
    is_vegan: raw.is_vegan === true,
    is_gluten_free: raw.is_gluten_free === true,
    is_lactose_free: raw.is_lactose_free === true,
    animal_welfare_level:
      typeof raw.animal_welfare_level === "number" ? raw.animal_welfare_level : null,
    country_of_origin:
      raw.country_of_origin != null ? String(raw.country_of_origin) : null,
  };
}

export async function extractProductInfo(
  images: PhotoInput[],
  scannedEan: string | null,
): Promise<ExtractedCompetitorProductInfo> {
  try {
    const supabase = createAdminClient();
    if (!supabase) throw new Error("Supabase admin client not configured");
    const [groups, subGroups] = await Promise.all([
      loadDemandGroups(supabase),
      loadDemandSubGroups(supabase),
    ]);
    const demandGroupsBlock = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);
    const prompt = extractCompetitorProductPrompt(images.length, scannedEan, demandGroupsBlock);
    const result = await callClaudeJSON<Record<string, unknown>>({
      model: CLAUDE_MODEL_SONNET,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildImageContent(images, prompt) }],
    });

    return sanitizeExtracted(result, scannedEan);
  } catch (err) {
    log.error("[photo-studio] extraction failed:", err);
    throw err;
  }
}
