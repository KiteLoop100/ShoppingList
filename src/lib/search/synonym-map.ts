/**
 * Synonym and hypernym map for product search.
 * Maps common search terms to demand_group prefixes.
 * See specs/SEARCH-ARCHITECTURE.md §4.5 and §8.
 *
 * Maintenance: Add entries based on user search logs (Phase 3).
 * Validated against: SELECT DISTINCT demand_group FROM products WHERE country='DE'
 */

interface SynonymEntry {
  /** Matches against the START of normalized demand_group values */
  demand_group_prefixes: string[];
}

/**
 * Map of normalized search terms → demand_group prefixes.
 * Keys must be normalized (lowercase, no diacritics, no special chars).
 * Prefixes are matched against normalized demand_group values.
 *
 * Example: "wein" → ["03 wein"] matches demand_group "03Wein" (normalized: "03 wein")
 */
const SYNONYM_MAP: Record<string, SynonymEntry> = {

  // ──── Alcoholic Beverages ────
  // Only generic terms map to categories. Specific terms like "rotwein",
  // "weisswein", "rose" are NOT here — they match by name and mapping them
  // to "03 wein" would return ALL wines (e.g. Rotwein when searching Weißwein).
  "wein":         { demand_group_prefixes: ["03 wein"] },
  "sekt":         { demand_group_prefixes: ["02 sekt"] },
  "prosecco":     { demand_group_prefixes: ["02 sekt"] },
  "champagner":   { demand_group_prefixes: ["02 sekt"] },
  "schaumwein":   { demand_group_prefixes: ["02 sekt"] },
  "bier":         { demand_group_prefixes: ["04 bier"] },
  "spirituosen":  { demand_group_prefixes: ["01 spirituosen"] },
  "schnaps":      { demand_group_prefixes: ["01 spirituosen"] },
  "likör":        { demand_group_prefixes: ["01 spirituosen"] },
  "likoer":       { demand_group_prefixes: ["01 spirituosen"] },
  "wodka":        { demand_group_prefixes: ["01 spirituosen"] },
  "whisky":       { demand_group_prefixes: ["01 spirituosen"] },
  "alkohol":      { demand_group_prefixes: ["01 spirituosen", "02 sekt", "03 wein", "04 bier"] },

  // ──── Non-Alcoholic Beverages ────
  "wasser":       { demand_group_prefixes: ["05 wasser"] },
  "sprudel":      { demand_group_prefixes: ["05 wasser"] },
  "saft":         { demand_group_prefixes: ["81 fruchtsaefte"] },
  "sirup":        { demand_group_prefixes: ["81 fruchtsaefte"] },
  "limo":         { demand_group_prefixes: ["80 co2 erfrischungsgetraenke"] },
  "limonade":     { demand_group_prefixes: ["80 co2 erfrischungsgetraenke"] },
  "cola":         { demand_group_prefixes: ["80 co2 erfrischungsgetraenke"] },
  "eistee":       { demand_group_prefixes: ["79 funktionsgetraenke"] },
  "energydrink":  { demand_group_prefixes: ["79 funktionsgetraenke"] },
  "energy drink": { demand_group_prefixes: ["79 funktionsgetraenke"] },
  "getraenke":    { demand_group_prefixes: ["05 wasser", "74 gekuehlte getraenke", "79 funktionsgetraenke", "80 co2 erfrischungsgetraenke", "81 fruchtsaefte"] },

  // ──── Dairy ────
  "milch":        { demand_group_prefixes: ["50 h milchprodukte", "83 milch"] },
  "joghurt":      { demand_group_prefixes: ["51 joghurts"] },
  "yoghurt":      { demand_group_prefixes: ["51 joghurts"] },
  "jogurt":       { demand_group_prefixes: ["51 joghurts"] },
  "quark":        { demand_group_prefixes: ["51 joghurts"] },
  "kaese":        { demand_group_prefixes: ["84 kaese"] },
  "butter":       { demand_group_prefixes: ["83 milch"] },
  "sahne":        { demand_group_prefixes: ["83 milch"] },
  "margarine":    { demand_group_prefixes: ["60 margarine"] },
  "eier":         { demand_group_prefixes: ["55 eier"] },
  "ei":           { demand_group_prefixes: ["55 eier"] },

  // ──── Meat & Fish ────
  "fleisch":      { demand_group_prefixes: ["62 frischfleisch", "67 gefluegel", "68 schweinefleisch", "70 gekuehltes verzehrfertiges fleisch"] },
  "schweinefleisch": { demand_group_prefixes: ["68 schweinefleisch"] },
  "rindfleisch":  { demand_group_prefixes: ["62 frischfleisch"] },
  "rind":         { demand_group_prefixes: ["62 frischfleisch"] },
  "gefluegel":    { demand_group_prefixes: ["67 gefluegel"] },
  "haehnchen":    { demand_group_prefixes: ["67 gefluegel"] },
  "huhn":         { demand_group_prefixes: ["67 gefluegel"] },
  "pute":         { demand_group_prefixes: ["67 gefluegel"] },
  "wurst":        { demand_group_prefixes: ["69 gekuehlte wurstwaren", "49 dauerwurst"] },
  "aufschnitt":   { demand_group_prefixes: ["69 gekuehlte wurstwaren"] },
  "schinken":     { demand_group_prefixes: ["69 gekuehlte wurstwaren", "49 dauerwurst"] },
  "fisch":        { demand_group_prefixes: ["64 fisch", "71 gekuehlter verzehrfertiger fisch"] },

  // ──── Fruits & Vegetables ────
  "obst":         { demand_group_prefixes: ["58 obst"] },
  "fruechte":     { demand_group_prefixes: ["58 obst"] },
  "gemuese":      { demand_group_prefixes: ["38 gemuese"] },
  "salat":        { demand_group_prefixes: ["88 salate"] },

  // ──── Bakery & Bread ────
  "brot":         { demand_group_prefixes: ["57 brot"] },
  "broetchen":    { demand_group_prefixes: ["56 bake off", "57 brot"] },
  "kuchen":       { demand_group_prefixes: ["57 brot"] },
  "backwaren":    { demand_group_prefixes: ["56 bake off", "57 brot"] },

  // ──── Pantry / Dry Goods ────
  "nudeln":       { demand_group_prefixes: ["54 naehrmittel"] },
  "pasta":        { demand_group_prefixes: ["54 naehrmittel"] },
  "reis":         { demand_group_prefixes: ["54 naehrmittel"] },
  "mehl":         { demand_group_prefixes: ["89 backartikel"] },
  "zucker":       { demand_group_prefixes: ["89 backartikel"] },
  "backen":       { demand_group_prefixes: ["89 backartikel"] },
  "oel":          { demand_group_prefixes: ["52 dressings"] },
  "olivenoel":    { demand_group_prefixes: ["52 dressings"] },
  "essig":        { demand_group_prefixes: ["52 dressings"] },
  "sosse":        { demand_group_prefixes: ["52 dressings"] },
  "sauce":        { demand_group_prefixes: ["52 dressings"] },
  "ketchup":      { demand_group_prefixes: ["52 dressings"] },
  "senf":         { demand_group_prefixes: ["52 dressings"] },
  "marmelade":    { demand_group_prefixes: ["53 konfitueren"] },
  "honig":        { demand_group_prefixes: ["53 konfitueren"] },
  "nutella":      { demand_group_prefixes: ["53 konfitueren"] },
  "aufstrich":    { demand_group_prefixes: ["53 konfitueren"] },
  "konserven":    { demand_group_prefixes: ["47 konserven", "82 wurst fleisch fischkonserven"] },
  "dose":         { demand_group_prefixes: ["47 konserven", "82 wurst fleisch fischkonserven"] },
  "fertiggericht": { demand_group_prefixes: ["48 fertiggerichte", "72 gekuehlte fertiggerichte"] },
  "suppe":        { demand_group_prefixes: ["48 fertiggerichte"] },
  "muesliriegel": { demand_group_prefixes: ["90 cerealien"] },
  "muesli":       { demand_group_prefixes: ["90 cerealien"] },
  "cerealien":    { demand_group_prefixes: ["90 cerealien"] },
  "haferflocken": { demand_group_prefixes: ["90 cerealien"] },

  // ──── Coffee & Tea ────
  "kaffee":       { demand_group_prefixes: ["45 kaffee"] },
  "espresso":     { demand_group_prefixes: ["45 kaffee"] },
  "kakao":        { demand_group_prefixes: ["45 kaffee"] },
  "tee":          { demand_group_prefixes: ["46 tee"] },

  // ──── Sweets & Snacks ────
  "schokolade":   { demand_group_prefixes: ["41 schokolade"] },
  "pralinen":     { demand_group_prefixes: ["41 schokolade"] },
  "bonbons":      { demand_group_prefixes: ["40 bonbons"] },
  "kaugummi":     { demand_group_prefixes: ["40 bonbons"] },
  "kekse":        { demand_group_prefixes: ["42 gebaeck"] },
  "gebaeck":      { demand_group_prefixes: ["42 gebaeck"] },
  "chips":        { demand_group_prefixes: ["86 chips"] },
  "snacks":       { demand_group_prefixes: ["86 chips", "44 salzgebaeck", "90 cerealien"] },
  "salzgebaeck":  { demand_group_prefixes: ["44 salzgebaeck"] },
  "nuesse":       { demand_group_prefixes: ["87 nuesse"] },
  "trockenfruechte": { demand_group_prefixes: ["87 nuesse"] },
  "suessigkeiten": { demand_group_prefixes: ["40 bonbons", "41 schokolade", "42 gebaeck"] },

  // ──── Frozen ────
  "tiefkuehl":    { demand_group_prefixes: ["75 tk fleisch", "76 tk obst", "77 tk desserts", "78 tk fertiggerichte"] },
  "tk":           { demand_group_prefixes: ["75 tk fleisch", "76 tk obst", "77 tk desserts", "78 tk fertiggerichte"] },
  "pizza":        { demand_group_prefixes: ["78 tk fertiggerichte"] },
  "eis":          { demand_group_prefixes: ["77 tk desserts"] },
  "eiscreme":     { demand_group_prefixes: ["77 tk desserts"] },

  // ──── Household & Personal Care ────
  "waschmittel":  { demand_group_prefixes: ["06 wasch"] },
  "putzmittel":   { demand_group_prefixes: ["06 wasch"] },
  "reiniger":     { demand_group_prefixes: ["06 wasch"] },
  "spuelmittel":  { demand_group_prefixes: ["06 wasch"] },
  "kosmetik":     { demand_group_prefixes: ["07 kosmetik"] },
  "creme":        { demand_group_prefixes: ["07 kosmetik"] },
  "shampoo":      { demand_group_prefixes: ["08 koerperhygiene"] },
  "duschgel":     { demand_group_prefixes: ["08 koerperhygiene"] },
  "zahnpasta":    { demand_group_prefixes: ["08 koerperhygiene"] },
  "toilettenpapier": { demand_group_prefixes: ["10 papierwaren"] },
  "taschentuecher": { demand_group_prefixes: ["10 papierwaren"] },
  "windeln":      { demand_group_prefixes: ["09 babyartikel"] },
  "baby":         { demand_group_prefixes: ["09 babyartikel"] },
  "batterien":    { demand_group_prefixes: ["12 audio"] },
  "tiernahrung":  { demand_group_prefixes: ["85 tiernahrung"] },
  "hundefutter":  { demand_group_prefixes: ["85 tiernahrung"] },
  "katzenfutter": { demand_group_prefixes: ["85 tiernahrung"] },
};

/**
 * Look up demand_group prefixes for a normalized search term.
 * Returns null if no synonym mapping exists.
 */
export function findSynonym(normalizedQuery: string): SynonymEntry | null {
  return SYNONYM_MAP[normalizedQuery] ?? null;
}

/**
 * Check if a product's demand_group_code matches any of the given prefixes.
 * Prefixes are in format "NN descriptive-name" (e.g. "05 wasser");
 * we extract the leading numeric code and compare against the product's code.
 */
export function matchesDemandGroupPrefixes(
  demandGroupCode: string | null,
  prefixes: string[]
): boolean {
  if (!demandGroupCode) return false;
  const code = demandGroupCode.trim().toUpperCase();
  return prefixes.some((prefix) => {
    const prefixCode = prefix.split(" ")[0].toUpperCase();
    return code === prefixCode;
  });
}
