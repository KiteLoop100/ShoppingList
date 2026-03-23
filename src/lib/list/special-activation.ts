/**
 * Activation time for flyer specials: two "Werktage" (Mon–Sat) before sale start,
 * Sundays do not count. Activation at 12:00 local time (product.country).
 */

const COUNTRY_TZ: Record<string, string> = {
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  NZ: "Pacific/Auckland",
};

/**
 * Calendar date (YYYY-MM-DD) when the special becomes actionable on the list.
 * Returns null if the input is not a valid YYYY-MM-DD or iteration fails.
 */
export function getSpecialActivationCalendarDate(specialStartDate: string): string | null {
  const parts = specialStartDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const start = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(start.getTime())) return null;
  if (
    start.getUTCFullYear() !== y ||
    start.getUTCMonth() + 1 !== m ||
    start.getUTCDate() !== d
  ) {
    return null;
  }

  let cur = new Date(start.getTime());
  let remaining = 2;
  let guard = 0;
  while (remaining > 0 && guard < 400) {
    guard++;
    cur.setUTCDate(cur.getUTCDate() - 1);
    if (cur.getUTCDay() !== 0) remaining--;
  }
  if (remaining > 0) return null;

  const yy = cur.getUTCFullYear();
  const mm = String(cur.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cur.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * UTC milliseconds for 12:00 local time on `activationDateYmd` in the country's timezone.
 */
function localNoonUtcMs(activationDateYmd: string, country: string): number {
  const tz = COUNTRY_TZ[country] || "Europe/Berlin";
  const [y, m, d] = activationDateYmd.split("-").map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const localHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(new Date(guessUtc));
  const localHour = parseInt(localHourStr, 10);
  if (!Number.isFinite(localHour)) return guessUtc;
  return guessUtc - (localHour - 12) * 3_600_000;
}

/**
 * When the deferred special becomes active (unchecked list). Invalid input → 0 (treated as past).
 */
export function computeActivationTime(specialStartDate: string, country: string): number {
  const activationDate = getSpecialActivationCalendarDate(specialStartDate);
  if (!activationDate) return 0;
  return localNoonUtcMs(activationDate, country);
}
