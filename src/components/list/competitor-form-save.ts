/**
 * Save logic for the competitor product form.
 * Handles create/update, price recording, and thumbnail upload.
 */

import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { uploadCompetitorPhoto } from "@/lib/competitor-products/upload-competitor-photo";
import type { CompetitorProduct } from "@/types";
import type { ExtractedCompetitorProductInfo } from "@/lib/product-photo-studio/types";

function applyExtractedUpdates(
  updates: Partial<CompetitorProduct>,
  details: ExtractedCompetitorProductInfo | null,
  overwrite: boolean,
  existing?: CompetitorProduct,
) {
  if (!details) return;
  const set = (key: keyof CompetitorProduct, value: unknown) => {
    if (value == null) return;
    if (!overwrite && existing && existing[key] != null) return;
    (updates as Record<string, unknown>)[key] = value;
  };
  set("ingredients", details.ingredients);
  set("nutrition_info", details.nutrition_info as unknown as Record<string, unknown>);
  set("allergens", details.allergens);
  set("nutri_score", details.nutri_score);
  set("country_of_origin", details.country_of_origin);
  set("weight_or_quantity", details.weight_or_quantity);
  if (details.is_vegan) set("is_vegan", true);
  if (details.is_gluten_free) set("is_gluten_free", true);
  if (details.is_lactose_free) set("is_lactose_free", true);
  if (details.animal_welfare_level != null) set("animal_welfare_level", details.animal_welfare_level);
}

export async function saveCompetitorProduct(opts: {
  name: string;
  brand: string;
  ean: string;
  isBio: boolean;
  isEditMode: boolean;
  editProduct: CompetitorProduct | null | undefined;
  effectiveRetailer: string;
  price: string;
  extractedDetails: ExtractedCompetitorProductInfo | null;
  processedThumbnail: string | null;
  photoFiles: File[];
  country: string;
}): Promise<string> {
  let productId: string;

  if (opts.isEditMode && opts.editProduct) {
    productId = opts.editProduct.product_id;
    const updates: Partial<CompetitorProduct> = {
      name: opts.name,
      brand: opts.brand || null,
      ean_barcode: opts.ean || null,
      is_bio: opts.isBio,
    };
    applyExtractedUpdates(updates, opts.extractedDetails, true);
    await updateCompetitorProduct(productId, updates);
  } else {
    const product = await findOrCreateCompetitorProduct(opts.name, opts.country, opts.ean || null);
    productId = product.product_id;
    const updates: Partial<CompetitorProduct> = {};
    if (product.name !== opts.name) updates.name = opts.name;
    if (opts.brand && !product.brand) updates.brand = opts.brand;
    if (opts.ean && !product.ean_barcode) updates.ean_barcode = opts.ean;
    if (opts.isBio !== (product.is_bio ?? false)) updates.is_bio = opts.isBio;
    applyExtractedUpdates(updates, opts.extractedDetails, false, product);
    if (Object.keys(updates).length > 0) await updateCompetitorProduct(productId, updates);
  }

  if (!opts.isEditMode) {
    const priceNum = parseFloat(opts.price.replace(",", "."));
    if (!isNaN(priceNum) && priceNum > 0) {
      await addCompetitorPrice(productId, opts.effectiveRetailer, priceNum);
    }
  }

  if (opts.processedThumbnail && opts.photoFiles.length > 0) {
    const thumbBlob = await fetch(opts.processedThumbnail).then((r) => r.blob());
    const thumbFile = new File([thumbBlob], "thumbnail.jpg", { type: "image/jpeg" });
    const url = await uploadCompetitorPhoto(productId, thumbFile, "front");
    if (url) await updateCompetitorProduct(productId, { thumbnail_url: url });
  }

  return productId;
}
