/**
 * Pure helpers for recipe import Step 3 (ingredient review) confirm payload and counts.
 */

import type { MatchIngredientsGrouped, PantryCheckResult } from "./types";

export type OpenedPackReviewState = "unresolved" | "sufficient" | "buy";
export type SubstituteReviewState = "aldi" | "original";

export type PantryRowBucket = "av" | "buy" | "un" | "cf";

/** Stable key for a row within one API group (index + ingredient identity). */
export function makePantryRowKey(bucket: PantryRowBucket, index: number, r: PantryCheckResult): string {
  const ig = r.ingredient;
  return `${bucket}:${index}:${ig.name}:${ig.amount ?? "∅"}:${ig.unit ?? ""}`;
}

export function hasUnresolvedOpenedPacks(
  needs_confirmation: PantryCheckResult[],
  openedPack: Record<string, OpenedPackReviewState>,
): boolean {
  return needs_confirmation.some((r, i) => {
    const k = makePantryRowKey("cf", i, r);
    return openedPack[k] === "unresolved" || openedPack[k] === undefined;
  });
}

export function countShoppingListPreview(
  grouped: MatchIngredientsGrouped,
  openedPack: Record<string, OpenedPackReviewState>,
  substitute: Record<string, SubstituteReviewState>,
  buyInclude: Record<string, boolean>,
  unavailableFreeText: Record<string, boolean>,
): number {
  let n = 0;

  for (let i = 0; i < grouped.to_buy.length; i++) {
    const r = grouped.to_buy[i];
    const k = makePantryRowKey("buy", i, r);
    if (r.is_substitute) {
      if (substitute[k] !== "original") n += 1;
    } else if (buyInclude[k] !== false) {
      n += 1;
    }
  }

  for (let i = 0; i < grouped.needs_confirmation.length; i++) {
    const r = grouped.needs_confirmation[i];
    const k = makePantryRowKey("cf", i, r);
    if (openedPack[k] === "buy") n += 1;
  }

  for (let i = 0; i < grouped.unavailable.length; i++) {
    const r = grouped.unavailable[i];
    const k = makePantryRowKey("un", i, r);
    if (unavailableFreeText[k] === true) n += 1;
  }

  return n;
}

/**
 * Rows the parent should persist / add to the shopping list (with review_* flags set).
 */
export function buildReviewConfirmItems(
  grouped: MatchIngredientsGrouped,
  openedPack: Record<string, OpenedPackReviewState>,
  substitute: Record<string, SubstituteReviewState>,
  buyInclude: Record<string, boolean>,
  unavailableFreeText: Record<string, boolean>,
): PantryCheckResult[] {
  const out: PantryCheckResult[] = [];

  for (let i = 0; i < grouped.to_buy.length; i++) {
    const r = grouped.to_buy[i];
    const k = makePantryRowKey("buy", i, r);
    if (r.is_substitute) {
      const choice = substitute[k] ?? "aldi";
      out.push({
        ...r,
        review_substitute_choice: choice,
      });
    } else {
      const excluded = buyInclude[k] === false;
      if (!excluded) {
        out.push({ ...r, review_excluded_from_list: false });
      }
    }
  }

  for (let i = 0; i < grouped.needs_confirmation.length; i++) {
    const r = grouped.needs_confirmation[i];
    const k = makePantryRowKey("cf", i, r);
    if (openedPack[k] === "buy") {
      out.push({
        ...r,
        pantry_quantity_sufficient: false,
        quantity_to_buy: r.quantity_needed,
        review_excluded_from_list: false,
      });
    }
  }

  for (let i = 0; i < grouped.unavailable.length; i++) {
    const r = grouped.unavailable[i];
    const k = makePantryRowKey("un", i, r);
    if (unavailableFreeText[k] === true) {
      out.push({ ...r, review_add_free_text: true });
    }
  }

  return out;
}
