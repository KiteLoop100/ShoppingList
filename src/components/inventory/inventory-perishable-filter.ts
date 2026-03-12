import { getCategoryGroup, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

export const PERISHABLE_DAYS: Partial<Record<CategoryGroupKey, number>> = {
  produce: 10,
  chilled: 14,
};

const MS_PER_DAY = 86_400_000;

/**
 * Filters out perishable inventory items whose updated_at exceeds
 * the category-specific shelf life. Dry/frozen items are never filtered.
 *
 * Uses updated_at (not added_at) because it reflects the last meaningful
 * interaction: restocking via receipt, quantity change, or opening.
 */
export function filterExpiredPerishables(items: InventoryItem[]): InventoryItem[] {
  const now = Date.now();
  return items.filter((item) => {
    if (item.is_frozen) return true;
    const group = getCategoryGroup(item.demand_group_code);
    const maxDays = PERISHABLE_DAYS[group];
    if (!maxDays) return true;
    const age = now - new Date(item.updated_at).getTime();
    return age <= maxDays * MS_PER_DAY;
  });
}
