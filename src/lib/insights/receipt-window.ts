import type { SupabaseClient } from "@supabase/supabase-js";

/** Insights only look at receipts from the last 90 days (client gate and server context). */
export const INSIGHTS_LOOKBACK_DAYS = 90;
/** Minimum number of receipts inside the window before Insights are offered. */
export const INSIGHTS_MIN_RECEIPTS = 3;

export interface ReceiptWindowStatus {
  /** Receipts with a purchase_date inside the lookback window. */
  countInWindow: number;
  /** Newest purchase_date (YYYY-MM-DD) over ALL receipts, or null if there is none. */
  latestReceiptDate: string | null;
}

/** YYYY-MM-DD of (today - days), using the local calendar like the original gate. */
export function windowCutoffDate(now: Date = new Date(), days: number = INSIGHTS_LOOKBACK_DAYS): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

/**
 * Formats a DATE column value (YYYY-MM-DD) for display without any time-zone shift.
 * Returns null for malformed input so callers can simply omit the line.
 */
export function formatReceiptDate(isoDate: string, locale: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Counts the user's receipts inside the 90-day window. Only when the minimum is not
 * reached, also looks up the newest receipt date (any age) so the UI can explain why.
 * RLS restricts both queries to the signed-in user. Throws on query errors.
 */
export async function fetchReceiptWindowStatus(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ReceiptWindowStatus> {
  const { count, error } = await supabase
    .from("receipts")
    .select("*", { count: "exact", head: true })
    .gte("purchase_date", windowCutoffDate(now));
  if (error) throw new Error(error.message);

  const countInWindow = count ?? 0;
  if (countInWindow >= INSIGHTS_MIN_RECEIPTS) return { countInWindow, latestReceiptDate: null };

  const { data, error: latestError } = await supabase
    .from("receipts")
    .select("purchase_date")
    .not("purchase_date", "is", null)
    .order("purchase_date", { ascending: false })
    .limit(1);
  // The date line is optional: a failure here must not hide the main message.
  const latestReceiptDate = latestError ? null : ((data?.[0]?.purchase_date as string | undefined) ?? null);
  return { countInWindow, latestReceiptDate };
}
