import type { Product, CompetitorProduct } from "@/types";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { eanVariants } from "@/lib/products/ean-utils";
import { log } from "@/lib/utils/logger";

export interface EanCrossRefResult {
  aldiProduct: Product | null;
  competitorProducts: CompetitorProduct[];
}

/**
 * Given an EAN, find matching products across both tables.
 * Excludes the source product identified by `excludeId`.
 */
export async function findEanCrossReferences(
  ean: string,
  excludeId: string,
): Promise<EanCrossRefResult> {
  const result: EanCrossRefResult = { aldiProduct: null, competitorProducts: [] };
  const variants = eanVariants(ean);
  if (variants.length === 0) return result;

  const supabase = createClientIfConfigured();
  if (!supabase) return result;

  try {
    const [aldiResult, competitorResult] = await Promise.all([
      supabase
        .from("products")
        .select("product_id, name, price, thumbnail_url, brand, ean_barcode")
        .in("ean_barcode", variants)
        .eq("status", "active")
        .neq("product_id", excludeId)
        .limit(1),
      supabase
        .from("competitor_products")
        .select("product_id, name, brand, ean_barcode, thumbnail_url, retailer")
        .in("ean_barcode", variants)
        .eq("status", "active")
        .neq("product_id", excludeId)
        .limit(5),
    ]);

    if (aldiResult.data && aldiResult.data.length > 0) {
      const row = aldiResult.data[0];
      result.aldiProduct = {
        product_id: row.product_id,
        name: row.name,
        price: row.price,
        thumbnail_url: row.thumbnail_url,
        brand: row.brand,
        ean_barcode: row.ean_barcode,
      } as Product;
    }

    if (competitorResult.data) {
      result.competitorProducts = competitorResult.data.map((row) => ({
        product_id: row.product_id,
        name: row.name,
        brand: row.brand,
        ean_barcode: row.ean_barcode,
        thumbnail_url: row.thumbnail_url,
        retailer: row.retailer,
      })) as CompetitorProduct[];
    }
  } catch (err) {
    log.warn("[ean-cross-reference] lookup failed:", err);
  }

  return result;
}
