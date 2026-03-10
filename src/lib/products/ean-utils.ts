import type { Product } from "@/types";
import { createClientIfConfigured } from "@/lib/supabase/client";

export function eanVariants(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const variants = [t];
  const digits = t.replace(/\D/g, "");
  if (digits.length > 0 && digits.length <= 13) {
    const pad13 = digits.padStart(13, "0");
    if (pad13 !== t) variants.push(pad13);
    const pad8 = digits.padStart(8, "0");
    if (pad8 !== t && pad8 !== pad13) variants.push(pad8);
  }
  return [...new Set(variants)];
}

export async function findProductByEan(
  ean: string,
  products: Product[]
): Promise<Product | null> {
  const toTry = eanVariants(ean);
  for (const p of products) {
    if (p.ean_barcode == null) continue;
    const pVariants = eanVariants(p.ean_barcode);
    if (toTry.some((v) => pVariants.includes(v))) return p;
  }
  const supabase = createClientIfConfigured();
  if (!supabase) return null;
  for (const v of toTry) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("ean_barcode", v)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      return {
        product_id: String(data.product_id),
        article_number: data.article_number != null ? String(data.article_number) : null,
        ean_barcode: data.ean_barcode != null ? String(data.ean_barcode) : null,
        name: String(data.name),
        name_normalized: String(data.name_normalized),
        brand: data.brand != null ? String(data.brand) : null,
        demand_sub_group: data.demand_sub_group != null ? String(data.demand_sub_group) : null,
        demand_group_code: data.demand_group_code != null ? String(data.demand_group_code) : "AK",
        price: data.price != null ? Number(data.price) : null,
        price_updated_at: data.price_updated_at != null ? String(data.price_updated_at) : null,
        popularity_score: data.popularity_score != null ? Number(data.popularity_score) : null,
        assortment_type: (data.assortment_type as Product["assortment_type"]) ?? "daily_range",
        availability: (data.availability as Product["availability"]) ?? "national",
        region: data.region != null ? String(data.region) : null,
        country: data.country != null ? String(data.country) : "DE",
        special_start_date: data.special_start_date != null ? String(data.special_start_date) : null,
        special_end_date: data.special_end_date != null ? String(data.special_end_date) : null,
        status: (data.status as Product["status"]) ?? "active",
        source: (data.source as Product["source"]) ?? "admin",
        created_at: String(data.created_at),
        updated_at: String(data.updated_at),
        thumbnail_url: data.thumbnail_url != null ? String(data.thumbnail_url) : null,
        thumbnail_back_url: data.thumbnail_back_url != null ? String(data.thumbnail_back_url) : null,
      };
    }
  }
  return null;
}
