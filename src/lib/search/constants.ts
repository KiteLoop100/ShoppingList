/**
 * Search configuration constants.
 * Central place for all thresholds, weights, and patterns.
 * See specs/SEARCH-ARCHITECTURE.md §11 for documentation.
 */

// --- Result limits ---
export const MAX_RESULTS = 50;
export const SMART_DEFAULT_RESULTS = 10;
export const SMART_DEFAULT_MIN_HISTORY = 3;
export const MIN_QUERY_LENGTH = 1;
export const DEBOUNCE_MS = 150;

// --- Fuzzy matching (Phase 2) ---
export const MAX_LEVENSHTEIN_DISTANCE = 2;
export const MIN_WORD_LENGTH_FOR_FUZZY = 5;

// --- Plural stemming ---
export const MIN_STEM_LENGTH = 4;

// --- Match type enum ---
export enum MatchType {
  EXACT_NAME = 1,
  NAME_STARTS_WITH = 2,
  NAME_FIRST_WORD = 3,
  NAME_CONTAINS_STANDALONE = 4,
  NAME_CONTAINS_DOMINANT = 5,
  NAME_CONTAINS_MODIFIER = 6,
  MULTI_WORD_ALL = 7,
  CATEGORY_MATCH = 8,
  BRAND_MATCH = 9,
  DEMAND_GROUP = 10,
  FUZZY_MATCH = 11,
}

// --- Match scores (higher = better match) ---
export const MATCH_SCORES: Record<MatchType, number> = {
  [MatchType.EXACT_NAME]: 100,
  [MatchType.NAME_STARTS_WITH]: 90,
  [MatchType.NAME_FIRST_WORD]: 85,
  [MatchType.NAME_CONTAINS_STANDALONE]: 80,
  [MatchType.NAME_CONTAINS_DOMINANT]: 75,
  [MatchType.NAME_CONTAINS_MODIFIER]: 25,
  [MatchType.MULTI_WORD_ALL]: 70,
  [MatchType.CATEGORY_MATCH]: 60,
  [MatchType.BRAND_MATCH]: 55,
  [MatchType.DEMAND_GROUP]: 50,
  [MatchType.FUZZY_MATCH]: 35,
};

// --- Signal weights by query length ---
export const WEIGHTS_SHORT_QUERY = {
  match: 0.30,
  popularity: 0.25,
  personal: 0.25,
  preference: 0.10,
  freshness: 0.10,
} as const;

export const WEIGHTS_LONG_QUERY = {
  match: 0.50,
  popularity: 0.10,
  personal: 0.15,
  preference: 0.10,
  freshness: 0.15,
} as const;

export const LONG_QUERY_THRESHOLD = 3; // words

// --- Recency decay tiers ---
export const RECENCY_TIERS = [
  { maxDays: 7, score: 50 },
  { maxDays: 30, score: 35 },
  { maxDays: 90, score: 20 },
  { maxDays: 180, score: 10 },
] as const;

// --- Freshness scores ---
export const ACTIVE_SPECIAL_BOOST = 30;
export const UPCOMING_SPECIAL_BOOST = 10;
export const IN_SEASON_BOOST = 20;
export const OUT_OF_SEASON_PENALTY = -20;

// --- Preference score cap ---
export const MAX_PREFERENCE_SCORE = 100;

// --- Purchase frequency score tiers ---
export const FREQUENCY_TIERS = [
  { minCount: 5, score: 50 },
  { minCount: 3, score: 35 },
  { minCount: 2, score: 25 },
  { minCount: 1, score: 15 },
] as const;

// --- Input preprocessing patterns ---
export const QUANTITY_SUFFIX_PATTERN =
  /\s+\d+[\.,]?\d*\s*(g|kg|ml|l|cl|stk|stück|pac|er|kne)\s*\.?\s*$/i;

export const ALDI_PREFIXES = ["KA:", "KA :"];

// --- German prepositions (for word boundary analysis) ---
export const PREPOSITIONS = [
  "in", "mit", "und", "auf", "aus", "ohne", "zum", "zur", "für", "von",
] as const;

// --- Plural suffixes (for stem variants) ---
export const PLURAL_SUFFIXES = ["en", "n", "e", "er", "s"] as const;

// --- Default popularity score (average of linear-normalized ALDI data) ---
export const DEFAULT_POPULARITY_SCORE = 0.025;

// --- Category affinity boost ---
// Bonus points when a product's demand_group matches the query's synonym mapping
// AND the product also has a name-based match. Rewards "double relevance".
export const CATEGORY_AFFINITY_BOOST = 15;
