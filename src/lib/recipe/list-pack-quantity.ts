/**
 * Maps recipe {@link PantryCheckResult.quantity_to_buy} (amount in recipe units)
 * to shopping-list pack count. {@link addListItem} stores {@code quantity} as
 * number of packages, not grams/ml.
 */

import { parseAmountPerPack } from "@/lib/recipe/ingredient-matcher-pantry";
import type { PantryCheckResult } from "@/lib/recipe/types";

function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "").toLowerCase().trim();
}

/** Converts a numeric amount in {@code unit} to grams (mass) or milliliters (volume). */
export function recipeAmountToGramsOrMl(amount: number, unit: string | null | undefined): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const u = normalizeUnit(unit);
  if (!u) return null;
  if (u === "g" || u === "ml") return amount;
  if (u === "kg") return amount * 1000;
  if (u === "l" || u === "liter") return amount * 1000;
  if (u === "mg") return amount / 1000;
  if (u === "cl") return amount * 10;
  return null;
}

type UnitKind = "mass_volume" | "count" | "spoon" | "unknown";

function classifyUnit(unit: string | null | undefined): UnitKind {
  const u = normalizeUnit(unit);
  if (!u) return "unknown";
  if (u === "el" || u === "tl" || u === "prise" || u === "prise(n)" || u === "pinch") return "spoon";
  if (
    u === "g"
    || u === "kg"
    || u === "mg"
    || u === "ml"
    || u === "l"
    || u === "liter"
    || u === "cl"
  ) {
    return "mass_volume";
  }
  if (
    u.includes("stück")
    || u === "stk"
    || u === "stck"
    || u === "st"
    || u === "dose"
    || u.includes("dosen")
    || u === "bund"
    || u === "bündel"
    || u === "packung"
    || u === "pack"
    || u === "pck"
    || u === "pkg"
    || u === "flasche"
    || u.includes("flaschen")
    || u === "becher"
    || u === "tüte"
    || u.includes("tüten")
    || u === "scheibe"
    || u.includes("scheiben")
  ) {
    return "count";
  }
  return "unknown";
}

/**
 * Integer pack count for {@link addListItem} (min 1).
 * Uses {@link parseAmountPerPack} on the matched ALDI product for mass/volume units.
 */
export function quantityToBuyAsListPacks(r: PantryCheckResult): number {
  const qtyRaw = r.quantity_to_buy;
  if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) return 1;

  const unit = r.ingredient.unit;
  const kind = classifyUnit(unit);

  if (kind === "spoon") return 1;

  if (kind === "count") {
    return Math.max(1, Math.ceil(qtyRaw));
  }

  if (kind === "mass_volume") {
    const base = recipeAmountToGramsOrMl(qtyRaw, unit);
    if (base == null || base <= 0) return 1;
    const perPack = r.aldi_product
      ? parseAmountPerPack(r.aldi_product.weight_or_quantity ?? null)
      : null;
    if (perPack == null || perPack <= 0) return 1;
    return Math.max(1, Math.ceil(base / perPack));
  }

  return Math.max(1, Math.ceil(qtyRaw));
}
