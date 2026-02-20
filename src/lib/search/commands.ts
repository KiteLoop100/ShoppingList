/**
 * Command phrase detection for the search field (F02 Kommando-Erkennung).
 * Simple string match against known phrases.
 */

import { normalizeForSearch } from "./normalize";

const PHRASES_LAST_TRIP = [
  "letzter einkauf",
  "letzten einkauf wiederholen",
  "last shopping",
];

export function isLastTripCommand(query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return false;
  return PHRASES_LAST_TRIP.some((phrase) => {
    const p = normalizeForSearch(phrase);
    return q === p || q.startsWith(p) || p.startsWith(q);
  });
}
