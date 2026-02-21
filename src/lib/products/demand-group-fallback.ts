/**
 * Fallback: assign demand_group (and optionally demand_sub_group) from product name keywords
 * when Claude returns null. Used after process-photo extraction.
 */

export interface DemandGroupFallbackResult {
  demand_group: string;
  demand_sub_group: string | null;
}

/** Keywords (lowercase) mapped to { demand_group, demand_sub_group }. First match wins. */
const KEYWORD_MAP: Array<{ pattern: RegExp; group: string; sub: string | null }> = [
  { pattern: /milch|joghurt|quark|sahne|butter|frischkäse|käse\b|mascarpone/i, group: "Milchprodukte", sub: null },
  { pattern: /waschmittel|spülmittel|spülmaschine|weichspüler|allzweckreiniger|wc-reiniger|müllsäck/i, group: "Waschmittel & Reinigung", sub: null },
  { pattern: /schokolade|chips|kekse|nüsse|fruchtgummi|knabber|schokoriegel|pralinen/i, group: "Süßwaren & Snacks", sub: null },
  { pattern: /kaffee|espresso|kapsel|tee\b/i, group: "Kaffee & Tee", sub: null },
  { pattern: /mineralwasser|cola|limonade|softdrink|eistee|saft|smoothie|pflanzenmilch/i, group: "Getränke", sub: null },
  { pattern: /pasta|nudeln|teigwaren|pastasauce|reis\b/i, group: "Pasta & Reis", sub: null },
  { pattern: /deodorant|duschgel|shampoo|haarpflege|seife|zahnpasta|mundpflege|rasur|gesichtspflege|make-up|kosmetik/i, group: "Drogerie & Körperpflege", sub: null },
  { pattern: /toilettenpapier|küchenrolle|taschentuch|serviette/i, group: "Papierprodukte & Haushalt", sub: null },
  { pattern: /alufolie|backpapier|frischhaltefolie|gefrierbeutel/i, group: "Haushalt & Küche", sub: null },
  { pattern: /gewürz|kräuter getrocknet|pfeffer|salz\b/i, group: "Gewürze & Würzmittel", sub: null },
  { pattern: /ketchup|mayonnaise|bbq|sauce|dressing/i, group: "Saucen & Dressings", sub: null },
  { pattern: /wurst|salami|schinken|aufschnitt/i, group: "Wurst & Aufschnitt", sub: null },
  { pattern: /fisch|lachs|garnelen|hering|matjes|räucherfisch/i, group: "Fisch & Meeresfrüchte", sub: null },
  { pattern: /fleisch|hackfleisch|rind|geflügel|kalb/i, group: "Frischfleisch", sub: null },
  { pattern: /müsli|cerealien|porridge|haferflocken|aufstrich|brotbelag|backmischung/i, group: "Frühstück & Cerealien", sub: null },
  { pattern: /obst|gemüse|banane|tomate|paprika|gurke|kartoffel|salat|zwiebel|beere|pilze|kräuter frisch/i, group: "Obst & Gemüse", sub: null },
  { pattern: /wein|rotwein|weißwein|rosé/i, group: "Wein", sub: null },
  { pattern: /gin|vodka|whisky|rum|spirituosen/i, group: "Spirituosen", sub: null },
  { pattern: /konserve|öl|essig|pesto|asia fertig/i, group: "World Food & Konserven", sub: null },
  { pattern: /katzenstreu|tierbedarf/i, group: "Tierbedarf", sub: null },
  { pattern: /tampon|damenhygiene|inkontinenz/i, group: "Hygieneartikel", sub: null },
  { pattern: /antipasti|delikatesse|cracker|gebäck/i, group: "Feinkost & Delikatessen", sub: null },
];

/**
 * Infer demand_group (and optionally demand_sub_group) from product name when Claude did not return one.
 * Returns null if no keyword matches.
 */
export function getDemandGroupFallback(productName: string): DemandGroupFallbackResult | null {
  if (!productName || typeof productName !== "string") return null;
  const lower = productName.toLowerCase().trim();
  for (const { pattern, group, sub } of KEYWORD_MAP) {
    if (pattern.test(lower)) return { demand_group: group, demand_sub_group: sub };
  }
  return null;
}
