/**
 * Per-demand-group colour palette for visual coding in the shopping-order view.
 *
 * One colour per ALDI demand group, used for the item border and the
 * category label text.  Related demand groups share a colour family
 * (e.g. all dairy groups are blue shades) while remaining distinguishable.
 *
 * All values meet WCAG 4.5:1 contrast on white so the 11 px label text
 * stays readable.
 *
 * Used as inline styles (not Tailwind classes) so purge is not an issue.
 */

// ── Demand-group colours (primary map) ──────────────────────────────
const DEMAND_GROUP_COLORS: Record<string, string> = {
  // Bakery family (gold / warm brown)
  "56-Bake-Off":                                    "#8B6914",
  "57-Brot/Kuchen":                                 "#9E7A1A",
  "89-Backartikel":                                 "#7A5C10",

  // Fruits & vegetables family (greens)
  "38-Gemüse":                                      "#1A7A3C",
  "58-Obst":                                        "#2D8B4A",
  "88-Salate":                                      "#0F6B30",

  // Fresh meat family (reds)
  "68-Schweinefleisch, frisch":                     "#C43030",
  "67-Geflügel, frisch":                            "#B02828",
  "62-Frischfleisch (ohne Schwein/Geflügel)":       "#D04040",
  "64-Fisch, frisch":                               "#A83838",

  // Chilled meat / sausage family (dark rose / brick)
  "69-Gekühlte Wurstwaren":                         "#8B3A3A",
  "49-Dauerwurst/Speck":                            "#9C4545",
  "70-Gekühltes verzehrfertiges Fleisch/Fleisc":    "#7B3030",
  "82-Wurst-/Fleisch-/Fischkonserven":              "#A04848",

  // Chilled convenience family (teal)
  "73-Gekühlte Feinkost":                           "#0B7574",
  "72-Gekühlte Fertiggerichte":                     "#0A6565",
  "74-Gekühlte Getränke":                           "#0C8585",
  "71-Gekühlter verzehrfertiger Fisch":             "#098080",

  // Dairy family (blues)
  "83-Milch/Sahne/Butter":                          "#2070B0",
  "51-Joghurts/Quark":                              "#1860A0",
  "84-Käse/Käseersatzprodukte":                     "#2880C0",
  "50-H-Milchprodukte/Milchersatzprodukte":         "#1050A0",
  "60-Margarine/pflanzliche Fette":                 "#3070A0",

  // Eggs (standalone warm tone)
  "55-Eier":                                        "#8B7040",

  // Pantry / dry goods family (warm browns)
  "54-Nährmittel":                                  "#73603E",
  "90-Cerealien/Snacks":                            "#6B5838",
  "52-Dressings/Öle/Soßen":                         "#7B6842",
  "53-Konfitüren/Brotaufstriche":                   "#63502E",
  "47-Konserven":                                   "#5E4C2C",
  "48-Fertiggerichte/Suppen":                       "#6E5A36",

  // Coffee & tea family (deep brown)
  "45-Kaffee/Kakao":                                "#65441F",
  "46-Tee":                                         "#5A3C1A",

  // Non-alcoholic beverages family (deep blue)
  "05-Wasser":                                      "#1458A8",
  "80-CO2 Erfrischungsgetränke":                    "#0C4898",
  "79-Funktionsgetränke/Eistee":                    "#1C68B8",
  "81-Fruchtsäfte/Sirupe":                          "#1050A0",

  // Alcoholic beverages family (dark greens / burgundy)
  "04-Bier":                                        "#2B6630",
  "03-Wein":                                        "#5C2040",
  "02-Sekt/Schaumwein":                             "#4A1838",
  "01-Spirituosen":                                 "#3E3060",

  // Snacking / sweets family (chocolate / orange-brown)
  "41-Schokolade/Pralinen":                         "#964020",
  "42-Gebäck":                                      "#884018",
  "40-Bonbons/Kaugummi":                            "#A04828",
  "43-Saisonartikel Süßwaren":                      "#7A3818",
  "44-Salzgebäck":                                  "#8B4520",
  "86-Chips/Snacks":                                "#6E3812",
  "87-Nüsse/Trockenfrüchte":                        "#805030",

  // Frozen family (frost blue-grey)
  "75-TK Fleisch/Fisch":                            "#506878",
  "78-TK Fertiggerichte/Pizzas":                    "#405868",
  "76-TK Obst/Gemüse":                              "#607888",
  "77-TK Desserts/Backwaren/Eis":                   "#4A6270",

  // Health, beauty, baby family (pink / magenta)
  "07-Kosmetik/Körperpflege":                       "#B31858",
  "08-Körperhygiene":                               "#A01050",
  "09-Babyartikel":                                 "#C42068",
  "13-Apothekenprodukte":                            "#901048",

  // Household / non-food family (neutral greys)
  "25-Haushaltsartikel":                            "#64748B",
  "06-Wasch-/Putz-/Reinigungsmittel":               "#5A6A80",
  "10-Papierwaren":                                 "#6E7E90",
  "11-Folien/Tücher":                               "#586878",
  "85-Tiernahrung":                                 "#4E5E70",

  // Promotional items (ALDI brand blue)
  "AK-Aktionsartikel":                              "#00529E",
};

// Fallback map for items without demand_group (generic free-text entries).
const CATEGORY_COLORS: Record<string, string> = {
  "Bakery":                  "#8B6914",
  "Fruits & Vegetables":     "#1A7A3C",
  "Fresh Meat & Fish":       "#C43030",
  "Dairy":                   "#2070B0",
  "Chilled Convenience":     "#0B7574",
  "Freezer":                 "#506878",
  "Pantry":                  "#73603E",
  "Breakfast":               "#65441F",
  "Non-Alcoholic Beverages": "#1458A8",
  "Alcoholic Beverages":     "#2B6630",
  "Snacking":                "#964020",
  "Health, Beauty & Baby":   "#B31858",
  "Household":               "#64748B",
  "Electronics":             "#64748B",
  "Fashion":                 "#64748B",
  "Home Improvement":        "#64748B",
  "Outdoor/Leisure":         "#64748B",
  "Services":                "#64748B",
  "Sonstiges":               "#64748B",
  "Aktionsartikel":          "#00529E",
};

const FALLBACK = "#64748B";

/**
 * Returns a colour for a demand-group code or category name.
 * Checks demand-group map first, then falls back to category map.
 */
export function getCategoryColor(demandGroupOrCategoryName: string | undefined): string {
  if (!demandGroupOrCategoryName) return FALLBACK;
  return DEMAND_GROUP_COLORS[demandGroupOrCategoryName]
    ?? CATEGORY_COLORS[demandGroupOrCategoryName]
    ?? FALLBACK;
}
