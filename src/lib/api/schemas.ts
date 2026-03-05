import { z } from "zod";

// ─── confirm-photo ───────────────────────────────────────
export const confirmPhotoSchema = z.object({
  upload_id: z.string().min(1, "upload_id required"),
  action: z.enum(["confirm", "discard"]).default("confirm"),
  linked_product_id: z.string().optional(),
  product: z
    .object({
      name: z.string().nullish(),
      brand: z.string().nullish(),
      price: z.number().nullish(),
      ean_barcode: z.string().nullish(),
      article_number: z.string().nullish(),
      weight_or_quantity: z.string().nullish(),
      demand_group: z.string().nullish(),
      demand_sub_group: z.string().nullish(),
      nutrition_info: z.record(z.string(), z.unknown()).nullish(),
      ingredients: z.string().nullish(),
      allergens: z.string().nullish(),
    })
    .optional(),
});

// ─── apply-thumbnail-overwrites ──────────────────────────
export const applyThumbnailOverwritesSchema = z.object({
  upload_id: z.string().min(1, "upload_id required"),
  apply: z.boolean().optional(),
});

// ─── flyer-country ───────────────────────────────────────
export const flyerCountrySchema = z.object({
  flyer_id: z.string().min(1, "flyer_id required"),
  country: z.enum(["DE", "AT"], {
    error: "country must be DE or AT",
  }),
});

// ─── products/create-manual ──────────────────────────────
export const createManualSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  brand: z.string().nullish(),
  price: z.number().nullish(),
  ean_barcode: z.string().nullish(),
  article_number: z.string().nullish(),
  weight_or_quantity: z.string().nullish(),
  demand_group: z.string().nullish(),
  demand_sub_group: z.string().nullish(),
  ingredients: z.string().nullish(),
  allergens: z.string().nullish(),
  nutrition_info: z.record(z.string(), z.unknown()).nullish(),
  assortment_type: z
    .enum(["daily_range", "special", "special_food", "special_nonfood"])
    .nullish()
    .default("daily_range"),
  is_private_label: z.boolean().nullish(),
  is_seasonal: z.boolean().nullish(),
  is_bio: z.boolean().nullish(),
  is_vegan: z.boolean().nullish(),
  is_gluten_free: z.boolean().nullish(),
  is_lactose_free: z.boolean().nullish(),
  animal_welfare_level: z.number().int().min(0).max(4).nullish(),
  thumbnail_url: z.string().url().nullish(),
  extra_photo_urls: z.array(z.string().url()).max(10).default([]),
  data_upload_ids: z.array(z.string()).max(20).default([]),
  update_existing_product_id: z.string().nullish(),
});

// ─── products/search (GET query params) ──────────────────
export const productSearchSchema = z.object({
  q: z.string().min(1, "Search query required"),
  country: z.string().toUpperCase().default("DE"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
