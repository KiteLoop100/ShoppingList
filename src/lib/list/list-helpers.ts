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
}

export interface ProductMetaForSort {
  demand_group: string | null;
  demand_sub_group: string | null;
  popularity_score: number | null;
}

/** Optional: category_id -> sort position (F05 aisle order). If not provided, uses category.default_sort_position. */
/** When productIdToSpecial and aktionsartikelCategory are set, items whose product is special use "Aktionsartikel" for grouping. */
export function sortAndGroupItems(
  items: LocalListItem[],
  categoryMap: Map<string, LocalCategory>,
  categoryOrder?: Map<string, number>,
  productIdToSpecial?: Set<string>,
  aktionsartikelCategory?: LocalCategory
): { unchecked: ListItemWithMeta[]; checked: ListItemWithMeta[] } {
  const withMeta: ListItemWithMeta[] = items.map((item) => {
    const effectiveCategoryId =
      item.product_id &&
      productIdToSpecial?.has(item.product_id) &&
      aktionsartikelCategory
        ? aktionsartikelCategory.category_id
        : item.category_id;
    const cat = categoryMap.get(effectiveCategoryId);
    const sortPos =
      categoryOrder?.get(effectiveCategoryId) ??
      cat?.default_sort_position ??
      999;
    return {
      ...item,
      category_name: cat?.name ?? "",
      category_icon: cat?.icon ?? "📦",
      category_sort_position: sortPos,
      price: null, // filled by caller from productPriceMap
    };
  });

  const unchecked = withMeta
    .filter((i) => !i.is_checked)
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

  return { unchecked, checked };
}

/**
 * F03 Modus 2: Sort and group by hierarchical order (Demand Group → Sub-Group → Product).
 */
export function sortAndGroupItemsHierarchical(
  items: LocalListItem[],
  categoryMap: Map<string, LocalCategory>,
  productMetaMap: Map<string, ProductMetaForSort>,
  order: HierarchicalOrderResult
): { unchecked: ListItemWithMeta[]; checked: ListItemWithMeta[] } {
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

  const AKTIONSCATEGORY_ID = "__aktionsartikel__";
  const withMeta: ListItemWithMeta[] = items.map((item) => {
    const catFromItem = categoryMap.get(item.category_id);
    const group = item.product_id
      ? (productMetaMap.get(item.product_id)?.demand_group ?? null)
      : null;
    const subgroup = item.product_id
      ? (productMetaMap.get(item.product_id)?.demand_sub_group ?? null)
      : null;
    const demand_group = group ?? catFromItem?.name ?? "";
    const demand_sub_group = subgroup ?? "";
    const scope = demand_sub_group ? `${demand_group}|${demand_sub_group}` : demand_group;
    const gr = groupRank.get(demand_group) ?? 999;
    const sr = subgroupRank.get(`${demand_group}\t${demand_sub_group}`) ?? 999;
    const pr = item.product_id
      ? productRank.get(`${scope}\t${item.product_id}`) ?? 999
      : item.sort_position;
    const effectiveCategoryId =
      demand_group === "Aktionsartikel" ? AKTIONSCATEGORY_ID : item.category_id;
    const cat = categoryMap.get(effectiveCategoryId) ?? catFromItem;
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

  const unchecked = withMeta
    .filter((i) => !i.is_checked)
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
  return { unchecked, checked };
}

export function assignPrices(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productPriceMap: Map<string, number>
): void {
  const assign = (item: ListItemWithMeta) => {
    if (item.product_id) {
      const p = productPriceMap.get(item.product_id);
      if (p !== undefined) item.price = p;
    }
  };
  unchecked.forEach(assign);
  checked.forEach(assign);
}

export function assignThumbnails(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productThumbnailMap: Map<string, string>
): void {
  const assign = (item: ListItemWithMeta) => {
    if (item.product_id) {
      const url = productThumbnailMap.get(item.product_id);
      if (url) item.thumbnail_url = url;
    }
  };
  unchecked.forEach(assign);
  checked.forEach(assign);
}

export function assignHasAdditionalInfo(
  unchecked: ListItemWithMeta[],
  checked: ListItemWithMeta[],
  productIdsWithAdditionalInfo: Set<string>
): void {
  const assign = (item: ListItemWithMeta) => {
    if (item.product_id && productIdsWithAdditionalInfo.has(item.product_id)) {
      item.has_additional_info = true;
    }
  };
  unchecked.forEach(assign);
  checked.forEach(assign);
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
