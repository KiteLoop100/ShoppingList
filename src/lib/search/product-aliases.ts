/**
 * Product-level aliases for query expansion.
 * Maps common consumer terms to ALDI product names (and vice versa).
 *
 * Unlike synonym-map.ts (which maps terms → demand group categories),
 * this module handles name-level equivalences where the user's search
 * term differs from the official ALDI product name.
 *
 * All entries are bidirectional: ["hafermilch", "haferdrink"] means
 * searching for either term will also match the other.
 *
 * Entries are written in natural German (with ä/ö/ü/ß) — normalizeName()
 * converts them at build time. For users who type "ae/oe/ue" instead of
 * "ä/ö/ü", add a separate entry with the "ae/oe/ue" spelling.
 */

import { normalizeName } from "@/lib/products/normalize";

/**
 * Bidirectional alias pairs. Both terms are stored normalized at build time.
 * Each pair means: if the user searches for termA, also search for termB
 * (and vice versa).
 */
const PRODUCT_ALIASES: [string, string][] = [

  // ──── Plant-based drinks ────
  // EU regulation: "Milch" reserved for animal milk, ALDI uses "Drink"
  ["hafermilch",      "haferdrink"],
  ["sojamilch",       "sojadrink"],
  ["mandelmilch",     "mandeldrink"],
  ["kokosmilch",      "kokosdrink"],
  ["reismilch",       "reisdrink"],
  ["cashewmilch",     "cashewdrink"],
  ["dinkelmilch",     "dinkeldrink"],
  ["haselnussmilch",  "haselnussdrink"],
  ["pflanzenmilch",   "pflanzendrink"],
  ["nussmilch",       "nussdrink"],
  ["erbsenmilch",     "erbsendrink"],

  // ──── Dairy & cheese ────
  ["reibekäse",       "geriebener käse"],
  ["reibekaese",      "geriebener kaese"],
  ["frischkäse",      "rahmfrischkäse"],
  ["frischkaese",     "rahmfrischkaese"],
  ["schmand",         "sauerrahm"],
  ["saure sahne",     "sauerrahm"],
  ["schmelzkäse",     "schmelzkäsezubereitung"],
  ["scheibenkäse",    "sandwichscheiben"],
  ["pizzakäse",       "gratinkäse"],
  ["pizzakaese",      "gratinkaese"],
  ["sahnejoghurt",    "rahmjoghurt"],
  ["kondensmilch",    "kaffeesahne"],
  ["dosenmilch",      "kondensmilch"],
  ["créme fraiche",   "creme fraiche"],
  ["creme fraiche",   "schmand"],
  ["quark",           "speisequark"],
  ["skyr",            "skyr natur"],
  ["schlagsahne",     "sprühsahne"],
  ["sahne",           "schlagsahne"],

  // ──── Meat & deli ────
  ["hackfleisch",     "rinderhackfleisch"],
  ["hackfleisch",     "schweinehackfleisch"],
  ["hackfleisch",     "mischgehacktes"],
  ["gehacktes",       "hackfleisch"],
  ["hack",            "hackfleisch"],
  ["frikadelle",      "bulette"],
  ["frikadelle",      "fleischpflanzerl"],
  ["fleischkäse",     "leberkäse"],
  ["fleischkaese",    "leberkaese"],
  ["wiener",          "wiener würstchen"],
  ["bockwurst",       "bockwürstchen"],
  ["bratwurst",       "rostbratwurst"],
  ["mett",            "schweinemett"],
  ["mett",            "hackepeter"],
  ["schinken",        "kochschinken"],
  ["schinken",        "hinterschinken"],
  ["putenbrust",      "putenbrustaufschnitt"],
  ["hähnchen",        "hähnchenbrustfilet"],
  ["haehnchen",       "haehnchenbrustfilet"],
  ["chicken",         "hähnchen"],
  ["gyros",           "schweinegyros"],

  // ──── Fish & seafood ────
  ["dosenthunfisch",  "thunfisch"],
  ["thunfisch",       "thunfischfilets"],
  ["lachs",           "lachsfilet"],
  ["garnelen",        "shrimps"],
  ["garnelen",        "crevetten"],
  ["fischstäbchen",   "fischstaebchen"],

  // ──── Bakery & bread ────
  ["aufbackbrötchen", "sonntagsbrötchen"],
  ["aufbackbroetchen","sonntagsbroetchen"],
  ["brötchen",        "aufbackbrötchen"],
  ["broetchen",       "aufbackbroetchen"],
  ["semmel",          "brötchen"],
  ["schrippe",        "brötchen"],
  ["weck",            "brötchen"],
  ["toastbrot",       "buttertoast"],
  ["toastbrot",       "sandwichtoast"],
  ["toast",           "buttertoast"],
  ["brezel",          "laugenbrezel"],
  ["breze",           "laugenbrezel"],

  // ──── Fruits & vegetables ────
  ["kartoffeln",      "speisekartoffeln"],
  ["kartoffel",       "speisekartoffeln"],
  ["tomaten",         "rispentomaten"],
  ["tomaten",         "strauchtomaten"],
  ["cherrytomaten",   "cocktailtomaten"],
  ["paprika",         "gemüsepaprika"],
  ["paprika",         "spitzpaprika"],
  ["äpfel",           "tafeläpfel"],
  ["aepfel",          "taefelaepfel"],
  ["zwiebeln",        "speisezwiebeln"],
  ["gurke",           "salatgurke"],
  ["möhren",          "karotten"],
  ["moehren",         "karotten"],
  ["mohrrüben",       "karotten"],
  ["champignons",     "pilze"],
  ["rucola",          "rauke"],
  ["feldsalat",       "rapunzel"],
  ["süßkartoffel",    "süßkartoffeln"],
  ["ingwer",          "ingwerwurzel"],
  ["knoblauch",       "knoblauchzehen"],
  ["zitrone",         "zitronen"],
  ["limette",         "limetten"],

  // ──── Canned / preserved ────
  ["dosentomaten",    "geschälte tomaten"],
  ["dosentomaten",    "gehackte tomaten"],
  ["dosenmais",       "gemüsemais"],
  ["passierte tomaten", "passata"],

  // ──── Frozen foods ────
  ["tiefkühlpizza",   "steinofen pizza"],
  ["tk pizza",        "steinofen pizza"],
  ["tiefkuehlpizza",  "steinofen pizza"],
  ["pommes",          "backofen frites"],
  ["pommes",          "frites"],
  ["pommes frites",   "backofen frites"],
  ["chicken nuggets", "hähnchen nuggets"],
  ["fischstäbchen",   "fish fingers"],
  ["kroketten",       "kartoffelkroketten"],
  ["tk gemüse",       "tiefkühlgemüse"],
  ["tiefkühlspinat",  "rahmspinat"],
  ["blattspinat",     "rahmspinat"],

  // ──── Pantry / dry goods ────
  ["cornflakes",      "knusperflakes"],
  ["müsli",           "knuspermüsli"],
  ["muesli",          "knusperflakes"],
  ["müsliriegel",     "cerealien riegel"],
  ["muesliriegel",    "cerealien riegel"],
  ["nutella",         "nuss nougat creme"],
  ["nutella",         "nusskati"],
  ["erdnussbutter",   "erdnusscreme"],
  ["peanut butter",   "erdnusscreme"],
  ["orangensaft",     "orangendirektsaft"],
  ["apfelsaft",       "apfeldirektsaft"],
  ["instantkaffee",   "löslicher kaffee"],
  ["cappuccino",      "cappuccino pulver"],
  ["ketchup",         "tomatenketchup"],
  ["mayo",            "mayonnaise"],
  ["mayo",            "delikatess mayonnaise"],
  ["mayonnaise",      "salatmayonnaise"],
  ["remoulade",       "salatmayonnaise"],
  ["sojasoße",        "sojasauce"],
  ["brühe",           "gemüsebrühe"],
  ["brühe",           "hühnerbrühe"],
  ["bouillon",        "brühe"],
  ["brokkoli",        "broccoli"],
  ["thymian",         "gewürz thymian"],
  ["pesto",           "pesto alla genovese"],

  // ──── Household ────
  ["klopapier",       "toilettenpapier"],
  ["spüli",           "spülmittel"],
  ["spueli",          "spuelmittel"],
  ["müllbeutel",      "müllsäcke"],
  ["müllbeutel",      "abfallsäcke"],
  ["muellbeutel",     "muellsaecke"],
  ["alufolie",        "aluminiumfolie"],
  ["frischhaltefolie","klarsichtfolie"],
  ["spülmaschinen tabs","geschirr reiniger tabs"],
  ["spueltabs",       "geschirr reiniger tabs"],
  ["spültabs",        "geschirr reiniger tabs"],
  ["tabs",            "geschirr reiniger tabs"],
  ["weichspüler",     "wäscheweichspüler"],
  ["weichspueler",    "waescheweichspueler"],
  ["küchenrolle",     "küchentücher"],
  ["küchenrolle",     "haushaltspapier"],
  ["kuechenrolle",    "kuechentuecher"],
  ["feuchttücher",    "feuchtes toilettenpapier"],
  ["feuchttuecher",   "feuchtes toilettenpapier"],
  ["putztücher",      "allzwecktücher"],
  ["lappen",          "allzwecktücher"],
  ["schwamm",         "topfreiniger"],
  ["entkalker",       "kalklöser"],

  // ──── Personal care ────
  ["duschgel",        "cremedusche"],
  ["deo",             "deodorant"],
  ["deo",             "antitranspirant"],
  ["bodylotion",      "körperlotion"],
  ["body lotion",     "körperlotion"],
  ["gesichtscreme",   "tagescreme"],
  ["handseife",       "flüssigseife"],
  ["handseife",       "cremeseife"],
  ["sonnencreme",     "sonnenmilch"],
  ["sonnencreme",     "sonnenschutz"],
  ["zahnpasta",       "zahncreme"],
  ["mundspülung",     "mundwasser"],
  ["wattepads",       "wattepads"],
  ["rasierer",        "rasierklingen"],
  ["pflaster",        "wundpflaster"],

  // ──── Regional German variants (Brötchen-Isoglosse etc.) ────
  ["pfannkuchen",     "eierkuchen"],
  ["berliner",        "krapfen"],
  ["topfen",          "quark"],
  ["rahm",            "sahne"],
  ["marille",         "aprikose"],
  ["karfiol",         "blumenkohl"],
  ["erdapfel",        "kartoffel"],
  ["paradeiser",      "tomate"],
  ["faschiertes",     "hackfleisch"],
  ["palatschinken",   "pfannkuchen"],
  ["obers",           "sahne"],

  // ──── Common abbreviations & informal terms ────
  ["oj",              "orangensaft"],
  ["apfelschorle",    "apfelsaftschorle"],
  ["sprudel",         "mineralwasser"],
  ["selters",         "mineralwasser"],
  ["cola",            "coca cola"],
  ["eistee",          "ice tea"],
  ["haribo",          "fruchtgummi"],
  ["gummibärchen",    "fruchtgummi"],
  ["tütensuppe",      "instant suppe"],
  ["fertiggericht",   "mikrowellengericht"],
];

