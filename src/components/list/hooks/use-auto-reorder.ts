"use client";

import { addListItem, updateListItem } from "@/lib/list";
import { type AutoReorderSetting } from "@/lib/list/auto-reorder-service";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";
import type { LocalListItem, LocalShoppingList } from "@/lib/db";
import type { AssortmentType, DemandGroup, Product } from "@/types";
import {
  computeActivationTime,
  getSpecialActivationCalendarDate,
} from "@/lib/list/special-activation";

// ─── Pure helpers ─────────────────────────────────────────────────────

export function isDeferredSpecial(
  assortmentType: AssortmentType | string | undefined,
  specialStartDate: string | null | undefined,
  country: string
): boolean {
  if (
    assortmentType !== "special" &&
    assortmentType !== "special_food" &&
    assortmentType !== "special_nonfood"
  ) return false;
  if (!specialStartDate) return false;
  const activationMs = computeActivationTime(specialStartDate, country);
  return Date.now() < activationMs;
}

export function computeReorderActivationDate(
  lastCheckedAt: string,
  value: number,
  unit: "days" | "weeks" | "months"
): string {
  const d = new Date(lastCheckedAt);
  if (unit === "days") d.setDate(d.getDate() + value);
  else if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d.toISOString().slice(0, 10);
}

// ─── Auto-reorder processing ─────────────────────────────────────────

export async function processAutoReorder(
  items: LocalListItem[],
  reorderMap: Map<string, AutoReorderSetting>,
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>,
  idbProducts: Product[],
  contextProducts: Product[],
  list: LocalShoppingList,
  demandGroupMap: Map<string, DemandGroup>,
  todayStr: string,
): Promise<void> {
  for (const item of items) {
    if (item.buy_elsewhere_retailer) {
      (item as ListItemWithMeta).is_deferred = true;
      (item as ListItemWithMeta).deferred_reason = "elsewhere";
      (item as ListItemWithMeta).is_buy_elsewhere = true;
      (item as ListItemWithMeta).buy_elsewhere_retailer = item.buy_elsewhere_retailer;
      (item as ListItemWithMeta).competitor_product_id = item.competitor_product_id ?? null;
      continue;
    }
    if (item.deferred_until && item.deferred_until !== "next_trip") {
      if (item.deferred_until > todayStr) {
        (item as ListItemWithMeta).is_deferred = true;
        (item as ListItemWithMeta).available_from = item.deferred_until;
        (item as ListItemWithMeta).deferred_reason = "manual";
      } else {
        updateListItem(item.item_id, { deferred_until: null }).catch(() => {});
      }
    } else if (item.deferred_until === "next_trip") {
      (item as ListItemWithMeta).is_deferred = true;
      (item as ListItemWithMeta).available_from = item.deferred_until;
      (item as ListItemWithMeta).deferred_reason = "manual";
    }
    if (!item.product_id) continue;
    if (reorderMap.has(item.product_id)) {
      (item as ListItemWithMeta).has_auto_reorder = true;
    }
    if (!(item as ListItemWithMeta).is_deferred) {
      const info = productDeferredInfo.get(item.product_id);
      const saleStart = info?.special_start_date;
      if (
        info &&
        saleStart &&
        isDeferredSpecial(info.assortment_type, saleStart, info.country)
      ) {
        (item as ListItemWithMeta).is_deferred = true;
        (item as ListItemWithMeta).available_from =
          getSpecialActivationCalendarDate(saleStart) ?? saleStart;
        (item as ListItemWithMeta).deferred_reason = "special";
      }
    }
  }

  const existingProductIds = new Set(items.filter((i) => i.product_id).map((i) => i.product_id!));

  for (const [productId, setting] of reorderMap) {
    if (existingProductIds.has(productId)) continue;
    if (!setting.last_checked_at) continue;

    const activationDate = computeReorderActivationDate(
      setting.last_checked_at,
      setting.reorder_value,
      setting.reorder_unit
    );

    const product = idbProducts.find((p) => p.product_id === productId)
      ?? contextProducts.find((p) => p.product_id === productId);
    if (!product) continue;

    if (activationDate <= todayStr) {
      await addListItem({
        list_id: list.list_id,
        product_id: productId,
        custom_name: null,
        display_name: product.name,
        demand_group_code: product.demand_group_code,
        quantity: 1,
      });
    } else {
      const dg = demandGroupMap.get(product.demand_group_code);
      items.push({
        item_id: `reorder-${productId}`,
        list_id: list.list_id,
        product_id: productId,
        custom_name: null,
        display_name: product.name,
        quantity: 1,
        is_checked: false,
        checked_at: null,
        sort_position: 999,
        demand_group_code: product.demand_group_code,
        added_at: new Date().toISOString(),
        is_deferred: true,
        available_from: activationDate,
        deferred_reason: "reorder",
        category_name: dg?.name ?? "",
        category_icon: dg?.icon ?? "📦",
        category_sort_position: dg?.sort_position ?? 999,
        price: null,
      } as ListItemWithMeta & { is_deferred: boolean; available_from: string; deferred_reason: "reorder" });
    }
  }
}
