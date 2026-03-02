/**
 * Sort and group list items by category; compute estimated total.
 * F03 Modus 2: hierarchical sort uses group_rank, subgroup_rank, product_rank.
 */

import type { LocalListItem, LocalCategory } from "@/lib/db";
import type { HierarchicalOrderResult } from "@/lib/store/hierarchical-order";

export interface ListItemWithMeta extends LocalListItem {
  category_name: string;
  category_icon: string;
  category_sort_position: number;
  price: number | null;
  /** Product thumbnail URL (from products.thumbnail_url). */
  thumbnail_url?: string | null;
  /** True if product has additional info (brand, nutrition, ingredients, etc.) to show in detail modal. */
  has_additional_info?: boolean;
  /** F03 Modus 2: demand group (from product or category name). */
  demand_group?: string;
  /** F03 Modus 2: demand sub-group (from product). */
  demand_sub_group?: string;
  /** F03 Modus 2: rank for hierarchical sort. */
  group_rank?: number;
  subgroup_rank?: number;
  product_rank?: number;
  /** True if this product has an active auto-reorder setting. */
  has_auto_reorder?: boolean;
  /** Deferred item: product not yet actionable (special not yet in store, or auto-reorder countdown). */
  is_deferred?: boolean;
  /** ISO date string when this deferred product becomes available/active. */
  available_from?: string | null;
  /** Reason for deferral: 'special' = upcoming promotion, 'reorder' = auto-reorder countdown, 'manual' = user swiped "Nächster Einkauf", 'elsewhere' = buy at another retailer. */
  deferred_reason?: "special" | "reorder" | "manual" | "elsewhere";
  /** F26: true if this item is assigned to another retailer. */
  is_buy_elsewhere?: boolean;
  /** F26: retailer name (e.g. "REWE", "EDEKA") if buy-elsewhere. */
  buy_elsewhere_retailer?: string | null;
  /** B4: reference to competitor_products.product_id if linked. */
  competitor_product_id?: string | null;
  /** B4: latest price at the assigned retailer (populated from competitor_product_prices). */
  competitor_price?: number | null;
  /** B4: competitor product thumbnail URL. */
  competitor_thumbnail_url?: string | null;
  /** B4: competitor product brand name. */
  competitor_brand?: string | null;
}

export interface SortResult {
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
}

/** Virtual demand group for active promotional items (assortment_type = special/special_food/special_nonfood). */
export const VIRTUAL_GROUP_AKTIONSARTIKEL = "AK-Aktionsartikel";

export interface ProductMetaForSort {
  demand_group: string | null;
  demand_sub_group: string | null;
  popularity_score: number | null;
  /** True if product is a special/promotional item (assortment_type special, special_food, or special_nonfood). */
  is_special?: boolean;
}

export function sortAndGroupItems(
  items: LocalListItem[],
  categoryMap: Map<string, LocalCategory>,
  categoryOrder?: Map<string, number>,
  productMetaMap?: Map<string, ProductMetaForSort>,
): SortResult {
  const withMeta: ListItemWithMeta[] = items.map((item) => {
    const cat = categoryMap.get(item.category_id);
    const sortPos =
      categoryOrder?.get(item.category_id) ??
      cat?.default_sort_position ??
      999;
    const meta = productMetaMap && item.product_id
      ? productMetaMap.get(item.product_id)
      : null;
    return {
      ...item,
      category_name: cat?.name ?? "",
      category_icon: cat?.icon ?? "📦",
      category_sort_position: sortPos,
      demand_group: meta?.demand_group ?? undefined,
      price: null,
    };
  });

  const deferred = withMeta
    .filter((i) => !i.is_checked && i.is_deferred)
    .sort((a, b) =>
      (a.available_from ?? "").localeCompare(b.available_from ?? "") ||
      a.sort_position - b.sort_position
    );
  const unchecked = withMeta
    .filter((i) => !i.is_checked && !i.is_deferred)
    .sort(
      (a, b) =>
        a.category_sort_position - b.category_sort_position ||
        a.sort_position - b.sort_position
    );
  const checked = withMeta
    .filter((i) => i.is_checked)
    .sort(
      (a, b) =>
        (a.checked_at ?? "").localeCompare(b.checked_at ?? "") ||
        a.sort_position - b.sort_position
    );

  return { unchecked, checked, deferred };
}

/**
 * F03 Modus 2: Sort and group by hierarchical order (Demand Group → Sub-Group → Product).
 */
