/**
 * Scoring engine: computes a weighted total score for each search candidate.
 * Combines 5 signals: match quality, popularity, personal relevance,
 * user preferences, and freshness.
 * See specs/SEARCH-ARCHITECTURE.md §5.
 */

import {
  MatchType,
  MATCH_SCORES,
  WEIGHTS_SHORT_QUERY,
  WEIGHTS_LONG_QUERY,
  LONG_QUERY_THRESHOLD,
  RECENCY_TIERS,
  FREQUENCY_TIERS,
  ACTIVE_SPECIAL_BOOST,
  UPCOMING_SPECIAL_BOOST,
  MAX_PREFERENCE_SCORE,
  DEFAULT_POPULARITY_SCORE,
  CATEGORY_AFFINITY_BOOST,
} from "./constants";
import type { SearchCandidate } from "./candidate-retrieval";
import type { ProductPreferences } from "@/lib/settings/product-preferences";
import { findSynonym, matchesDemandGroupPrefixes } from "./synonym-map";
import { preprocessQuery } from "./query-preprocessor";

/** Stored per-user product preference (from user_product_preferences table) */
export interface UserProductPreference {
  product_id: string;
  purchase_count: number;
  last_purchased_at: string; // ISO date string
}

export interface ScoredCandidate extends SearchCandidate {
  totalScore: number;
  matchScore: number;
  popularityScore: number;
  personalScore: number;
  preferenceScore: number;
  freshnessScore: number;
}

/**
 * Score and rank an array of search candidates.
 * Returns candidates sorted by totalScore descending.
 */
export function scoreAndRank(
  candidates: SearchCandidate[],
  queryWordCount: number,
  preferences: ProductPreferences,
  userHistory: Map<string, UserProductPreference>,
  now?: Date,
  rawQuery?: string
): ScoredCandidate[] {
  const today = now ?? new Date();
  const weights = queryWordCount >= LONG_QUERY_THRESHOLD
    ? WEIGHTS_LONG_QUERY
    : WEIGHTS_SHORT_QUERY;

  const scored = candidates.map((candidate): ScoredCandidate => {
    const matchScore = computeMatchScore(candidate, rawQuery);
    const popularityScore = computePopularityScore(candidate);
    const personalScore = computePersonalScore(candidate, userHistory, today);
    const preferenceScore = computePreferenceScore(candidate, preferences);
    const freshnessScore = computeFreshnessScore(candidate, today);

    const totalScore =
      matchScore * weights.match +
      popularityScore * weights.popularity +
      personalScore * weights.personal +
      preferenceScore * weights.preference +
      freshnessScore * weights.freshness;

    return {
      ...candidate,
      totalScore,
      matchScore,
      popularityScore,
      personalScore,
      preferenceScore,
      freshnessScore,
    };
  });

  // Sort: totalScore DESC, then matchType ASC (better match wins), then name A-Z
  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.matchType !== b.matchType) return a.matchType - b.matchType;
    return a.product.search_name.localeCompare(b.product.search_name, "de");
  });

  return scored;
}

// ──── Signal 1: Match Quality ────

function computeMatchScore(candidate: SearchCandidate, rawQuery?: string): number {
  let score = MATCH_SCORES[candidate.matchType] ?? 0;

  // Category affinity boost: if the product belongs to the synonym-mapped
  // category AND has a name-based match, add bonus points.
  // This ensures "Vollmilch 1L" (dairy) ranks above "Bärenmarke H-Milch" (also dairy)
  // and both rank well above "Milch Maeuse" (chocolate).
  if (rawQuery) {
    const { normalized } = preprocessQuery(rawQuery);
    const synonym = findSynonym(normalized);
    if (
      synonym &&
      candidate.product.demand_group_normalized &&
      matchesDemandGroupPrefixes(
        candidate.product.demand_group_normalized,
        synonym.demand_group_prefixes
      )
    ) {
      score += CATEGORY_AFFINITY_BOOST;
    }
  }

  return score;
}

// ──── Signal 2: Popularity ────

function computePopularityScore(candidate: SearchCandidate): number {
  const raw = candidate.product.popularity_score ?? DEFAULT_POPULARITY_SCORE;
  return raw * 100;
}

// ──── Signal 3: Personal Relevance ────

function computePersonalScore(
  candidate: SearchCandidate,
  userHistory: Map<string, UserProductPreference>,
  today: Date
): number {
  const pref = userHistory.get(candidate.product.product_id);
  if (!pref) return 0;

  const frequencyScore = computeFrequencyScore(pref.purchase_count);
  const recencyScore = computeRecencyScore(pref.last_purchased_at, today);

  return Math.min(frequencyScore + recencyScore, 100);
}

function computeFrequencyScore(purchaseCount: number): number {
  for (const tier of FREQUENCY_TIERS) {
    if (purchaseCount >= tier.minCount) return tier.score;
  }
  return 0;
}

function computeRecencyScore(lastPurchasedAt: string, today: Date): number {
  const lastDate = new Date(lastPurchasedAt);
  const diffMs = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  for (const tier of RECENCY_TIERS) {
    if (diffDays <= tier.maxDays) return tier.score;
  }
  return 0;
}

// ──── Signal 4: User Preferences ────

function computePreferenceScore(
  candidate: SearchCandidate,
  prefs: ProductPreferences
): number {
  const p = candidate.product;
  let score = 0;

  if (prefs.prefer_bio && p.is_bio) {
    score += 25;
  }
  if (prefs.prefer_vegan && p.is_vegan) {
    score += 25;
  }
  if (prefs.prefer_brand && p.is_private_label === false) {
    score += 25;
  }
  if (prefs.prefer_cheapest && p.price != null) {
    score += 50 - Math.min(p.price, 50);
  }
  if (
    prefs.prefer_animal_welfare &&
    p.animal_welfare_level != null &&
    p.animal_welfare_level > 0
  ) {
    score += p.animal_welfare_level * 8;
  }

  return Math.min(score, MAX_PREFERENCE_SCORE);
}

// ──── Signal 5: Freshness ────

function computeFreshnessScore(
  candidate: SearchCandidate,
  today: Date
): number {
  const p = candidate.product;

  // Only relevant for specials
  if (p.assortment_type === "daily_range") return 0;

  const start = p.special_start_date ? new Date(p.special_start_date) : null;
  const end = p.special_end_date ? new Date(p.special_end_date) : null;

  // Currently active special
  if (start && end && start <= today && today <= end) {
    return ACTIVE_SPECIAL_BOOST;
  }

  // Upcoming special (starts within next 7 days)
  if (start && start > today) {
    const daysUntilStart = Math.floor(
      (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilStart <= 7) {
      return UPCOMING_SPECIAL_BOOST;
    }
  }

  // Expired special – will be excluded in post-processor, score 0 here
  return 0;
}
