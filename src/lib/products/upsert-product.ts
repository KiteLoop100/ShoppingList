/**
 * Shared product upsert: insert new or update existing with "don't overwrite" rule.
 *
 * Update behaviour (existingProductId provided):
 *   - Fetches the current record, then for each field in `data`:
 *     • FILL_EMPTY fields – only written when the existing value is null or "".
 *     • All other fields – always written when the incoming value is non-null.
 *   - `updated_at` is always set to now.
 *
 * Insert behaviour (no existingProductId):
 *   - All provided fields are written; `status`, `availability`,
 *     `created_at` and `updated_at` are defaulted if not supplied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductData {
  name?: string | null;
  name_normalized?: string | null;
  category_id?: string;
  article_number?: string | null;
  brand?: string | null;
  price?: number | null;
  price_updated_at?: string | null;
  weight_or_quantity?: string | null;
  assortment_type?: string;
  availability?: string;
  status?: string;
  source?: string;
  ean_barcode?: string | null;
  nutrition_info?: Record<string, unknown> | null;
  ingredients?: string | null;
  allergens?: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
  special_start_date?: string | null;
  special_end_date?: string | null;
  is_private_label?: boolean | null;
  is_seasonal?: boolean;
  country?: string;
  thumbnail_url?: string | null;
  thumbnail_back_url?: string | null;
  photo_source_id?: string | null;
  flyer_id?: string | null;
  flyer_page?: number | null;
}

/**
 * Fields that are only written when the existing DB value is null / empty.
 * Everything NOT in this set is always written (when the incoming value is non-null).
 */
const FILL_EMPTY_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "name_normalized",
  "brand",
  "ean_barcode",
  "nutrition_info",
  "ingredients",
  "allergens",
  "demand_group",
  "demand_sub_group",
  "weight_or_quantity",
  "is_private_label",
  "is_seasonal",
]);

export interface UpsertResult {
  product_id: string;
  created: boolean;
}

export async function upsertProduct(
  supabase: SupabaseClient,
  data: ProductData,
  existingProductId?: string | null,
): Promise<UpsertResult | null> {
  const now = new Date().toISOString();

  if (existingProductId) {
    const { data: current } = await supabase
      .from("products")
      .select("*")
      .eq("product_id", existingProductId)
      .single();

    const updates: Record<string, unknown> = { updated_at: now };

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (FILL_EMPTY_FIELDS.has(key)) {
        const existing = current?.[key];
        if ((existing == null || existing === "") && value != null && value !== "") {
          updates[key] = value;
        }
      } else {
        if (value != null) {
          updates[key] = value;
        }
      }
    }

    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("product_id", existingProductId);

    if (error) return null;
    return { product_id: existingProductId, created: false };
  }

  // Insert new product
  const insertData: Record<string, unknown> = {
    status: "active",
    availability: "national",
    created_at: now,
    updated_at: now,
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      insertData[key] = value;
    }
  }

  const { data: inserted, error } = await supabase
    .from("products")
    .insert(insertData)
    .select("product_id")
    .single();

  if (error || !inserted) return null;
  return { product_id: inserted.product_id, created: true };
}
