/**
 * Unified product save logic.
 * Routes to the correct backend depending on retailer:
 *   - ALDI → /api/products/create-manual (products table)
 *   - Other → competitor-product-service (competitor_products table)
 */

import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { categorizeCompetitorProduct } from "@/lib/competitor-products/categorize-competitor-product";
import { uploadCompetitorPhoto } from "@/lib/competitor-products/upload-competitor-photo";
import { isHomeRetailer } from "@/lib/retailers/retailers";
import { log } from "@/lib/utils/logger";
import type { Product, CompetitorProduct } from "@/types";
import type { ExtractedProductInfo } from "@/lib/product-photo-studio/types";
import type { ProductCaptureValues } from "./hooks/use-product-capture-form";

export interface SaveResult {
  productId: string;
  productType: "aldi" | "competitor";
}

function applyExtractedUpdates(
  updates: Partial<CompetitorProduct>,
  details: ExtractedProductInfo | null,
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

async function saveAldiProduct(
  values: ProductCaptureValues,
  editProduct: Product | null,
  extractedDetails: ExtractedProductInfo | null,
  processedThumbnail: string | null,
): Promise<string> {
  const body: Record<string, unknown> = {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    price: values.price.trim() ? parseFloat(values.price.replace(",", ".")) : null,
    ean_barcode: values.ean.trim() || null,
    article_number: values.articleNumber.trim() || null,
    weight_or_quantity: values.weightOrQuantity.trim() || null,
    demand_group_code: values.demandGroupCode || undefined,
    demand_sub_group: values.demandSubGroup || null,
    assortment_type: values.assortmentType || "daily_range",
    is_bio: values.isBio || null,
    is_vegan: values.isVegan || null,
    is_gluten_free: values.isGlutenFree || null,
    is_lactose_free: values.isLactoseFree || null,
    animal_welfare_level: values.animalWelfareLevel,
    ingredients: extractedDetails?.ingredients ?? null,
    allergens: extractedDetails?.allergens ?? null,
    nutrition_info: extractedDetails?.nutrition_info ?? null,
    thumbnail_url: processedThumbnail?.startsWith("https://") ? processedThumbnail : null,
    thumbnail_base64: processedThumbnail?.startsWith("data:")
      ? processedThumbnail.split(",")[1] ?? null
      : null,
    thumbnail_format: processedThumbnail?.startsWith("data:")
      ? (processedThumbnail.match(/data:(image\/[^;]+);/)?.[1] ?? "image/jpeg")
      : null,
  };

  if (editProduct) {
    body.update_existing_product_id = editProduct.product_id;
  }

  const res = await fetch("/api/products/create-manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Save failed");
  if (data.duplicate && data.existing_product_id) {
    return data.existing_product_id;
  }
  return data.product_id;
}

async function saveCompetitorProduct(
  values: ProductCaptureValues,
  editProduct: CompetitorProduct | null,
  extractedDetails: ExtractedProductInfo | null,
  processedThumbnail: string | null,
  photoFiles: File[],
  country: string,
): Promise<string> {
  let productId: string;

  if (editProduct) {
    productId = editProduct.product_id;
    const updates: Partial<CompetitorProduct> = {
      name: values.name.trim(),
      brand: values.brand.trim() || null,
      ean_barcode: values.ean.trim() || null,
      article_number: values.articleNumber.trim() || null,
      weight_or_quantity: values.weightOrQuantity.trim() || null,
      retailer: values.retailer || null,
      demand_group_code: values.demandGroupCode || null,
      demand_sub_group: values.demandSubGroup || null,
      assortment_type: values.assortmentType || null,
      is_bio: values.isBio,
      is_vegan: values.isVegan,
      is_gluten_free: values.isGlutenFree,
      is_lactose_free: values.isLactoseFree,
      animal_welfare_level: values.animalWelfareLevel,
    };
    applyExtractedUpdates(updates, extractedDetails, true);
    await updateCompetitorProduct(productId, updates);
  } else {
    const product = await findOrCreateCompetitorProduct(
      values.name.trim(),
      country,
      values.ean.trim() || null,
    );
    productId = product.product_id;

    const updates: Partial<CompetitorProduct> = {};
    if (product.name !== values.name.trim()) updates.name = values.name.trim();
    if (values.brand.trim() && !product.brand) updates.brand = values.brand.trim();
    if (values.ean.trim() && !product.ean_barcode) updates.ean_barcode = values.ean.trim();
    if (values.articleNumber.trim()) updates.article_number = values.articleNumber.trim();
    if (values.retailer) updates.retailer = values.retailer;
    if (values.demandGroupCode) updates.demand_group_code = values.demandGroupCode;
    if (values.demandSubGroup) updates.demand_sub_group = values.demandSubGroup;
    if (values.assortmentType) updates.assortment_type = values.assortmentType;
    if (values.isBio) updates.is_bio = true;
    if (values.isVegan) updates.is_vegan = true;
    if (values.isGlutenFree) updates.is_gluten_free = true;
    if (values.isLactoseFree) updates.is_lactose_free = true;
    if (values.animalWelfareLevel != null) updates.animal_welfare_level = values.animalWelfareLevel;
    if (values.weightOrQuantity.trim()) updates.weight_or_quantity = values.weightOrQuantity.trim();

    applyExtractedUpdates(updates, extractedDetails, false, product);
    if (Object.keys(updates).length > 0) await updateCompetitorProduct(productId, updates);
  }

  if (!editProduct) {
    const priceNum = parseFloat(values.price.replace(",", "."));
    if (!isNaN(priceNum) && priceNum > 0 && values.retailer) {
      await addCompetitorPrice(productId, values.retailer, priceNum);
    }

    if (!values.demandGroupCode) {
      categorizeCompetitorProduct(
        productId, values.name.trim(),
        { demandGroupFromAI: extractedDetails?.demand_group },
      ).catch((err) => { log.warn("[saveCompetitorProduct] categorization failed:", err); });
    }
  }

  if (processedThumbnail && photoFiles.length > 0) {
    try {
      const thumbBlob = await fetch(processedThumbnail).then((r) => r.blob());
      const isWebp = processedThumbnail.startsWith("data:image/webp");
      const ext = isWebp ? "webp" : "jpg";
      const mime = isWebp ? "image/webp" : "image/jpeg";
      const thumbFile = new File([thumbBlob], `thumbnail.${ext}`, { type: mime });
      const url = await uploadCompetitorPhoto(productId, thumbFile, "front");
      if (url) await updateCompetitorProduct(productId, { thumbnail_url: url });
    } catch (err) {
      log.warn("[saveCompetitorProduct] thumbnail upload failed:", err);
    }
  }

  return productId;
}

export async function saveProduct(opts: {
  values: ProductCaptureValues;
  editAldiProduct: Product | null;
  editCompetitorProduct: CompetitorProduct | null;
  extractedDetails: ExtractedProductInfo | null;
  processedThumbnail: string | null;
  photoFiles: File[];
  country: string;
}): Promise<SaveResult> {
  const retailer = opts.values.retailer;
  const isAldi = isHomeRetailer(retailer || "");

  if (isAldi || opts.editAldiProduct) {
    const productId = await saveAldiProduct(
      opts.values,
      opts.editAldiProduct,
      opts.extractedDetails,
      opts.processedThumbnail,
    );
    return { productId, productType: "aldi" };
  }

  const productId = await saveCompetitorProduct(
    opts.values,
    opts.editCompetitorProduct,
    opts.extractedDetails,
    opts.processedThumbnail,
    opts.photoFiles,
    opts.country,
  );
  return { productId, productType: "competitor" };
}
