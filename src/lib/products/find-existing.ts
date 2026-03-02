/**
 * Shared product duplicate-check: article_number -> ean_barcode -> name_normalized.
 * Priority order is critical for correctness and must not be changed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripFlyerSuffixes, normalizeArticleNumber } from "./normalize";

export interface FindProductFields {
  article_number?: string | null;
  ean_barcode?: string | null;
  name_normalized?: string | null;
}

export interface FindProductOptions {
  /** Skip EAN barcode lookup (e.g. for flyer_pdf or receipt processing) */
  skipEan?: boolean;
  /** Supabase select columns (default: "product_id") */
  select?: string;
  /** Enable fuzzy matching with suffix stripping and prefix search (for flyer imports) */
  fuzzy?: boolean;
}

export interface FindExistingResult {
  product_id: string;
  matched_by: "article_number" | "ean_barcode" | "name_normalized";
  [key: string]: unknown;
}

async function queryByName(
  supabase: SupabaseClient,
  select: string,
  pattern: string,
): Promise<FindExistingResult | null> {
  const { data } = await supabase
    .from("products")
    .select(select)
    .ilike("name_normalized", pattern)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (data) {
    return {
      ...(data as unknown as Record<string, unknown>),
      matched_by: "name_normalized",
    } as FindExistingResult;
  }
  return null;
}

const MIN_FUZZY_WORDS = 3;

export async function findExistingProduct(
  supabase: SupabaseClient,
  fields: FindProductFields,
  options?: FindProductOptions,
): Promise<FindExistingResult | null> {
  const select = options?.select ?? "product_id";

  if (fields.article_number) {
    const { data } = await supabase
      .from("products")
      .select(select)
      .eq("article_number", fields.article_number)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      return { ...(data as unknown as Record<string, unknown>), matched_by: "article_number" } as FindExistingResult;
    }
  }

  if (!options?.skipEan && fields.ean_barcode) {
    const { data } = await supabase
      .from("products")
      .select(select)
      .eq("ean_barcode", fields.ean_barcode)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      return { ...(data as unknown as Record<string, unknown>), matched_by: "ean_barcode" } as FindExistingResult;
    }
  }

  if (!fields.name_normalized) return null;

  const exact = await queryByName(supabase, select, fields.name_normalized);
  if (exact) return exact;

  if (!options?.fuzzy) return null;

  const cleaned = stripFlyerSuffixes(fields.name_normalized);
  if (cleaned !== fields.name_normalized && cleaned.length >= 6) {
    const cleanedExact = await queryByName(supabase, select, cleaned);
    if (cleanedExact) return cleanedExact;
  }

  const searchTerm = cleaned || fields.name_normalized;
  if (searchTerm.length >= 6) {
    const prefix = await queryByName(supabase, select, searchTerm + "%");
    if (prefix) return prefix;
  }

  const words = searchTerm.split(" ").filter((w) => w.length > 0);
  for (let len = words.length - 1; len >= MIN_FUZZY_WORDS; len--) {
    const truncated = words.slice(0, len).join(" ");
    if (truncated.length < 6) break;
    const match = await queryByName(supabase, select, truncated);
    if (match) return match;
  }

  return null;
}

/**
 * Dedicated receipt matching: article_number only, with normalization.
 * Skips the name_normalized fallback (useless for receipt abbreviations)
 * and the ean_barcode step (receipts don't carry EANs).
 *
 * Matching strategy:
 *  1. Exact match  (receipt "123456" → DB "123456")
 *  2. Prefix match (receipt "123456" → DB "123456001", "123456002", …)
 *     ALDI uses 9-digit numbers (6-digit base + 3-digit variant suffix)
 *     but receipts only print the 6-digit base.
 *
 * DB-side article_numbers are kept normalized by PG trigger;
 * this function normalizes the receipt-side value before querying.
 */
export async function findProductByArticleNumber(
  supabase: SupabaseClient,
  articleNumber: string | null | undefined,
  select = "product_id",
): Promise<FindExistingResult | null> {
  const normalized = normalizeArticleNumber(articleNumber);
  if (!normalized) return null;

  const { data: exact } = await supabase
    .from("products")
    .select(select)
    .eq("article_number", normalized)
    .eq("status", "active")
    .maybeSingle();

  if (exact) {
    return {
      ...(exact as unknown as Record<string, unknown>),
      matched_by: "article_number",
    } as FindExistingResult;
  }

  if (normalized.length >= 4 && normalized.length <= 7) {
    const { data: prefix } = await supabase
      .from("products")
      .select(select)
      .like("article_number", normalized + "%")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (prefix) {
      return {
        ...(prefix as unknown as Record<string, unknown>),
        matched_by: "article_number",
      } as FindExistingResult;
    }
  }

  return null;
}
