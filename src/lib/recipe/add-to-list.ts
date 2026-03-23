/**
 * Add recipe import review (Step 3) selections to the active shopping list using
 * {@link addListItem} from @/lib/list (single source of truth for list_items writes).
 */

import { assignDemandGroup } from "@/lib/category/assign-category";
import { addListItem, getListItems, type AddItemParams } from "@/lib/list";
import { quantityToBuyAsListPacks } from "@/lib/recipe/list-pack-quantity";
import type { PantryCheckResult } from "@/lib/recipe/types";

export interface AddToListResult {
  added_count: number;
  increased_count: number;
  skipped_count: number;
  items_added: { name: string; quantity: string }[];
}

function formatPackQtyLabel(packs: number): string {
  const n = Math.max(1, Math.floor(packs));
  return n === 1 ? "1×" : `${n}×`;
}

function wantsFreeTextRow(r: PantryCheckResult): boolean {
  return r.review_add_free_text === true || r.review_substitute_choice === "original";
}

function shouldUseAldiProduct(r: PantryCheckResult): boolean {
  if (wantsFreeTextRow(r)) return false;
  return r.aldi_product != null;
}

/**
 * Applies confirmed recipe rows to the given list. Uses {@link addListItem} so merge
 * rules (dedupe by product + retailer / free-text display name) stay consistent.
 */
export async function addRecipeIngredientsToList(
  items: PantryCheckResult[],
  listId: string,
): Promise<AddToListResult> {
  let added_count = 0;
  let increased_count = 0;
  let skipped_count = 0;
  const items_added: { name: string; quantity: string }[] = [];

  for (const r of items) {
    if (r.review_excluded_from_list === true) {
      skipped_count += 1;
      continue;
    }

    const wantsFree = wantsFreeTextRow(r);
    const useAldi = shouldUseAldiProduct(r);

    if (!wantsFree && !useAldi) {
      skipped_count += 1;
      continue;
    }

    const qtyRaw = wantsFree && r.quantity_to_buy <= 0 ? 1 : r.quantity_to_buy;
    if (!wantsFree && qtyRaw <= 0) {
      skipped_count += 1;
      continue;
    }

    const qty = quantityToBuyAsListPacks({ ...r, quantity_to_buy: qtyRaw });

    let params: AddItemParams | null = null;
    let displayNameForLog = "";

    if (wantsFree) {
      const name = r.ingredient.name.trim() || "—";
      displayNameForLog = name;
      const { demand_group_code } = await assignDemandGroup(name);
      params = {
        list_id: listId,
        product_id: null,
        custom_name: name,
        display_name: name,
        demand_group_code,
        quantity: qty,
        buy_elsewhere_retailer: null,
      };
    } else if (r.aldi_product) {
      const p = r.aldi_product;
      displayNameForLog = p.name;
      params = {
        list_id: listId,
        product_id: p.product_id,
        custom_name: null,
        display_name: p.name,
        demand_group_code: p.demand_group_code,
        quantity: qty,
        buy_elsewhere_retailer: null,
      };
    }

    if (!params) {
      skipped_count += 1;
      continue;
    }

    const uncheckedIds = new Set(
      (await getListItems(listId))
        .filter((i) => !i.is_checked)
        .map((i) => i.item_id),
    );

    const result = await addListItem(params);

    if (uncheckedIds.has(result.item_id)) {
      increased_count += 1;
    } else {
      added_count += 1;
    }

    items_added.push({
      name: displayNameForLog,
      quantity: formatPackQtyLabel(qty),
    });
  }

  return {
    added_count,
    increased_count,
    skipped_count,
    items_added,
  };
}

/**
 * Adds missing ingredients from cook-chat (no import-review flags). Uses
 * {@link addListItem} for each row with {@link PantryCheckResult.quantity_to_buy} &gt; 0.
 */
export async function addCookChatMissingIngredientsToList(
  items: PantryCheckResult[],
  listId: string,
): Promise<AddToListResult> {
  let added_count = 0;
  let increased_count = 0;
  let skipped_count = 0;
  const items_added: { name: string; quantity: string }[] = [];

  for (const r of items) {
    if (r.quantity_to_buy <= 0) {
      skipped_count += 1;
      continue;
    }

    const qtyRaw = r.quantity_to_buy;
    const qty = quantityToBuyAsListPacks({ ...r, quantity_to_buy: qtyRaw });

    let params: AddItemParams | null = null;
    let displayNameForLog = "";

    if (r.aldi_product) {
      const p = r.aldi_product;
      displayNameForLog = p.name;
      params = {
        list_id: listId,
        product_id: p.product_id,
        custom_name: null,
        display_name: p.name,
        demand_group_code: p.demand_group_code,
        quantity: qty,
        buy_elsewhere_retailer: null,
      };
    } else {
      const name = r.ingredient.name.trim() || "—";
      displayNameForLog = name;
      const { demand_group_code } = await assignDemandGroup(name);
      params = {
        list_id: listId,
        product_id: null,
        custom_name: name,
        display_name: name,
        demand_group_code,
        quantity: qty,
        buy_elsewhere_retailer: null,
      };
    }

    if (!params) {
      skipped_count += 1;
      continue;
    }

    const uncheckedIds = new Set(
      (await getListItems(listId))
        .filter((i) => !i.is_checked)
        .map((i) => i.item_id),
    );

    const result = await addListItem(params);

    if (uncheckedIds.has(result.item_id)) {
      increased_count += 1;
    } else {
      added_count += 1;
    }

    items_added.push({
      name: displayNameForLog,
      quantity: formatPackQtyLabel(qty),
    });
  }

  return {
    added_count,
    increased_count,
    skipped_count,
    items_added,
  };
}
