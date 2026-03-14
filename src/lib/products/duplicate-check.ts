/**
 * Unified pre-save duplicate check across both products and competitor_products.
 * Retailer-aware: same EAN at different retailers is allowed (different DB entries).
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { eanVariants } from "@/lib/products/ean-utils";
import { isHomeRetailer } from "@/lib/retailers/retailers";
import { log } from "@/lib/utils/logger";

export interface DuplicateCheckResult {
  found: boolean;
  table: "products" | "competitor_products" | null;
  product_id: string | null;
  name: string | null;
  retailer: string | null;
  matched_by: "ean_barcode" | "article_number" | null;
  sameRetailerContext: boolean;
}

export class DuplicateProductError extends Error {
  constructor(public readonly duplicate: DuplicateCheckResult) {
    super(`Duplicate product found: ${duplicate.name} (${duplicate.matched_by})`);
    this.name = "DuplicateProductError";
  }
}

export async function checkForDuplicate(params: {
  ean_barcode?: string | null;
  article_number?: string | null;
  targetRetailer: string;
  excludeProductId?: string | null;
}): Promise<DuplicateCheckResult> {
  const empty: DuplicateCheckResult = {
    found: false, table: null, product_id: null,
    name: null, retailer: null, matched_by: null, sameRetailerContext: false,
  };

  const supabase = createClientIfConfigured();
  if (!supabase) return empty;

  const targetIsHome = isHomeRetailer(params.targetRetailer);

  if (params.ean_barcode) {
    const variants = eanVariants(params.ean_barcode);
    if (variants.length === 0) return empty;

    for (const v of variants) {
      const { data: aldiMatch } = await supabase
        .from("products")
        .select("product_id, name")
        .eq("ean_barcode", v)
        .eq("status", "active")
        .maybeSingle();

      if (aldiMatch && aldiMatch.product_id !== params.excludeProductId) {
        return {
          found: true,
          table: "products",
          product_id: aldiMatch.product_id,
          name: aldiMatch.name,
          retailer: "ALDI",
          matched_by: "ean_barcode",
          sameRetailerContext: targetIsHome,
        };
      }
    }

    for (const v of variants) {
      const { data: compMatch } = await supabase
        .from("competitor_products")
        .select("product_id, name, retailer")
        .eq("ean_barcode", v)
        .eq("status", "active")
        .maybeSingle();

      if (compMatch && compMatch.product_id !== params.excludeProductId) {
        const matchRetailer = compMatch.retailer ?? "";
        const sameRetailer = !targetIsHome &&
          matchRetailer.toLowerCase() === params.targetRetailer.toLowerCase();
        return {
          found: true,
          table: "competitor_products",
          product_id: compMatch.product_id,
          name: compMatch.name,
          retailer: matchRetailer,
          matched_by: "ean_barcode",
          sameRetailerContext: sameRetailer,
        };
      }
    }
  }

  if (params.article_number && targetIsHome) {
    const { data: artMatch } = await supabase
      .from("products")
      .select("product_id, name")
      .eq("article_number", params.article_number)
      .eq("status", "active")
      .maybeSingle();

    if (artMatch && artMatch.product_id !== params.excludeProductId) {
      return {
        found: true,
        table: "products",
        product_id: artMatch.product_id,
        name: artMatch.name,
        retailer: "ALDI",
        matched_by: "article_number",
        sameRetailerContext: true,
      };
    }
  }

  return empty;
}

/**
 * Run duplicate check and throw DuplicateProductError if a same-retailer
 * duplicate is found. Different-retailer matches are logged but allowed.
 */
export async function assertNoDuplicate(params: {
  ean_barcode?: string | null;
  article_number?: string | null;
  targetRetailer: string;
  excludeProductId?: string | null;
}): Promise<void> {
  const result = await checkForDuplicate(params);
  if (!result.found) return;

  if (result.sameRetailerContext) {
    throw new DuplicateProductError(result);
  }

  log.info(
    `[duplicate-check] EAN match found at different retailer (${result.retailer}), allowing save for ${params.targetRetailer}`,
  );
}
