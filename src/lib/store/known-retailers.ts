/**
 * Well-known grocery retailers for the store creation dialog.
 * Sorted by approximate market share in DACH region, plus NZ chains.
 */
export const KNOWN_RETAILERS = [
  "ALDI SÜD",
  "ALDI Nord",
  "Lidl",
  "REWE",
  "EDEKA",
  "Penny",
  "Netto",
  "Kaufland",
  "dm",
  "Rossmann",
  "Alnatura",
  "Tegut",
  "Norma",
  "Globus",
  "SPAR",
  "Hofer",
  "Billa",
  // New Zealand
  "PAK'nSAVE",
  "New World",
  "Countdown",
  "Woolworths",
] as const;

export type KnownRetailer = (typeof KNOWN_RETAILERS)[number];
