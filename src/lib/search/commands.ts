/**
 * Command phrase detection for the search field (F02 Kommando-Erkennung).
 * "Letzte Einkäufe": products of the last 4 weeks (list_items, sorted by frequency).
 * "Aktionsartikel": current and upcoming special offers.
 * Retailer prefix: full retailer name at start of query (F26 Buy Elsewhere).
 * Receipt command: __receipt:{retailer}:{mode}:{n} for per-retailer trip queries.
 */

import { normalizeName } from "@/lib/products/normalize";
import { getRetailersForCountry, type RetailerConfig } from "@/lib/retailers/retailers";
import type { ReceiptTripMode } from "@/lib/list/receipt-purchase-menu";

const PHRASES_RECENT_PURCHASES = [
  "letzte einkäufe",
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

// --- Receipt command: __receipt:{retailer}:{mode}:{n} ---

const RECEIPT_PREFIX = "__receipt:";
const VALID_MODES = new Set<ReceiptTripMode>(["single", "combined", "not-recently"]);

export interface ReceiptCommandResult {
  retailer: string;
  mode: ReceiptTripMode;
  n: number;
}

export function parseReceiptCommand(query: string): ReceiptCommandResult | null {
  const trimmed = query.trim();
  if (!trimmed.startsWith(RECEIPT_PREFIX)) return null;

  const parts = trimmed.slice(RECEIPT_PREFIX.length).split(":");
  if (parts.length !== 3) return null;

  const [retailer, modeStr, nStr] = parts;
  if (!retailer) return null;
  if (!VALID_MODES.has(modeStr as ReceiptTripMode)) return null;

  const n = parseInt(nStr, 10);
  if (isNaN(n) || n < 0) return null;

  return { retailer, mode: modeStr as ReceiptTripMode, n };
}

export function buildReceiptCommand(
  retailer: string,
  mode: ReceiptTripMode,
  n: number,
): string {
  return `${RECEIPT_PREFIX}${retailer}:${mode}:${n}`;
}

// --- Natural-language phrase detection for receipt commands ---

const HOME_RETAILER = "ALDI";

interface ReceiptPhrase {
  phrases: string[];
  mode: ReceiptTripMode;
  n: number;
}

const RECEIPT_PHRASE_TABLE: ReceiptPhrase[] = [
  { phrases: ["letzter einkauf"], mode: "single", n: 0 },
  { phrases: ["vorletzter einkauf"], mode: "single", n: 1 },
  { phrases: ["vorvorletzter einkauf"], mode: "single", n: 2 },
  { phrases: ["letzten zwei einkaufe", "letzten 2 einkaufe"], mode: "combined", n: 2 },
  { phrases: ["letzten drei einkaufe", "letzten 3 einkaufe"], mode: "combined", n: 3 },
  { phrases: ["letzten vier einkaufe", "letzten 4 einkaufe"], mode: "combined", n: 4 },
  { phrases: ["langer nicht gekauft", "laenger nicht gekauft", "länger nicht gekauft"], mode: "not-recently", n: 0 },
];

export function detectReceiptPhrase(query: string): ReceiptCommandResult | null {
  const q = normalizeName(query);
  if (!q) return null;

  for (const entry of RECEIPT_PHRASE_TABLE) {
    for (const phrase of entry.phrases) {
      const p = normalizeName(phrase);
      if (q === p) {
        return { retailer: HOME_RETAILER, mode: entry.mode, n: entry.n };
      }
    }
  }
  return null;
}
