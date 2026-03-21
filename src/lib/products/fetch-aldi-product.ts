import { createClientIfConfigured } from "@/lib/supabase/client";
import type { Product } from "@/types";
import { mapSupabaseProductRowToProduct, type ProductRow } from "./map-supabase-product-row";

/** Loads one ALDI product from Supabase (authoritative for thumbnail_url vs local cache). */
export async function fetchAldiProductByIdFromSupabase(productId: string): Promise<Product | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  if (error || !data) return null;
  return mapSupabaseProductRowToProduct(data as ProductRow);
}
