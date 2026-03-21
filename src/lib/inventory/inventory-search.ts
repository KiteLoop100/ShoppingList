import type { InventoryItem } from "./inventory-types";

function bestBeforeSortKey(item: InventoryItem): number {
  if (!item.best_before) return Number.POSITIVE_INFINITY;
  const t = new Date(`${item.best_before}T00:00:00`).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function pickFefoFirst(candidates: InventoryItem[]): InventoryItem | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => bestBeforeSortKey(a) - bestBeforeSortKey(b),
  )[0] ?? null;
}

/**
 * Picks the inventory line after a barcode scan (FEFO: earliest best_before first, nulls last).
 * Ordering matches findInventoryItemByProductId (FEFO). Skips consumed rows.
 */
export function pickInventoryItemForBarcode(
  items: InventoryItem[],
  productId: string | null,
  competitorProductId: string | null,
): InventoryItem | null {
  if (productId) {
    const candidates = items.filter(
      (i) => i.status !== "consumed" && i.product_id === productId,
    );
    return pickFefoFirst(candidates);
  }
  if (competitorProductId) {
    const candidates = items.filter(
      (i) => i.status !== "consumed" && i.competitor_product_id === competitorProductId,
    );
    return pickFefoFirst(candidates);
  }
  return null;
}

/**
 * Filter inventory items by display_name substring match (case-insensitive).
 * Returns all items if query is empty/blank.
 */
export function filterInventoryByName(
  items: InventoryItem[],
  query: string,
): InventoryItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) =>
    item.display_name.toLowerCase().includes(trimmed),
  );
}
