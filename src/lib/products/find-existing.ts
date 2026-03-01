/**
 * Shared product duplicate-check: article_number → ean_barcode → name_normalized.
 * Priority order is critical for correctness and must not be changed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
}

export interface FindExistingResult {
  product_id: string;
  matched_by: "article_number" | "ean_barcode" | "name_normalized";
  [key: string]: unknown;
}

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

  if (fields.name_normalized) {
    const { data } = await supabase
      .from("products")
      .select(select)
      .ilike("name_normalized", fields.name_normalized)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (data) {
      return { ...(data as unknown as Record<string, unknown>), matched_by: "name_normalized" } as FindExistingResult;
    }
  }

  return null;
}
