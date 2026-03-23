/**
 * Scale recipe ingredient amounts when the user changes portion count.
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Section 2.5
 */

import type { RecipeIngredient } from "@/lib/recipe/types";

function normalizeUnitKey(unit: string | null): string {
  return (unit ?? "").trim().toLowerCase();
}

/** Units that should not be scaled (pinch amounts). */
function isNoScaleUnit(u: string): boolean {
  return u === "prise" || u === "msp" || u.includes("messerspitze");
}

/** Count-like units: round to whole pieces, minimum 1. */
function isPieceLikeUnit(u: string): boolean {
  const piece = ["stk", "stück", "stueck", "zehe", "scheibe", "dose", "bund", "pkg", "becher"];
  return piece.some((p) => u === p || u.startsWith(p + ".") || u === p);
}

function roundGrams(g: number): number {
  if (g > 200) return Math.round(g / 10) * 10;
  if (g >= 50) return Math.round(g / 5) * 5;
  return Math.round(g);
}

function roundMl(ml: number): number {
  if (ml > 200) return Math.round(ml / 10) * 10;
  if (ml >= 50) return Math.round(ml / 5) * 5;
  return Math.round(ml);
}

function roundElTl(x: number): number {
  const rounded = Math.round(x * 2) / 2;
  return Math.max(0.5, rounded);
}

function scaleAmount(amount: number, factor: number, unit: string | null): number {
  const u = normalizeUnitKey(unit);

  if (isNoScaleUnit(u)) {
    return amount;
  }

  const scaled = amount * factor;

  if (isPieceLikeUnit(u)) {
    return Math.max(1, Math.round(scaled));
  }

  if (u === "g") {
    return roundGrams(scaled);
  }

  if (u === "kg") {
    const grams = scaled * 1000;
    const rg = roundGrams(grams);
    return rg / 1000;
  }

  if (u === "ml") {
    return roundMl(scaled);
  }

  if (u === "l") {
    const mlVal = scaled * 1000;
    const rml = roundMl(mlVal);
    return rml / 1000;
  }

  if (u === "el" || u === "tl") {
    return roundElTl(scaled);
  }

  return Math.round(scaled * 100) / 100;
}

export function scaleIngredients(
  ingredients: RecipeIngredient[],
  originalServings: number,
  targetServings: number,
): RecipeIngredient[] {
  if (originalServings <= 0 || targetServings <= 0) {
    return ingredients.map((ing) => ({ ...ing }));
  }

  const factor = targetServings / originalServings;

  return ingredients.map((ing) => {
    if (ing.amount === null) {
      return { ...ing };
    }
    const u = normalizeUnitKey(ing.unit);
    if (isNoScaleUnit(u)) {
      return { ...ing };
    }
    const nextAmount = scaleAmount(ing.amount, factor, ing.unit);
    return {
      ...ing,
      amount: nextAmount,
    };
  });
}
