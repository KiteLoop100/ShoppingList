import { getCategoryGroup, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

export const PERISHABLE_DAYS: Partial<Record<CategoryGroupKey, number>> = {
  produce: 10,
  chilled: 14,
};

const MS_PER_DAY = 86_400_000;
const MAX_OVERDUE_DAYS = 3;

/**
 * Filters out expired perishable inventory items.
 *
 * When best_before is set: filters items whose best_before is more than
 * MAX_OVERDUE_DAYS in the past (gives a grace period after expiry).
 *
 * When best_before is not set: falls back to category-based shelf life
 * using updated_at, which reflects the last meaningful interaction.
 *
 * Frozen items are never filtered.
 */
export function filterExpiredPerishables(items: InventoryItem[]): InventoryItem[] {
  const now = Date.now();
  return items.filter((item) => {
    if (item.is_frozen) return true;

    if (item.best_before) {
      const bbMs = new Date(item.best_before + "T00:00:00").getTime();
      if (isNaN(bbMs)) return true;
      const overdueDays = (now - bbMs) / MS_PER_DAY;
      return overdueDays <= MAX_OVERDUE_DAYS;
    }

    const group = getCategoryGroup(item.demand_group_code);
    const maxDays = PERISHABLE_DAYS[group];
    if (!maxDays) return true;
    const age = now - new Date(item.updated_at).getTime();
    return age <= maxDays * MS_PER_DAY;
  });
}
