export interface RetailerConfig {
  id: string;
  name: string;
  countries: string[];
  color: string;
  bgColor: string;
}

export const RETAILERS: RetailerConfig[] = [
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
];

export function getRetailersForCountry(country: string): RetailerConfig[] {
  return RETAILERS.filter((r) => r.countries.includes(country));
}

export function getRetailerByName(name: string): RetailerConfig | undefined {
  const lower = name.toLowerCase();
  return RETAILERS.find((r) => r.name.toLowerCase() === lower);
}

export function getRetailerById(id: string): RetailerConfig | undefined {
  return RETAILERS.find((r) => r.id === id);
}
