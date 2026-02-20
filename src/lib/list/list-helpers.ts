/**
 * Sort and group list items by category; compute estimated total.
 */

import type { LocalListItem, LocalCategory } from "@/lib/db";

export interface ListItemWithMeta extends LocalListItem {
  category_name: string;
  category_icon: string;
  category_sort_position: number;
  price: number | null;
}

/** Optional: category_id -> sort position (F05 aisle order). If not provided, uses category.default_sort_position. */
export function sortAndGroupItems(
  items: LocalListItem[],
  categoryMap: Map<string, LocalCategory>,
  categoryOrder?: Map<string, number>
): { unchecked: ListItemWithMeta[]; checked: ListItemWithMeta[] } {
  const withMeta: ListItemWithMeta[] = items.map((item) => {
    const cat = categoryMap.get(item.category_id);
    const sortPos =
      categoryOrder?.get(item.category_id) ??
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
