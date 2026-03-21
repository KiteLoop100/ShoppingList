import { describe, test, expect } from "vitest";
import type { ProductRow } from "../map-supabase-product-row";
import { mapSupabaseProductRowToProduct } from "../map-supabase-product-row";

function minimalRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    aliases: null,
    allergens: null,
    animal_welfare_level: null,
    article_number: null,
    assortment_type: "daily_range",
    availability: "national",
    availability_scope: null,
    base_price_text: null,
    brand: null,
    country: null,
    created_at: "2020-01-01T00:00:00Z",
    crowdsource_status: null,
    demand_group_code: null,
    demand_sub_group: null,
    ean_barcode: null,
    flyer_id: null,
    flyer_page: null,
    ingredients: null,
    is_bio: null,
    is_gluten_free: null,
    is_lactose_free: null,
    is_private_label: null,
    is_seasonal: null,
    is_vegan: null,
    name: "Test",
    name_normalized: "test",
    nutrition_info: null,
    photo_source_id: null,
    popularity_score: null,
    price: null,
    price_updated_at: null,
    product_id: "pid",
    receipt_abbreviation: null,
    region: null,
    source: "admin",
    special_end_date: null,
    special_start_date: null,
    status: "active",
    thumbnail_back_url: null,
    thumbnail_url: null,
    typical_shelf_life_days: null,
    updated_at: "2020-01-01T00:00:00Z",
    weight_or_quantity: null,
    ...overrides,
  };
}

describe("mapSupabaseProductRowToProduct", () => {
  test("fills defaults when country and demand_group_code are null", () => {
    const p = mapSupabaseProductRowToProduct(minimalRow());
    expect(p.country).toBe("DE");
    expect(p.demand_group_code).toBe("AK");
  });

  test("preserves null thumbnail_url", () => {
    const p = mapSupabaseProductRowToProduct(minimalRow({ thumbnail_url: null }));
    expect(p.thumbnail_url).toBeNull();
  });
});
