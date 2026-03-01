/**
 * Format an ISO date string as dd.mm.yyyy (German/EU style).
 * Used for flyer valid-from / valid-until display.
 */
export function formatFlyerDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return iso;
  }
}

/**
 * Format a date-only string (YYYY-MM-DD) as a locale-aware short date (day + month).
 * Appends T00:00:00 to avoid UTC offset shifting the displayed day.
 * Returns null for falsy input.
 */
export function formatShortDate(
  dateStr: string | null | undefined,
  locale: string
): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Format a date string as a long localized date with full weekday and month name.
 * E.g. "Montag, 01. März 2026" (de-DE) or "Monday, March 01, 2026" (en-US).
 * Falls back to the raw string on parse error.
 */
export function formatDateLong(
  dateStr: string | null | undefined,
  locale: string,
  fallback = ""
): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string as a compact localized date with abbreviated weekday and numeric month.
 * E.g. "Mo., 01.03.2026" (de-DE) or "Mon, 03/01/2026" (en-US).
 * Falls back to the raw string on parse error.
 */
export function formatDateCompact(
  dateStr: string | null | undefined,
  locale: string,
  fallback = ""
): string {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
