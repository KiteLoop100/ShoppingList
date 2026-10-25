import { getCategoryGroup, type CategoryGroupKey } from "@/lib/list/recent-purchase-categories";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

export const PERISHABLE_DAYS: Partial<Record<CategoryGroupKey, number>> = {
  produce: 10,
  chilled: 14,
};

const MS_PER_DAY = 86_400_000;
const MAX_OVERDUE_DAYS = 3;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Index of a calendar day, counted in whole days from the Unix epoch.
 * Built from year/month/day fields only, so a DST shift inside the range
 * cannot add or remove a day the way dividing elapsed milliseconds by 24h does.
 */
function calendarDayIndex(year: number, monthIndex: number, day: number): number {
  return Date.UTC(year, monthIndex, day) / MS_PER_DAY;
}

function localCalendarDay(date: Date): number {
  return calendarDayIndex(date.getFullYear(), date.getMonth(), date.getDate());
}

/** YYYY-MM-DD as a calendar day, or null when the string is not a real date. */
function parseBestBeforeDay(value: string): number | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, monthIndex, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== monthIndex ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return calendarDayIndex(year, monthIndex, day);
}

/**
 * Filters out expired perishable inventory items.
 *
 * Days are calendar dates in the device's local zone, not elapsed 24h periods.
 * The same wall-clock dates therefore stay within the limit in UTC and in
 * Europe/Berlin, including across a DST change.
 *
 * When best_before is set (YYYY-MM-DD): the item stays through the local day
 * that is MAX_OVERDUE_DAYS calendar days after that date.
 *
 * When best_before is not set: produce and chilled items stay for
 * PERISHABLE_DAYS calendar days after updated_at.
 *
 * Frozen items are never filtered. An unparseable best_before is kept.
 */
export function filterExpiredPerishables(items: InventoryItem[]): InventoryItem[] {
  const today = localCalendarDay(new Date());
  return items.filter((item) => {
    if (item.is_frozen) return true;

    if (item.best_before) {
      const bestBeforeDay = parseBestBeforeDay(item.best_before);
      if (bestBeforeDay === null) return true;
      return today - bestBeforeDay <= MAX_OVERDUE_DAYS;
    }

    const maxDays = PERISHABLE_DAYS[getCategoryGroup(item.demand_group_code)];
    if (!maxDays) return true;
    return today - localCalendarDay(new Date(item.updated_at)) <= maxDays;
  });
}
