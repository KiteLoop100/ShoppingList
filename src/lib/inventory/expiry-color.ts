/**
 * Determines display color for the best-before (MHD) date on inventory items.
 *
 * Rules:
 * - "default": best_before is in the future (still fresh)
 * - "warning": best_before is today or in the past (expired)
 * - "danger": expired AND the overdue period exceeds 30% of the original
 *   shelf life (purchase_date → best_before). Only computed when both dates
 *   are available.
 */

export type ExpiryColor = "default" | "warning" | "danger";

const MS_PER_DAY = 86_400_000;

/**
 * @param bestBefore  ISO date string (YYYY-MM-DD) or null
 * @param purchaseDate  ISO date string (YYYY-MM-DD) or null — used for 30% threshold
 * @param referenceDate  override for testing; defaults to today
 */
export function getExpiryColor(
  bestBefore: string | null,
  purchaseDate: string | null,
  referenceDate?: Date,
): ExpiryColor {
  if (!bestBefore) return "default";

  const now = referenceDate ?? new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const bestBeforeMs = parseDateMs(bestBefore);
  if (bestBeforeMs === null) return "default";

  if (bestBeforeMs > todayMs) return "default";

  if (!purchaseDate) return "warning";

  const purchaseMs = parseDateMs(purchaseDate);
  if (purchaseMs === null) return "warning";

  const shelfLifeDays = Math.round((bestBeforeMs - purchaseMs) / MS_PER_DAY);
  if (shelfLifeDays <= 0) return "warning";

  const overdueDays = Math.round((todayMs - bestBeforeMs) / MS_PER_DAY);
  const threshold = shelfLifeDays * 0.3;

  return overdueDays > threshold ? "danger" : "warning";
}

/**
 * Formats best_before as a compact date string for display.
 * Returns null if bestBefore is not set.
 */
export function formatBestBefore(bestBefore: string | null, locale: string = "de"): string | null {
  if (!bestBefore) return null;
  const date = new Date(bestBefore + "T00:00:00");
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function parseDateMs(dateStr: string): number | null {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d).getTime();
}
