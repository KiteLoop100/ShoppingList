/**
 * Translates category and demand-group names between EN and DE.
 *
 * Categories are stored in English (official ALDI names) in the DB.
 * Demand groups / sub-groups use the official ALDI commodity group codes
 * (German with numeric prefix, e.g. "54-Nährmittel").
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

/**
 * Translate a category name to the requested locale.
 * Category names in the DB are English; demand-group names are German.
 */
export function translateCategoryName(name: string, locale: string): string {
  if (locale === "de") {
    return EN_TO_DE[name] ?? name;
  }
  return DE_TO_EN[name] ?? name;
}
