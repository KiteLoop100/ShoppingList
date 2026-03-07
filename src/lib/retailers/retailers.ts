export interface RetailerConfig {
  id: string;
  name: string;
  countries: string[];
  color: string;
  bgColor: string;
}

export const HOME_RETAILER: RetailerConfig = {
  id: "aldi", name: "ALDI", countries: ["DE", "AT"], color: "bg-sky-100 text-sky-800", bgColor: "bg-sky-50/30",
};

export const RETAILERS: RetailerConfig[] = [
  HOME_RETAILER,
  { id: "lidl",     name: "LIDL",     countries: ["DE", "AT"], color: "bg-blue-100 text-blue-800",     bgColor: "bg-blue-50/40" },
  { id: "rewe",     name: "REWE",     countries: ["DE"],       color: "bg-red-100 text-red-800",       bgColor: "bg-red-50/30" },
  { id: "edeka",    name: "EDEKA",    countries: ["DE"],       color: "bg-yellow-100 text-yellow-800", bgColor: "bg-yellow-50/30" },
  { id: "penny",    name: "Penny",    countries: ["DE"],       color: "bg-red-100 text-red-700",       bgColor: "bg-red-50/20" },
  { id: "netto",    name: "Netto",    countries: ["DE"],       color: "bg-yellow-100 text-yellow-900", bgColor: "bg-yellow-50/30" },
  { id: "kaufland", name: "Kaufland", countries: ["DE"],       color: "bg-red-100 text-red-800",       bgColor: "bg-red-50/25" },
  { id: "dm",       name: "dm",       countries: ["DE", "AT"], color: "bg-white text-gray-800 border border-gray-200", bgColor: "bg-gray-50/40" },
  { id: "rossmann", name: "Rossmann", countries: ["DE"],       color: "bg-green-100 text-green-800",   bgColor: "bg-green-50/30" },
  { id: "spar",     name: "Spar",     countries: ["AT"],       color: "bg-green-100 text-green-800",   bgColor: "bg-green-50/30" },
  { id: "billa",    name: "BILLA",    countries: ["AT"],       color: "bg-yellow-100 text-yellow-800", bgColor: "bg-yellow-50/30" },
  { id: "hofer",    name: "Hofer",    countries: ["AT"],       color: "bg-blue-100 text-blue-800",     bgColor: "bg-blue-50/30" },
  { id: "mueller",  name: "Müller",   countries: ["DE", "AT"], color: "bg-orange-100 text-orange-800", bgColor: "bg-orange-50/30" },
  // New Zealand
  { id: "woolworths",   name: "Woolworths",    countries: ["NZ"], color: "bg-green-100 text-green-800",  bgColor: "bg-green-50/30" },
  { id: "newworld",     name: "New World",     countries: ["NZ"], color: "bg-red-100 text-red-800",      bgColor: "bg-red-50/30" },
  { id: "paknsave",     name: "PAK'nSAVE",     countries: ["NZ"], color: "bg-yellow-100 text-yellow-800", bgColor: "bg-yellow-50/30" },
  { id: "foursquare",   name: "Four Square",   countries: ["NZ"], color: "bg-red-100 text-red-700",      bgColor: "bg-red-50/20" },
  { id: "thewarehouse", name: "The Warehouse", countries: ["NZ"], color: "bg-red-100 text-red-900",      bgColor: "bg-red-50/25" },
];

const HOME_ALIASES = new Set(["aldi", "aldi süd", "aldi sud", "aldi nord", "hofer"]);

export function isHomeRetailer(name: string): boolean {
  return HOME_ALIASES.has(name.toLowerCase().trim());
}

/**
 * Normalize a retailer name from OCR output to the canonical name used in DB.
 * Returns "ALDI" for all ALDI/Hofer variants, or the matching RETAILERS entry name.
 */
export function normalizeRetailerName(name: string): string | null {
  if (isHomeRetailer(name)) return HOME_RETAILER.name;
  const found = getRetailerByName(name);
  return found?.name ?? null;
}

export function getRetailersForCountry(country: string): RetailerConfig[] {
  return RETAILERS.filter((r) => r.countries.includes(country));
}

export function getRetailerByName(name: string): RetailerConfig | undefined {
  const lower = name.toLowerCase().trim();
  return RETAILERS.find((r) => r.name.toLowerCase() === lower);
}

export function getRetailerById(id: string): RetailerConfig | undefined {
  return RETAILERS.find((r) => r.id === id);
}

/** Names used in the Claude prompt to define which retailers are supported */
export const SUPPORTED_RETAILER_NAMES = RETAILERS.map((r) => r.name);

