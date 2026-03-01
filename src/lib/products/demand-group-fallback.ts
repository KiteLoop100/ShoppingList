/**
 * Fallback: assign demand_group (and optionally demand_sub_group) from product
 * name keywords when Claude returns null. Used for crowdsourced / manual products.
 *
 * Uses official ALDI commodity group codes (##-Name format).
 */

export interface DemandGroupFallbackResult {
  demand_group: string;
  demand_sub_group: string | null;
}

const KEYWORD_MAP: Array<{ pattern: RegExp; group: string; sub: string | null }> = [
  // Bakery
  { pattern: /\bbrot\b|brötchen|toast\b|knäckebrot|baguette|croissant|semmel|aufback/i, group: "57-Brot/Kuchen", sub: null },
  { pattern: /\bkuchen\b|gebäck|torte|muffin/i, group: "57-Brot/Kuchen", sub: null },

  // Dairy & cheese
  { pattern: /milch|joghurt|quark|sahne|schmand/i, group: "83-Milch/Sahne/Butter", sub: null },
  { pattern: /\bbutter\b|margarine/i, group: "83-Milch/Sahne/Butter", sub: "04-Butter/tierische Fette" },
  { pattern: /käse\b|gouda|emmentaler|mozzarella|parmesan|camembert|feta|frischkäse/i, group: "84-Käse/Käseersatzprodukte", sub: null },
  { pattern: /\beier?\b/i, group: "55-Eier", sub: null },

  // Freezer
  { pattern: /tiefkühl|tk-|tiefkühltruhe/i, group: "78-TK Fertiggerichte/Pizzas", sub: null },
  { pattern: /\beis\b|eiscreme|speiseeis/i, group: "77-TK Desserts/Backwaren/Eis", sub: "02-Eis" },

  // Baking
  { pattern: /\bmehl\b|zucker\b|backzutat|hefe\b|stärke|grieß|backmischung/i, group: "89-Backartikel", sub: null },

  // Cleaning
  { pattern: /waschmittel|spülmittel|spülmaschine|weichspüler|allzweckreiniger|wc-reiniger|putzmittel/i, group: "06-Wasch-/Putz-/Reinigungsmittel", sub: null },

  // Sweets & snacking
  { pattern: /schokolade|schokoriegel|pralinen/i, group: "41-Schokolade/Pralinen", sub: null },
  { pattern: /chips|knabber/i, group: "86-Chips/Snacks", sub: null },
  { pattern: /kekse|gebäck|waffel/i, group: "42-Gebäck", sub: null },
  { pattern: /fruchtgummi|gummibärchen|bonbon|kaugummi|lakritz/i, group: "40-Bonbons/Kaugummi", sub: null },
  { pattern: /nüsse|trockenfrüchte|erdnüsse|mandeln|cashew/i, group: "87-Nüsse/Trockenfrüchte", sub: null },

  // Coffee & tea
  { pattern: /kaffee|espresso|kapsel/i, group: "45-Kaffee/Kakao", sub: null },
  { pattern: /\btee\b/i, group: "46-Tee", sub: null },

  // Non-alcoholic beverages
  { pattern: /mineralwasser|sprudel/i, group: "05-Wasser", sub: null },
  { pattern: /cola|limonade|softdrink/i, group: "80-CO2 Erfrischungsgetränke", sub: null },
  { pattern: /eistee|energy\s?drink|sport\s?drink/i, group: "79-Funktionsgetränke/Eistee", sub: null },
  { pattern: /saft|smoothie|nektar/i, group: "81-Fruchtsäfte/Sirupe", sub: null },
  { pattern: /pflanzenmilch|haferdrink|mandeldrink|sojadrink/i, group: "50-H-Milchprodukte/Milchersatzprodukte", sub: "04-Milchersatzprodukte" },

  // Pasta, rice & staples
  { pattern: /pasta|nudeln|teigwaren|spaghetti|penne|fusilli/i, group: "54-Nährmittel", sub: "02-Teigwaren" },
  { pattern: /\breis\b/i, group: "54-Nährmittel", sub: "01-Reis" },
  { pattern: /gewürz|kräuter getrocknet|pfeffer|salz\b/i, group: "54-Nährmittel", sub: "04-Kräuter/Gewürze/Würzzutaten" },

  // Body care & hygiene
  { pattern: /deodorant|duschgel|shampoo|haarpflege|seife|zahnpasta|mundpflege|rasur|gesichtspflege|make-up|kosmetik/i, group: "07-Kosmetik/Körperpflege", sub: null },

  // Paper products
  { pattern: /toilettenpapier|küchenrolle|taschentuch|serviette/i, group: "10-Papierwaren", sub: null },

  // Household foils
  { pattern: /alufolie|backpapier|frischhaltefolie|gefrierbeutel|müllsack|müllbeutel/i, group: "11-Folien/Tücher", sub: null },

  // Sauces & dressings
  { pattern: /ketchup|mayonnaise|bbq|dressing|senf\b|soße|sauce/i, group: "52-Dressings/Öle/Soßen", sub: null },
  { pattern: /speiseöl|olivenöl|sonnenblumenöl|essig/i, group: "52-Dressings/Öle/Soßen", sub: "02-Speiseöle" },

  // Deli meat
  { pattern: /wurst|salami|schinken|aufschnitt|mortadella/i, group: "69-Gekühlte Wurstwaren", sub: null },

  // Fish
  { pattern: /fisch|lachs|garnelen|hering|matjes|räucherfisch/i, group: "64-Fisch, frisch", sub: null },

  // Fresh meat
  { pattern: /fleisch|hackfleisch|rind\b|geflügel|kalb|hähnchen|pute|schwein/i, group: "62-Frischfleisch (ohne Schwein/Geflügel)", sub: null },

  // Breakfast & cereals
  { pattern: /müsli|cerealien|porridge|haferflocken|cornflakes|granola/i, group: "90-Cerealien/Snacks", sub: null },
  { pattern: /konfitüre|marmelade|honig|aufstrich|nutella/i, group: "53-Konfitüren/Brotaufstriche", sub: null },

  // Fruits & vegetables
  { pattern: /obst|banane|apfel|birne|traube|erdbeere|himbeere|blaubeere|kiwi|mango|ananas|avocado/i, group: "58-Obst", sub: null },
  { pattern: /gemüse|tomate|paprika|gurke|kartoffel|salat|zwiebel|brokkoli|blumenkohl|spinat|lauch|pilze|zucchini|aubergine/i, group: "38-Gemüse", sub: null },

  // Wine & spirits
  { pattern: /\bwein\b|rotwein|weißwein|rosé/i, group: "03-Wein", sub: null },
  { pattern: /gin\b|vodka|whisky|rum\b|spirituosen|likör/i, group: "01-Spirituosen", sub: null },
  { pattern: /\bbier\b|pils|weizen/i, group: "04-Bier", sub: null },

  // Canned goods
  { pattern: /konserve|fischkonserve|dose\b/i, group: "47-Konserven", sub: null },
  { pattern: /fertiggericht|suppe\b|eintopf/i, group: "48-Fertiggerichte/Suppen", sub: null },

  // Pet supplies
  { pattern: /katzenstreu|katzenfutter|hundefutter|tierfutter|tiernahrung/i, group: "85-Tiernahrung", sub: null },

  // Baby & hygiene
  { pattern: /tampon|damenhygiene|inkontinenz|windeln|babypflege/i, group: "08-Körperhygiene", sub: null },
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
