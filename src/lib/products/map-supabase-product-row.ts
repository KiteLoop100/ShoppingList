import type { Product } from "@/types";
import type { Database } from "@/types/supabase";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];

/** Maps a Supabase `products` row to the app `Product` type (same rules as ProductsProvider sync). */
export function mapSupabaseProductRowToProduct(row: ProductRow): Product {
  return {
    ...row,
    country: row.country ?? "DE",
    demand_group_code: row.demand_group_code ?? "AK",
    assortment_type: (row.assortment_type as Product["assortment_type"]) ?? "daily_range",
    availability: (row.availability as Product["availability"]) ?? "national",
    status: (row.status as Product["status"]) ?? "active",
    source: (row.source as Product["source"]) ?? "admin",
    nutrition_info: row.nutrition_info as Record<string, unknown> | null,
  };
}
