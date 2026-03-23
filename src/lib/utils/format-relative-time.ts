/**
 * Past-only relative time for "saved on" labels (no extra dependencies).
 */
export function formatRelativeTimePast(isoDate: string, locale: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 0) {
    return rtf.format(Math.min(-1, Math.round(diffSec / 60)), "minute");
  }
  if (diffSec < 45) {
    return rtf.format(-Math.max(1, diffSec), "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  }
  const diffHour = Math.round(diffSec / 3600);
  if (diffHour < 24) {
    return rtf.format(-diffHour, "hour");
  }
  const diffDay = Math.round(diffSec / 86400);
  if (diffDay < 7) {
    return rtf.format(-diffDay, "day");
  }
  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 5) {
    return rtf.format(-diffWeek, "week");
  }
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) {
    return rtf.format(-diffMonth, "month");
  }
  const diffYear = Math.round(diffDay / 365);
  return rtf.format(-diffYear, "year");
}
