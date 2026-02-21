/**
 * Command phrase detection for the search field (F02 Kommando-Erkennung).
 * "Letzte Einkäufe": Produkte der letzten 4 Wochen (list_items, nach Häufigkeit).
 */

import { normalizeForSearch } from "./normalize";

/** Schlüsselphrasen für „Letzte Einkäufe“ (letzte 28 Tage auf der Liste, sortiert nach Häufigkeit). */
const PHRASES_RECENT_PURCHASES = [
  "letzte einkäufe",
  "letzter einkauf",
  "letzten einkauf wiederholen",
  "last shopping",
  "recent",
];

export function isLastTripCommand(query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return false;
  return PHRASES_RECENT_PURCHASES.some((phrase) => {
    const p = normalizeForSearch(phrase);
    return q === p || q.startsWith(p) || p.startsWith(q);
  });
}
