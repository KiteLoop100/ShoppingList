/**
 * Command phrase detection for the search field (F02 Kommando-Erkennung).
 * "Letzte Einkäufe": products of the last 4 weeks (list_items, sorted by frequency).
 * "Aktionsartikel": current and upcoming special offers.
 * Retailer prefix: full retailer name at start of query (F26 Buy Elsewhere).
 */

import { normalizeName } from "@/lib/products/normalize";
import { getRetailersForCountry, type RetailerConfig } from "@/lib/retailers/retailers";

const PHRASES_RECENT_PURCHASES = [
  "letzte einkäufe",
  "letzter einkauf",
  "letzten einkauf wiederholen",
  "last shopping",
  "recent",
];

const PHRASES_AKTIONSARTIKEL = [
  "aktionsartikel",
  "aktions artikel",
  "specials",
  "angebote",
  "sonderangebote",
];

export function isLastTripCommand(query: string): boolean {
  const q = normalizeName(query);
  if (!q) return false;
  return PHRASES_RECENT_PURCHASES.some((phrase) => {
    const p = normalizeName(phrase);
    return q === p || q.startsWith(p) || p.startsWith(q);
  });
}

export function isAktionsartikelCommand(query: string): boolean {
  const q = normalizeName(query);
  if (!q) return false;
  return PHRASES_AKTIONSARTIKEL.some((phrase) => {
    const p = normalizeName(phrase);
    return q === p || q.startsWith(p) || p.startsWith(q);
  });
}

export interface RetailerPrefixResult {
  retailer: RetailerConfig;
  productQuery: string;
}

/**
 * Detect a full retailer name at the beginning of the search query.
 * Case-insensitive, requires exact full name match, optionally followed by a space and product name.
 * Returns null if no retailer is detected.
 */
export function detectRetailerPrefix(query: string, country: string): RetailerPrefixResult | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const retailers = getRetailersForCountry(country);
  for (const retailer of retailers) {
    const name = retailer.name;
    if (trimmed.length < name.length) continue;
    const prefix = trimmed.slice(0, name.length);
    if (prefix.toLowerCase() !== name.toLowerCase()) continue;
    const rest = trimmed.slice(name.length);
    if (rest === "") {
      return { retailer, productQuery: "" };
    }
    if (rest.startsWith(" ")) {
      return { retailer, productQuery: rest.trimStart() };
    }
  }
  return null;
}