type AliasLookup = Map<string, Set<string>>;

let aliasMap: AliasLookup | null = null;

function buildAliasMap(): AliasLookup {
  if (aliasMap) return aliasMap;

  aliasMap = new Map();
  for (const [a, b] of PRODUCT_ALIASES) {
    const normA = normalizeName(a);
    const normB = normalizeName(b);

    if (!aliasMap.has(normA)) aliasMap.set(normA, new Set());
    aliasMap.get(normA)!.add(normB);

    if (!aliasMap.has(normB)) aliasMap.set(normB, new Set());
    aliasMap.get(normB)!.add(normA);
  }
  return aliasMap;
}

/**
 * Expand a normalized query into additional search terms via alias lookup.
 * Returns an array of alternative terms (NOT including the original query).
 *
 * Supports three matching strategies:
 * 1. Exact match: "hafermilch" → ["haferdrink"]
 * 2. Partial word replacement: "bio hafermilch" → ["bio haferdrink"]
 *    (alias term appears as a whole word within the query)
 * 3. Compound word match: "hafermilchpulver" contains "hafermilch" →
 *    ["haferdrinkpulver"] (alias term is a prefix/substring of a compound word)
 */
export function expandQuery(normalizedQuery: string): string[] {
  const map = buildAliasMap();
  const expansions = new Set<string>();

  for (const [term, aliases] of map) {
    if (!normalizedQuery.includes(term)) continue;

    for (const alias of aliases) {
      const expanded = normalizedQuery.replace(term, alias);
      if (expanded !== normalizedQuery) {
        expansions.add(expanded);
      }
    }
  }

  return Array.from(expansions);
}

/** Reset cached alias map (for testing). */
export function _resetAliasMap(): void {
  aliasMap = null;
}
