/**
 * Pantry comparison for matched recipe ingredients.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import { loadInventory } from "@/lib/inventory/inventory-service";
import type { IngredientMatch, PantryCheckResult, RecipeIngredient } from "./types";

export function quantityNeeded(ing: RecipeIngredient): number {
  if (ing.amount === null) return 0;
  return ing.amount;
}

/** Best-effort grams (or ml as same numeric) per pack from product label text. */
export function parseAmountPerPack(weightOrQuantity: string | null | undefined): number | null {
  if (!weightOrQuantity) return null;
  const s = weightOrQuantity.trim();
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|L)\b/i);
  if (!m) return null;
  const num = Number.parseFloat(m[1].replace(",", "."));
  if (Number.isNaN(num)) return null;
  const u = m[2].toLowerCase();
  if (u === "kg") return num * 1000;
  if (u === "l") return num * 1000;
  return num;
}

function sealedPantryCoversNeed(
  ing: RecipeIngredient,
  product: Product | null,
  quantityInPantryPacks: number,
): { sufficient: boolean | null } {
  const need = quantityNeeded(ing);
  if (need <= 0) return { sufficient: true };
  const unit = (ing.unit ?? "").toLowerCase();
  if (unit.includes("stück") || unit === "stk" || unit === "stck" || unit === "st") {
    return { sufficient: quantityInPantryPacks >= need };
  }
  if (unit === "g" || unit === "ml" || unit === "kg" || unit === "l") {
    const perPack = parseAmountPerPack(product?.weight_or_quantity ?? null);
    if (perPack == null || perPack <= 0) return { sufficient: null };
    const total = quantityInPantryPacks * perPack;
    return { sufficient: total >= need };
  }
  return { sufficient: null };
}

/**
 * Enriches matches with pantry data from {@link loadInventory}.
 */
export async function checkPantry(
  supabase: SupabaseClient,
  matches: IngredientMatch[],
  userId: string,
): Promise<PantryCheckResult[]> {
  const inventory = await loadInventory(supabase, userId);
  const byProduct = new Map<string, typeof inventory>();
  for (const item of inventory) {
    if (!item.product_id) continue;
    const list = byProduct.get(item.product_id) ?? [];
    list.push(item);
    byProduct.set(item.product_id, list);
  }

  return matches.map((m) => {
    const need = quantityNeeded(m.ingredient);
    const base: PantryCheckResult = {
      ...m,
      in_pantry: false,
      pantry_status: "not_present",
      pantry_quantity_sufficient: false,
      quantity_needed: need,
      quantity_to_buy: need,
    };

    if (m.ingredient.amount === null) {
      return {
        ...base,
        in_pantry: true,
        pantry_status: "sealed",
        pantry_quantity_sufficient: true,
        quantity_to_buy: 0,
        quantity_in_pantry: undefined,
      };
    }

    if (m.match_tier === 4 || !m.aldi_product) {
      return base;
    }

    const pid = m.aldi_product.product_id;
    const items = byProduct.get(pid) ?? [];
    if (items.length === 0) {
      return base;
    }

    const quantityInPacks = items.reduce((s, it) => s + it.quantity, 0);
    const hasOpened = items.some((it) => it.status === "opened");
    const status = hasOpened ? "opened" : "sealed";

    if (status === "opened") {
      return {
        ...base,
        in_pantry: true,
        pantry_status: "opened",
        pantry_quantity_sufficient: null,
        quantity_in_pantry: quantityInPacks,
        quantity_to_buy: need,
      };
    }

    const { sufficient } = sealedPantryCoversNeed(m.ingredient, m.aldi_product, quantityInPacks);
    if (sufficient === true) {
      return {
        ...base,
        in_pantry: true,
        pantry_status: "sealed",
        pantry_quantity_sufficient: true,
        quantity_in_pantry: quantityInPacks,
        quantity_to_buy: 0,
      };
    }
    if (sufficient === false) {
      const unit = (m.ingredient.unit ?? "").toLowerCase();
      let toBuy = need;
      if (unit.includes("stück") || unit === "stk" || unit === "stck" || unit === "st") {
        toBuy = Math.max(0, need - quantityInPacks);
      } else {
        const perPack = parseAmountPerPack(m.aldi_product.weight_or_quantity ?? null);
        if (perPack != null && perPack > 0) {
          const have = quantityInPacks * perPack;
          toBuy = Math.max(0, need - have);
        }
      }
      return {
        ...base,
        in_pantry: true,
        pantry_status: "sealed",
        pantry_quantity_sufficient: false,
        quantity_in_pantry: quantityInPacks,
        quantity_to_buy: toBuy,
      };
    }

    return {
      ...base,
      in_pantry: true,
      pantry_status: "sealed",
      pantry_quantity_sufficient: null,
      quantity_in_pantry: quantityInPacks,
      quantity_to_buy: need,
    };
  });
}
