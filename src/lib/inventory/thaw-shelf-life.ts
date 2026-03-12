/**
 * Category-specific shelf life (in days) after thawing a frozen item.
 *
 * Based on demand_group_code from the ALDI product catalog.
 * Conservative defaults aligned with German food safety recommendations.
 */

const THAW_DAYS_BY_CODE: Record<string, number> = {
  "62": 2,  // Frischfleisch
  "67": 2,  // Geflügel, frisch
  "68": 2,  // Schweinefleisch, frisch
  "70": 2,  // Gekühltes verzehrfertiges Fleisch
  "64": 1,  // Fisch, frisch
  "71": 1,  // Gekühlter verzehrfertiger Fisch
  "69": 3,  // Gekühlte Wurstwaren
  "73": 3,  // Gekühlte Feinkost
  "72": 2,  // Gekühlte Fertiggerichte
  "38": 2,  // Obst (frisch)
  "58": 2,  // Gemüse (frisch)
  "88": 2,  // Obst & Gemüse sonstige
  "75": 2,  // TK Fleisch/Fisch (nativ gefroren)
  "76": 2,  // TK Obst/Gemüse
  "77": 1,  // TK Desserts/Backwaren/Eis
  "78": 1,  // TK Fertiggerichte/Pizzas
};

const DEFAULT_THAW_DAYS = 3;

export function getThawShelfLifeDays(demandGroupCode: string | null): number {
  if (!demandGroupCode) return DEFAULT_THAW_DAYS;
  return THAW_DAYS_BY_CODE[demandGroupCode] ?? DEFAULT_THAW_DAYS;
}
