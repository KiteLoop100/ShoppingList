/**
 * Fallback: assign demand_group (and optionally demand_sub_group) from product
 * name keywords when Claude returns null. Used for crowdsourced / manual products.
 *
 * Returns short codes: demand_group as "##", demand_sub_group as "##-##".
 */

export interface DemandGroupFallbackResult {
  demand_group: string;
  demand_sub_group: string | null;
}

const KEYWORD_MAP: Array<{ pattern: RegExp; group: string; sub: string | null }> = [
  // Bakery
  { pattern: /\bbrot\b|brötchen|toast\b|knäckebrot|baguette|croissant|semmel|aufback/i, group: "57", sub: null },
  { pattern: /\bkuchen\b|gebäck|torte|muffin/i, group: "57", sub: null },

  // Dairy & cheese
  { pattern: /milch|joghurt|quark|sahne|schmand/i, group: "83", sub: null },
  { pattern: /\bbutter\b|margarine/i, group: "83", sub: "83-04" },
  { pattern: /käse\b|gouda|emmentaler|mozzarella|parmesan|camembert|feta|frischkäse/i, group: "84", sub: null },
  { pattern: /\beier?\b/i, group: "55", sub: null },

  // Freezer
  { pattern: /tiefkühl|tk-|tiefkühltruhe/i, group: "78", sub: null },
  { pattern: /\beis\b|eiscreme|speiseeis/i, group: "77", sub: "77-02" },

  // Baking
  { pattern: /\bmehl\b|zucker\b|backzutat|hefe\b|stärke|grieß|backmischung/i, group: "89", sub: null },

  // Cleaning
  { pattern: /waschmittel|spülmittel|spülmaschine|weichspüler|allzweckreiniger|wc-reiniger|putzmittel/i, group: "06", sub: null },

  // Sweets & snacking
  { pattern: /schokolade|schokoriegel|pralinen/i, group: "41", sub: null },
  { pattern: /chips|knabber/i, group: "86", sub: null },
  { pattern: /kekse|gebäck|waffel/i, group: "42", sub: null },
  { pattern: /fruchtgummi|gummibärchen|bonbon|kaugummi|lakritz/i, group: "40", sub: null },
  { pattern: /nüsse|trockenfrüchte|erdnüsse|mandeln|cashew/i, group: "87", sub: null },

  // Coffee & tea
  { pattern: /kaffee|espresso|kapsel/i, group: "45", sub: null },
  { pattern: /\btee\b/i, group: "46", sub: null },

  // Non-alcoholic beverages
  { pattern: /mineralwasser|sprudel/i, group: "05", sub: null },
  { pattern: /cola|limonade|softdrink/i, group: "80", sub: null },
  { pattern: /eistee|energy\s?drink|sport\s?drink/i, group: "79", sub: null },
  { pattern: /saft|smoothie|nektar/i, group: "81", sub: null },
  { pattern: /pflanzenmilch|haferdrink|mandeldrink|sojadrink/i, group: "50", sub: "50-04" },

  // Pasta, rice & staples
  { pattern: /pasta|nudeln|teigwaren|spaghetti|penne|fusilli/i, group: "54", sub: "54-02" },
  { pattern: /\breis\b/i, group: "54", sub: "54-01" },
  { pattern: /gewürz|kräuter getrocknet|pfeffer|salz\b/i, group: "54", sub: "54-04" },

  // Body care & hygiene
  { pattern: /deodorant|duschgel|shampoo|haarpflege|seife|zahnpasta|mundpflege|rasur|gesichtspflege|make-up|kosmetik/i, group: "07", sub: null },

  // Paper products
  { pattern: /toilettenpapier|küchenrolle|taschentuch|serviette/i, group: "10", sub: null },

  // Household foils
  { pattern: /alufolie|backpapier|frischhaltefolie|gefrierbeutel|müllsack|müllbeutel/i, group: "11", sub: null },

  // Sauces & dressings
  { pattern: /ketchup|mayonnaise|bbq|dressing|senf\b|soße|sauce/i, group: "52", sub: null },
  { pattern: /speiseöl|olivenöl|sonnenblumenöl|essig/i, group: "52", sub: "52-02" },

  // Deli meat
  { pattern: /wurst|salami|schinken|aufschnitt|mortadella/i, group: "69", sub: null },

  // Fish
  { pattern: /fisch|lachs|garnelen|hering|matjes|räucherfisch/i, group: "64", sub: null },

  // Fresh meat
  { pattern: /fleisch|hackfleisch|rind\b|geflügel|kalb|hähnchen|pute|schwein/i, group: "62", sub: null },

  // Breakfast & cereals
  { pattern: /müsli|cerealien|porridge|haferflocken|cornflakes|granola/i, group: "90", sub: null },
  { pattern: /konfitüre|marmelade|honig|aufstrich|nutella/i, group: "53", sub: null },

  // Fruits & vegetables
  { pattern: /obst|banane|apfel|birne|traube|erdbeere|himbeere|blaubeere|kiwi|mango|ananas|avocado/i, group: "58", sub: null },
  { pattern: /gemüse|tomate|paprika|gurke|kartoffel|salat|zwiebel|brokkoli|blumenkohl|spinat|lauch|pilze|zucchini|aubergine/i, group: "38", sub: null },

  // Wine & spirits
  { pattern: /\bwein\b|rotwein|weißwein|rosé/i, group: "03", sub: null },
  { pattern: /gin\b|vodka|whisky|rum\b|spirituosen|likör/i, group: "01", sub: null },
  { pattern: /\bbier\b|pils|weizen/i, group: "04", sub: null },

  // Canned goods
  { pattern: /konserve|fischkonserve|dose\b/i, group: "47", sub: null },
  { pattern: /fertiggericht|suppe\b|eintopf/i, group: "48", sub: null },

  // Pet supplies
  { pattern: /katzenstreu|katzenfutter|hundefutter|tierfutter|tiernahrung/i, group: "85", sub: null },

  // Baby & hygiene
  { pattern: /tampon|damenhygiene|inkontinenz|windeln|babypflege/i, group: "08", sub: null },

  // Non-Food patterns
  { pattern: /rasenmäher|rasentrimmer|heckenschere|laubsauger|kettensäge|hochdruckreiniger/i, group: "31", sub: null },
  { pattern: /fernseher|\btv\b|monitor|beamer|soundbar/i, group: "20", sub: null },
  { pattern: /laptop|notebook|tablet|drucker|router|usb/i, group: "20", sub: "20-04" },
  { pattern: /smartphone|handy|ladegerät|ladekabel|kopfhörer|bluetooth/i, group: "20", sub: "20-06" },
  { pattern: /bohrmaschine|akkuschrauber|stichsäge|schleifmaschine|werkzeugkoffer/i, group: "22", sub: "22-01" },
  { pattern: /schrauben|dübel|nägel|klebeband/i, group: "22", sub: "22-04" },
  { pattern: /gartenmöbel|sonnenschirm|gartenschlauch|rasenmäher/i, group: "31", sub: null },
  { pattern: /pfanne|topf|backform|küchenwaage|thermometer|mixer|toaster|wasserkocher/i, group: "35", sub: null },
  { pattern: /bügeleisen|staubsauger|ventilator|heizlüfter/i, group: "35", sub: "35-01" },
  { pattern: /lichterkette|lampe|leuchte|led-|glühbirne/i, group: "92", sub: null },
  { pattern: /koffer|rucksack|handtasche|geldbörse/i, group: "30", sub: null },
  { pattern: /bettwäsche|handtuch|bademantel|decke|kissen/i, group: "18", sub: null },
  { pattern: /spielzeug|puzzle|lego|playmobil|plüschtier/i, group: "32", sub: null },
  { pattern: /fahrrad|fahrradhelm|fahrradlicht|luftpumpe/i, group: "33", sub: null },
  { pattern: /campingstuhl|zelt|schlafsack|isomatte|grill\b/i, group: "34", sub: null },
  { pattern: /turnschuh|laufschuh|sneaker|badeschuh|hausschuh/i, group: "36", sub: null },
];

/**
 * Infer demand_group from product name when Claude did not return one.
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
