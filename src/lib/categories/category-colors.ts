/**
 * Per-demand-group colour palette for visual coding in the shopping-order view.
 *
 * One vivid colour per ALDI demand group, used for the 4px category bar
 * that groups consecutive items.  Related demand groups share a colour
 * family (e.g. all dairy groups are blue shades).
 *
 * Colours are bold and saturated, inspired by ALDI SÜD's brand language
 * (deep navy, bright orange, confident reds/greens).  Since the bar is a
 * decorative element (not text), WCAG text-contrast requirements do not
 * apply -- we can go full vibrant.
 *
 * Used as inline styles (not Tailwind classes) so purge is not an issue.
 */

// ── Demand-group colours (primary map) ──────────────────────────────
const DEMAND_GROUP_COLORS: Record<string, string> = {
  // Bakery family (vivid amber / gold)
  "56-Bake-Off":                                    "#E8A817",
  "57-Brot/Kuchen":                                 "#D4960F",
  "89-Backartikel":                                 "#C08A0A",

  // Fruits & vegetables family (vivid greens)
  "38-Gemüse":                                      "#1DB954",
  "58-Obst":                                        "#28A745",
  "88-Salate":                                      "#15A040",

  // Fresh meat family (vivid reds)
  "68-Schweinefleisch, frisch":                     "#E53935",
  "67-Geflügel, frisch":                            "#D32F2F",
  "62-Frischfleisch (ohne Schwein/Geflügel)":       "#EF5350",
  "64-Fisch, frisch":                               "#C62828",

  // Chilled meat / sausage family (dark rose / burgundy)
  "69-Gekühlte Wurstwaren":                         "#C04858",
  "49-Dauerwurst/Speck":                            "#B04050",
  "70-Gekühltes verzehrfertiges Fleisch/Fleisc":    "#D05060",
  "82-Wurst-/Fleisch-/Fischkonserven":              "#A83848",

  // Chilled convenience family (vivid teal)
  "73-Gekühlte Feinkost":                           "#00ACC1",
  "72-Gekühlte Fertiggerichte":                     "#0097A7",
  "74-Gekühlte Getränke":                           "#00BCD4",
  "71-Gekühlter verzehrfertiger Fisch":             "#00838F",

  // Dairy family (vivid blues)
  "83-Milch/Sahne/Butter":                          "#2196F3",
  "51-Joghurts/Quark":                              "#1E88E5",
  "84-Käse/Käseersatzprodukte":                     "#42A5F5",
  "50-H-Milchprodukte/Milchersatzprodukte":         "#1565C0",
  "60-Margarine/pflanzliche Fette":                 "#1976D2",

  // Eggs (warm ochre)
  "55-Eier":                                        "#C49520",

  // Pantry / dry goods family (vivid warm browns)
  "54-Nährmittel":                                  "#A07048",
  "90-Cerealien/Snacks":                            "#946640",
  "52-Dressings/Öle/Soßen":                         "#AA7850",
  "53-Konfitüren/Brotaufstriche":                   "#8C5C38",
  "47-Konserven":                                   "#986040",
  "48-Fertiggerichte/Suppen":                       "#B08058",

  // Coffee & tea family (rich brown)
  "45-Kaffee/Kakao":                                "#8B5E3C",
  "46-Tee":                                         "#7D5230",

  // Non-alcoholic beverages family (bold blue)
  "05-Wasser":                                      "#1976D2",
  "80-CO2 Erfrischungsgetränke":                    "#1565C0",
  "79-Funktionsgetränke/Eistee":                    "#2196F3",
  "81-Fruchtsäfte/Sirupe":                          "#0D47A1",

  // Alcoholic beverages family (bold greens / wine tones)
  "04-Bier":                                        "#2E7D32",
  "03-Wein":                                        "#880E4F",
  "02-Sekt/Schaumwein":                             "#AD1457",
  "01-Spirituosen":                                 "#5E35B1",

  // Snacking / sweets family (vivid orange / terracotta)
  "41-Schokolade/Pralinen":                         "#D84315",
  "42-Gebäck":                                      "#E65100",
  "40-Bonbons/Kaugummi":                            "#F4511E",
  "43-Saisonartikel Süßwaren":                      "#BF360C",
  "44-Salzgebäck":                                  "#E64A19",
  "86-Chips/Snacks":                                "#C43E00",
  "87-Nüsse/Trockenfrüchte":                        "#A84000",

  // Frozen family (steel blue)
  "75-TK Fleisch/Fisch":                            "#5C8DAE",
  "78-TK Fertiggerichte/Pizzas":                    "#4A7D9E",
  "76-TK Obst/Gemüse":                              "#6E9DBE",
  "77-TK Desserts/Backwaren/Eis":                   "#5490B0",

  // Health, beauty, baby family (vivid pink / magenta)
  "07-Kosmetik/Körperpflege":                       "#E91E63",
  "08-Körperhygiene":                               "#D81B60",
  "09-Babyartikel":                                 "#EC407A",
  "13-Apothekenprodukte":                            "#C2185B",

  // Household / non-food family (neutral slate)
  "25-Haushaltsartikel":                            "#708090",
  "06-Wasch-/Putz-/Reinigungsmittel":               "#607080",
  "10-Papierwaren":                                 "#7890A0",
  "11-Folien/Tücher":                               "#5A7088",
  "85-Tiernahrung":                                 "#506878",

  // Promotional items (ALDI brand blue)
  "AK-Aktionsartikel":                              "#0050A0",
};

// Fallback map for items without demand_group (generic free-text entries).
const CATEGORY_COLORS: Record<string, string> = {
  "Bakery":                  "#E8A817",
  "Fruits & Vegetables":     "#1DB954",
  "Fresh Meat & Fish":       "#E53935",
  "Dairy":                   "#2196F3",
  "Chilled Convenience":     "#00ACC1",
  "Freezer":                 "#5C8DAE",
  "Pantry":                  "#A07048",
  "Breakfast":               "#8B5E3C",
  "Non-Alcoholic Beverages": "#1976D2",
  "Alcoholic Beverages":     "#2E7D32",
  "Snacking":                "#D84315",
  "Health, Beauty & Baby":   "#E91E63",
  "Household":               "#708090",
  "Electronics":             "#708090",
  "Fashion":                 "#708090",
  "Home Improvement":        "#708090",
  "Outdoor/Leisure":         "#708090",
  "Services":                "#708090",
  "Sonstiges":               "#708090",
  "Aktionsartikel":          "#0050A0",
};

const FALLBACK = "#708090";

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
