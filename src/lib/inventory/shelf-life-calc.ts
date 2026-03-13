/**
 * Pure utility to compute a best-before date from purchase date and shelf life.
 * Returns ISO date string (YYYY-MM-DD) or null when inputs are missing/invalid.
 *
 * Uses UTC arithmetic to avoid timezone-related off-by-one errors.
 */
export function calculateBestBefore(
  purchaseDate: string | null | undefined,
  shelfLifeDays: number | null | undefined,
): string | null {
  if (!purchaseDate || !shelfLifeDays || shelfLifeDays <= 0) return null;
  const parts = purchaseDate.split("-");
  if (parts.length !== 3) return null;
  const [y, m, day] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(day)) return null;
  const d = new Date(Date.UTC(y, m - 1, day + shelfLifeDays));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}
