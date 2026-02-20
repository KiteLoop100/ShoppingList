/**
 * Validates checkoff sequences (LEARNING-LOGIC 3.2–3.3).
 * Only validated sequences are used for pairwise learning.
 */

const MIN_ITEMS = 5;
const MIN_DURATION_SEC = 3 * 60;
const MIN_AVG_GAP_SEC = 15;
const MAX_PCT_UNDER_5_SEC = 0.5;
const INVALID_MAX_DURATION_SEC = 60;
const INVALID_MAX_AVG_GAP_SEC = 5;

export interface ValidationInputItem {
  checked_at: string;
}

export function validateCheckoffSequence<T extends ValidationInputItem>(
  items: T[]
): boolean {
  if (items.length < MIN_ITEMS) return false;

  const sorted = [...items].sort(
    (a, b) =>
      new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
  );
  const first = new Date(sorted[0].checked_at).getTime();
  const last = new Date(sorted[sorted.length - 1].checked_at).getTime();
  const durationSec = (last - first) / 1000;

  if (durationSec < INVALID_MAX_DURATION_SEC) return false;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(
      (new Date(sorted[i].checked_at).getTime() -
        new Date(sorted[i - 1].checked_at).getTime()) /
        1000
    );
  }
  const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (avgGap < INVALID_MAX_AVG_GAP_SEC) return false;

  if (durationSec < MIN_DURATION_SEC) return false;
  if (avgGap < MIN_AVG_GAP_SEC) return false;

  const under5 = gaps.filter((g) => g < 5).length;
  if (under5 / gaps.length > MAX_PCT_UNDER_5_SEC) return false;

  return true;
}