export function sortAndGroupItemsHierarchical(
  items: LocalListItem[],
  categoryMap: Map<string, LocalCategory>,
  productMetaMap: Map<string, ProductMetaForSort>,
  order: HierarchicalOrderResult
): SortResult {
  const { groupOrder, subgroupOrder, productOrder } = order;
  const groupRank = new Map<string, number>();
  groupOrder.forEach((g, i) => groupRank.set(g, i));
  const subgroupRank = new Map<string, number>();
  subgroupOrder.forEach((order, g) =>
    order.forEach((sg, i) => subgroupRank.set(`${g}\t${sg}`, i))
  );
  const productRank = new Map<string, number>();
  productOrder.forEach((order, scope) =>
    order.forEach((pid, i) => productRank.set(`${scope}\t${pid}`, i))
  );

  const withMeta: ListItemWithMeta[] = items.map((item) => {
    const cat = categoryMap.get(item.category_id);
    const meta = item.product_id ? productMetaMap.get(item.product_id) : null;
    const group = meta?.demand_group ?? null;
    const subgroup = meta?.demand_sub_group ?? null;
    const isSpecialActive = meta?.is_special && !(item as ListItemWithMeta).is_deferred;
    const demand_group = isSpecialActive
      ? VIRTUAL_GROUP_AKTIONSARTIKEL
      : (group ?? cat?.name ?? "");
    const demand_sub_group = isSpecialActive ? "" : (subgroup ?? "");
    const scope = demand_sub_group ? `${demand_group}|${demand_sub_group}` : demand_group;
    const gr = groupRank.get(demand_group) ?? 999;
    const sr = subgroupRank.get(`${demand_group}\t${demand_sub_group}`) ?? 999;
    const pr = item.product_id
      ? productRank.get(`${scope}\t${item.product_id}`) ?? 999
      : item.sort_position;
    return {
      ...item,
      category_name: cat?.name ?? "",
      category_icon: cat?.icon ?? "📦",
      category_sort_position: gr,
      demand_group,
      demand_sub_group,
      group_rank: gr,
      subgroup_rank: sr,
      product_rank: pr,
      price: null,
    };
  });

  const deferred = withMeta
    .filter((i) => !i.is_checked && i.is_deferred)
    .sort((a, b) =>
      (a.available_from ?? "").localeCompare(b.available_from ?? "") ||
      a.sort_position - b.sort_position
    );
  const unchecked = withMeta
    .filter((i) => !i.is_checked && !i.is_deferred)
    .sort(
      (a, b) =>
        (a.group_rank ?? 999) - (b.group_rank ?? 999) ||
        (a.subgroup_rank ?? 999) - (b.subgroup_rank ?? 999) ||
        (a.product_rank ?? 999) - (b.product_rank ?? 999) ||
        a.sort_position - b.sort_position
    );
  const checked = withMeta
    .filter((i) => i.is_checked)
    .sort(
      (a, b) =>
        (a.checked_at ?? "").localeCompare(b.checked_at ?? "") ||
        a.sort_position - b.sort_position
    );
  return { unchecked, checked, deferred };
}

function applyToAllLists<T>(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  dataMap: Map<string, T>,
  deferred: ListItemWithMeta[] | undefined,
  applyFn: (item: ListItemWithMeta, value: T) => void
): void {
  for (const list of [unchecked, checked, ...(deferred ? [deferred] : [])]) {
    for (const item of list) {
      if (item.product_id && dataMap.has(item.product_id)) {
        applyFn(item, dataMap.get(item.product_id)!);
      }
    }
  }
}

export function assignPrices(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productPriceMap: Map<string, number>,
  deferred?: ListItemWithMeta[]
): void {
  applyToAllLists(unchecked, checked, productPriceMap, deferred, (item, price) => {
    item.price = price;
  });
}

export function assignThumbnails(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productThumbnailMap: Map<string, string>,
  deferred?: ListItemWithMeta[]
): void {
  applyToAllLists(unchecked, checked, productThumbnailMap, deferred, (item, url) => {
    item.thumbnail_url = url;
  });
}

export function assignHasAdditionalInfo(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productIdsWithAdditionalInfo: Set<string>,
  deferred?: ListItemWithMeta[]
): void {
  const infoMap = new Map<string, true>(
    [...productIdsWithAdditionalInfo].map((id) => [id, true])
  );
  applyToAllLists(unchecked, checked, infoMap, deferred, (item) => {
    item.has_additional_info = true;
  });
}

export function estimateTotal(items: ListItemWithMeta[]): {
  total: number;
  withoutPriceCount: number;
} {
  let total = 0;
  let withoutPriceCount = 0;
  for (const item of items) {
    if (item.price != null) {
      total += item.price * item.quantity;
    } else {
      withoutPriceCount += 1;
    }
  }
  return { total, withoutPriceCount };
}
