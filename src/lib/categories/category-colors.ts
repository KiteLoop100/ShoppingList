/**
 * Per-demand-group colour palette for visual coding in the shopping-order view.
 *
 * One vivid colour per ALDI demand group, keyed by the pure code (e.g. "83").
 * Used for the 4px category bar that groups consecutive items.
 *
 * Colours are bold and saturated, inspired by ALDI SÜD's brand language.
 * Since the bar is a decorative element (not text), WCAG text-contrast
 * requirements do not apply.
 *
 * Used as inline styles (not Tailwind classes) so purge is not an issue.
 */

const DEMAND_GROUP_COLORS: Record<string, string> = {
  // Bakery family (vivid amber / gold)
  "56":  "#E8A817",
  "57":  "#D4960F",
  "89":  "#C08A0A",

  // Fruits & vegetables family (vivid greens)
  "38":  "#1DB954",
  "58":  "#28A745",
  "88":  "#15A040",

  // Fresh meat family (vivid reds)
  "68":  "#E53935",
  "67":  "#D32F2F",
  "62":  "#EF5350",
  "64":  "#C62828",

  // Chilled meat / sausage family (dark rose / burgundy)
  "69":  "#C04858",
  "49":  "#B04050",
  "70":  "#D05060",
  "82":  "#A83848",

  // Chilled convenience family (vivid teal)
  "73":  "#00ACC1",
  "72":  "#0097A7",
  "74":  "#00BCD4",
  "71":  "#00838F",

  // Dairy family (vivid blues)
  "83":  "#2196F3",
  "51":  "#1E88E5",
  "84":  "#42A5F5",
  "50":  "#1565C0",
  "60":  "#1976D2",

  // Eggs (warm ochre)
  "55":  "#C49520",

  // Pantry / dry goods family (vivid warm browns)
  "54":  "#A07048",
  "90":  "#946640",
  "52":  "#AA7850",
  "53":  "#8C5C38",
  "47":  "#986040",
  "48":  "#B08058",

  // Coffee & tea family (rich brown)
  "45":  "#8B5E3C",
  "46":  "#7D5230",

  // Non-alcoholic beverages family (bold blue)
  "05":  "#1976D2",
  "80":  "#1565C0",
  "79":  "#2196F3",
  "81":  "#0D47A1",

  // Alcoholic beverages family (bold greens / wine tones)
  "04":  "#2E7D32",
  "03":  "#880E4F",
  "02":  "#AD1457",
  "01":  "#5E35B1",

  // Snacking / sweets family (vivid orange / terracotta)
  "41":  "#D84315",
  "42":  "#E65100",
  "40":  "#F4511E",
  "43":  "#BF360C",
  "44":  "#E64A19",
  "86":  "#C43E00",
  "87":  "#A84000",

  // Frozen family (steel blue)
  "75":  "#5C8DAE",
  "78":  "#4A7D9E",
  "76":  "#6E9DBE",
  "77":  "#5490B0",

  // Health, beauty, baby family (vivid pink / magenta)
  "07":  "#E91E63",
  "08":  "#D81B60",
  "09":  "#EC407A",
  "13":  "#C2185B",

  // Household / non-food family (neutral slate)
  "25":  "#708090",
  "06":  "#607080",
  "10":  "#7890A0",
  "11":  "#5A7088",
  "85":  "#506878",

  // Promotional items (ALDI brand blue)
  "AK":  "#0050A0",
};

const FALLBACK = "#708090";

/**
 * Returns a colour for a demand-group code (e.g. "83", "AK").
 */
export function getCategoryColor(demandGroupCode: string | undefined): string {
  if (!demandGroupCode) return FALLBACK;
  return DEMAND_GROUP_COLORS[demandGroupCode] ?? FALLBACK;
}

/** Direct access to the color map, e.g. for iterating over all colors. */
export { DEMAND_GROUP_COLORS };
