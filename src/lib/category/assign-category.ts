/**
 * Assign category to a generic product name (ARCHITECTURE.md 4.3, F09).
 * Every product must receive a category, including generic entries.
 * MVP: rule-based keyword mapping with broad coverage.
 */

import { db } from "@/lib/db";
import { normalizeForSearch } from "@/lib/search/normalize";

export interface CategoryAssignment {
  category_id: string;
  confidence: number;
}

// Order matters: first match wins. More specific terms should come first.
const KEYWORD_MAP: { keywords: string[]; category_id: string }[] = [
  // Milchprodukte
  {
    keywords: [
      "milch",
      "joghurt",
      "kaese",
      "käse",
      "quark",
      "sahne",
      "butter",
      "frischkase",
      "frischkäse",
      "mozzarella",
      "parmesan",
      "camembert",
      "feta",
      "creme",
      "crème",
      "schlagsahne",
      "schmand",
      "speisequark",
      "magerquark",
      "frischmilch",
      "vollmilch",
      "fettarm",
      "h-milch",
      "haferdrink",
      "mandeldrink",
    ],
    category_id: "cat-milch",
  },
  // Obst & Gemüse
  {
    keywords: [
      "pink lady",
      "apfel",
      "äpfel",
      "banane",
      "bananen",
      "tomate",
      "tomaten",
      "gurke",
      "gurken",
      "obst",
      "gemuse",
      "gemüse",
      "salat",
      "zwiebel",
      "zwiebeln",
      "kartoffel",
      "kartoffeln",
      "mohre",
      "möhre",
      "karotte",
      "paprika",
      "orange",
      "orangen",
      "zitrone",
      "zitronen",
      "birne",
      "birnen",
      "traube",
      "trauben",
      "erdbeere",
      "erdbeeren",
      "himbeere",
      "blaubeere",
      "kiwi",
      "avocado",
      "brokkoli",
      "blumenkohl",
      "spinat",
      "lauch",
      "sellerie",
      "radieschen",
      "pilze",
      "weintraube",
    ],
    category_id: "cat-obst-gemuese",
  },
  // Brot & Backwaren
  {
    keywords: [
      "brot",
      "brötchen",
      "brotchen",
      "toast",
      "toastbrot",
      "croissant",
      "semmel",
      "bröt",
      "vollkornbrot",
      "mischbrot",
      "graham",
      "baguette",
      "ciabatta",
      "keks",
      "kekse",
      "zwieback",
      "knäckebrot",
    ],
    category_id: "cat-brot",
  },
  // Fleisch & Wurst
  {
    keywords: [
      "fleisch",
      "wurst",
      "aufschnitt",
      "salami",
      "schinken",
      "hackfleisch",
      "hack",
      "geflügel",
      "hähnchen",
      "hahnchen",
      "pute",
      "rind",
      "schwein",
      "bratwurst",
      "wiener",
      "leberwurst",
      "teewurst",
      "mortadella",
      "speck",
      "bacon",
    ],
    category_id: "cat-fleisch",
  },
  // Tiefkühl
  {
    keywords: [
      "tiefkuhl",
      "tiefkühl",
      "eis",
      "eiscreme",
      "pizza",
      "pommes",
      "frites",
      "frozen",
      "frosta",
      "fischstäbchen",
      "fischstabchen",
      "gemüse mix",
      "spinattaschen",
      "blätterteig",
      "blatterteig",
      "kräuter",
      "krauter",
    ],
    category_id: "cat-tiefkuehl",
  },
  // Getränke
  {
    keywords: [
      "wasser",
      "mineral",
      "saft",
      "getrank",
      "getränk",
      "cola",
      "limo",
      "limonade",
      "bier",
      "wein",
      "kaffee",
      "tee",
      "schorle",
      "apfelsaft",
      "orangensaft",
      "multivitamin",
      "energie",
      "sport",
      "trink",
    ],
    category_id: "cat-getraenke",
  },
  // Süßwaren & Snacks
  {
    keywords: [
      "schokolade",
      "suss",
      "süß",
      "snack",
      "gummibarchen",
      "gummibärchen",
      "chips",
      "nuss",
      "nüsse",
      "nuesse",
      "kekse",
      "müsli riegel",
      "muesli riegel",
      "popcorn",
      "salzstangen",
      "brezel",
      "schokoriegel",
      "marshmallow",
      "bonbon",
      "lakritz",
      "marmelade",
      "nutella",
      "honig",
      "aufstrich süß",
    ],
    category_id: "cat-suess",
  },
  // Grundnahrungsmittel
  {
    keywords: [
      "nudel",
      "nudeln",
      "reis",
      "mehl",
      "zucker",
      "öl",
      "ol",
      "müsli",
      "muesli",
      "haferflocken",
      "spaghetti",
      "pasta",
      "penne",
      "fusilli",
      "linsen",
      "bohnen",
      "kichererbse",
      "getreide",
      "margarine",
      "sonnenblumenöl",
      "olivenol",
      "olivenöl",
      "salz",
      "pfeffer",
      "gewürz",
      "gewurz",
      "brühe",
      "bruhe",
      "suppe",
      "tomatensauce",
      "sauce",
      "soße",
      "sosse",
    ],
    category_id: "cat-grundnahrung",
  },
  // Haushalt & Reinigung
  {
    keywords: [
      "waschmittel",
      "spulmittel",
      "spülmittel",
      "putzen",
      "reinig",
      "mullbeutel",
      "müllbeutel",
      "mull",
      "müll",
      "papier",
      "küchenrolle",
      "kuechenrolle",
      "toilettenpapier",
      "taschentuch",
      "spülschwamm",
      "spülbürste",
      "schwamm",
      "boden",
      "glasreiniger",
      "allzweck",
    ],
    category_id: "cat-haushalt",
  },
];

const FALLBACK_CATEGORY_ID = "cat-sonstiges";

export async function assignCategory(
  productName: string
): Promise<CategoryAssignment> {
  const normalized = normalizeForSearch(productName);
  if (!normalized) {
    const categories = await db.categories.toArray();
    const fallback = categories.find((c) => c.category_id === FALLBACK_CATEGORY_ID);
    return {
      category_id: fallback?.category_id ?? FALLBACK_CATEGORY_ID,
      confidence: 0.2,
    };
  }

  // First: check category_aliases (e.g. "pink lady" → Obst & Gemüse)
  const alias = await db.category_aliases
    .where("term_normalized")
    .equals(normalized)
    .first();
  if (alias) {
    return { category_id: alias.category_id, confidence: 0.95 };
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  // Whole phrase match first (e.g. "fettarme milch" -> milch)
  for (const { keywords, category_id } of KEYWORD_MAP) {
    if (keywords.some((k) => normalized.includes(k) || k.includes(normalized))) {
      return { category_id, confidence: 0.9 };
    }
  }

  // Word-by-word match
  for (const { keywords, category_id } of KEYWORD_MAP) {
    for (const word of words) {
      if (word.length < 2) continue;
      if (keywords.some((k) => k.includes(word) || word.includes(k))) {
        return { category_id, confidence: 0.8 };
      }
    }
  }

  // Guaranteed fallback: every product gets a category (F09)
  const categories = await db.categories.toArray();
  const sonstiges = categories.find((c) => c.category_id === FALLBACK_CATEGORY_ID);
  return {
    category_id: sonstiges?.category_id ?? FALLBACK_CATEGORY_ID,
    confidence: 0.3,
  };
}
