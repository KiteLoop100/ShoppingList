/**
 * Translates category and demand-group names for display.
 *
 * Categories are stored in English (official ALDI names) in the DB.
 * Demand groups use ALDI commodity group codes with numeric prefix
 * (e.g. "54-Nährmittel", "83-Milch/Sahne/Butter").
 *
 * `translateCategoryName` handles both: demand-group codes are converted
 * to user-friendly labels via `formatDemandGroupLabel`; plain category
 * names are translated via the EN↔DE map.
 */

// ── Category names (EN → DE) ────────────────────────────────────────
const EN_TO_DE: Record<string, string> = {
  "Alcoholic Beverages": "Alkoholische Getränke",
  "Bakery": "Brot & Backwaren",
  "Breakfast": "Frühstück",
  "Dairy": "Milchprodukte",
  "Chilled Convenience": "Kühlregal",
  "Fresh Meat & Fish": "Frischfleisch & Fisch",
  "Freezer": "Tiefkühl",
  "Fruits & Vegetables": "Obst & Gemüse",
  "Pantry": "Vorratskammer",
  "Non-Alcoholic Beverages": "Alkoholfreie Getränke",
  "Snacking": "Süßwaren & Snacks",
  "Electronics": "Elektronik",
  "Fashion": "Textilien",
  "Health, Beauty & Baby": "Gesundheit, Pflege & Baby",
  "Home Improvement": "Haus & Garten",
  "Household": "Haushalt",
  "Outdoor/Leisure": "Freizeit & Outdoor",
  "Services": "Services",
  "Sonstiges": "Sonstiges",
};

const DE_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_DE).map(([en, de]) => [de, en]),
);

// ── Demand-group display aliases ────────────────────────────────────
// Manual overrides for codes whose auto-stripped name is ugly/truncated.
const DEMAND_GROUP_ALIASES: Record<string, string> = {
  "70-Gekühltes verzehrfertiges Fleisch/Fleisc": "Fertigfleisch/-wurst, gekühlt",
  "50-H-Milchprodukte/Milchersatzprodukte": "H-Milch & Milchersatz",
  "82-Wurst-/Fleisch-/Fischkonserven": "Wurst-, Fleisch- & Fischkonserven",
  "80-CO2 Erfrischungsgetränke": "Erfrischungsgetränke",
  "62-Frischfleisch (ohne Schwein/Geflügel)": "Frischfleisch (Rind, Lamm u.a.)",
  "AK-Aktionsartikel": "Aktionsartikel",
};

const DEMAND_GROUP_PREFIX_RE = /^\d+-/;

/**
 * Converts a demand-group code to a user-friendly label.
 * Checks manual alias first, then strips the numeric prefix.
 */
export function formatDemandGroupLabel(code: string): string {
  if (DEMAND_GROUP_ALIASES[code]) return DEMAND_GROUP_ALIASES[code];
  return code.replace(DEMAND_GROUP_PREFIX_RE, "");
}

function isDemandGroupCode(name: string): boolean {
  return DEMAND_GROUP_PREFIX_RE.test(name) || name.startsWith("AK-");
}

/**
 * Translate a category or demand-group name for display.
 * Demand-group codes (numeric prefix or "AK-") are converted to friendly
 * labels; plain category names are translated via the EN↔DE map.
 */
export function translateCategoryName(name: string, locale: string): string {
  if (isDemandGroupCode(name)) {
    return formatDemandGroupLabel(name);
  }
  if (locale === "de") {
    return EN_TO_DE[name] ?? name;
  }
  return DE_TO_EN[name] ?? name;
}
