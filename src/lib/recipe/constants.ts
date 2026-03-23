/**
 * Recipe feature constants (limits, domains, unit normalization).
 * @see specs/F-RECIPE-FEATURES-SPEC.md
 */

/** Maps extracted ingredient tiers to the shared numeric scale (D5 / matching engine). */
export enum MATCH_TIER {
  EXACT = 1,
  CATEGORY = 2,
  SUBSTITUTE = 3,
  UNAVAILABLE = 4,
}

/** Maximum servings in the recipe scaling UI (stepper upper bound). */
export const MAX_SERVINGS = 12;

/** Minimum servings in the recipe scaling UI. */
export const MIN_SERVINGS = 1;

/** Max assistant turns per cook session (rate UX + cost guard). */
export const MAX_COOK_TURNS = 10;

/**
 * Shared daily AI budget for F-RECIPE-COOK and recipe-suggestion flows (decision D8).
 * Enforced server-side; documented here for client copy and UI.
 */
export const DAILY_AI_RECIPE_LIMIT = 30;

/** Hostnames where JSON-LD / structured recipe data is common (hints for extraction UX, not a hard allowlist). */
export const SUPPORTED_RECIPE_DOMAINS: string[] = [
  "chefkoch.de",
  "lecker.de",
  "eatsmarter.de",
  "bbcgoodfood.com",
  "allrecipes.com",
  "kitchenstories.com",
  "einfachbacken.de",
  "gutekueche.at",
  "kochbar.de",
  "ichkoche.at",
];

/**
 * Normalizes German unit strings from scraped recipes to short tokens used in matching and UI.
 * Keys: common forms seen in the wild; values: canonical abbreviations / labels.
 */
/** Display/source name for manually entered recipes (matches i18n `manualSourceName`). */
export const MANUAL_RECIPE_SOURCE_NAME = "Manuell";

/**
 * Canonical units for manual ingredient rows (subset of {@link GERMAN_UNITS} values + common abbreviations).
 */
export const MANUAL_INGREDIENT_UNITS: readonly string[] = [
  "g",
  "kg",
  "ml",
  "l",
  "EL",
  "TL",
  "Stk",
  "Prise",
  "Bund",
  "Pkg",
  "Dose",
  "Becher",
] as const;

export const GERMAN_UNITS: Record<string, string> = {
  Esslöffel: "EL",
  Teelöffel: "TL",
  Gramm: "g",
  Kilogramm: "kg",
  Milliliter: "ml",
  Liter: "l",
  Stück: "Stk",
  Scheibe: "Scheibe",
  Zehe: "Zehe",
  Bund: "Bund",
  Packung: "Pkg",
  Dose: "Dose",
  Becher: "Becher",
  Prise: "Prise",
  Messerspitze: "Msp",
};
