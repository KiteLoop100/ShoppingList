/**
 * Unified product save logic.
 * Routes to the correct backend depending on retailer:
 *   - ALDI → /api/products/create-manual (products table)
 *   - Other → competitor-product-service (competitor_products table)
 *
 * Runs a pre-save duplicate check (EAN / article_number) that throws
 * DuplicateProductError when the same product already exists for the
 * same retailer context. Different-retailer matches are allowed.
 */

import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { categorizeCompetitorProduct } from "@/lib/competitor-products/categorize-competitor-product";
import { uploadCompetitorPhoto } from "@/lib/competitor-products/upload-competitor-photo";
import { addProductPhoto } from "@/lib/product-photos/product-photo-service";
import { isHomeRetailer } from "@/lib/retailers/retailers";
import { assertNoDuplicate, DuplicateProductError } from "@/lib/products/duplicate-check";
import { log } from "@/lib/utils/logger";
import type { Product, CompetitorProduct } from "@/types";
import type { ExtractedProductInfo } from "@/lib/product-photo-studio/types";
import type { ProductCaptureValues, ProcessedGalleryPhotoClient } from "./hooks/use-product-capture-form";

export { DuplicateProductError } from "@/lib/products/duplicate-check";
export type { DuplicateCheckResult } from "@/lib/products/duplicate-check";

export interface SaveResult {
  productId: string;
  productType: "aldi" | "competitor";
  name: string;
  thumbnailUrl: string | null;
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

interface AldiSaveResult {
  productId: string;
  thumbnailUrl: string | null;
}

function normalizeNutritionForApi(info: unknown): Record<string, unknown> | null {
  if (info == null || typeof info !== "object" || Array.isArray(info)) return null;
  return info as Record<string, unknown>;
}

async function saveAldiProduct(
  values: ProductCaptureValues,
  editProduct: Product | null,
  extractedDetails: ExtractedProductInfo | null,
  processedThumbnail: string | null,
  galleryPhotos: ProcessedGalleryPhotoClient[],
): Promise<AldiSaveResult> {
  const rawPrice = values.price.trim() ? parseFloat(values.price.replace(",", ".")) : null;
  const price = rawPrice != null && Number.isFinite(rawPrice) ? rawPrice : null;

  const body: Record<string, unknown> = {
    name: values.name.trim(),
    brand: values.brand.trim() || null,
    price,
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
    aliases: values.aliases.length > 0 ? values.aliases : [],
    ingredients: extractedDetails?.ingredients ?? null,
    allergens: extractedDetails?.allergens ?? null,
    nutrition_info: normalizeNutritionForApi(extractedDetails?.nutrition_info ?? null),
    thumbnail_url: processedThumbnail?.startsWith("https://") ? processedThumbnail : null,
    thumbnail_base64: processedThumbnail?.startsWith("data:")
      ? processedThumbnail.split(",")[1] ?? null
      : null,
    thumbnail_format: processedThumbnail?.startsWith("data:")
      ? (processedThumbnail.match(/data:(image\/[^;]+);/)?.[1] ?? "image/jpeg")
      : null,
  };

  if (galleryPhotos.length > 0) {
    body.gallery_photos = galleryPhotos.map((gp) => ({
      image_base64: gp.dataUrl.split(",")[1] ?? "",
      format: gp.format,
      category: gp.category === "price_tag" ? "price_tag" : "product",
    }));
  }

  if (editProduct) {
    body.update_existing_product_id = editProduct.product_id;
  }

  const res = await fetch("/api/products/create-manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const detail =
      data && typeof data.details === "object" && data.details != null
        ? ` ${JSON.stringify(data.details)}`
        : "";
    throw new Error(`${data.error ?? "Save failed"}${detail}`);
  }
  const pid = (data.duplicate && data.existing_product_id)
    ? data.existing_product_id
    : data.product_id;
  return { productId: pid, thumbnailUrl: data.thumbnail_url ?? null };
}

interface CompetitorSaveResult {
  productId: string;
  thumbnailUrl: string | null;
}

async function saveCompetitorProduct(
  values: ProductCaptureValues,
  editProduct: CompetitorProduct | null,
  extractedDetails: ExtractedProductInfo | null,
  processedThumbnail: string | null,
  galleryPhotos: ProcessedGalleryPhotoClient[],
  photoFiles: File[],
  country: string,
): Promise<CompetitorSaveResult> {
  let productId: string;
  let savedThumbnailUrl: string | null = null;

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
      aliases: values.aliases.length > 0 ? values.aliases : [],
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
        { demandGroupFromAI: extractedDetails?.demand_group_code ?? extractedDetails?.demand_group },
      ).catch((err) => { log.warn("[saveCompetitorProduct] categorization failed:", err); });
    }
  }

  if (processedThumbnail) {
    try {
      const thumbBlob = await fetch(processedThumbnail).then((r) => r.blob());
      const isWebp = processedThumbnail.startsWith("data:image/webp");
      const ext = isWebp ? "webp" : "jpg";
      const mime = isWebp ? "image/webp" : "image/jpeg";
      const thumbFile = new File([thumbBlob], `thumbnail.${ext}`, { type: mime });
      const url = await uploadCompetitorPhoto(productId, thumbFile, "front");
      if (url) {
        savedThumbnailUrl = url;
        await updateCompetitorProduct(productId, { thumbnail_url: url });
        await addProductPhoto(productId, "competitor", thumbFile, "thumbnail")
          .catch((err) => { log.warn("[saveCompetitorProduct] product_photos insert failed:", err); });
      }
    } catch (err) {
      log.warn("[saveCompetitorProduct] thumbnail upload failed:", err);
    }
  }

  for (const gp of galleryPhotos) {
    try {
      const blob = await fetch(gp.dataUrl).then((r) => r.blob());
      const ext = gp.format.includes("webp") ? "webp" : "jpg";
      const mime = gp.format.includes("webp") ? "image/webp" : "image/jpeg";
      const file = new File([blob], `gallery.${ext}`, { type: mime });
      const url = await uploadCompetitorPhoto(productId, file, "extra");
      if (url) {
        await addProductPhoto(productId, "competitor", file, gp.category)
          .catch((err) => { log.warn("[saveCompetitorProduct] gallery photo insert failed:", err); });
      }
    } catch (err) {
      log.warn("[saveCompetitorProduct] gallery photo upload failed:", err);
    }
  }

  return { productId, thumbnailUrl: savedThumbnailUrl };
}

export async function saveProduct(opts: {
  values: ProductCaptureValues;
  editAldiProduct: Product | null;
  editCompetitorProduct: CompetitorProduct | null;
  extractedDetails: ExtractedProductInfo | null;
  processedThumbnail: string | null;
  processedGalleryPhotos?: ProcessedGalleryPhotoClient[];
  photoFiles: File[];
  country: string;
}): Promise<SaveResult> {
  const retailer = opts.values.retailer;
  const isAldi = isHomeRetailer(retailer || "");
  const isEdit = !!(opts.editAldiProduct || opts.editCompetitorProduct);

  if (!isEdit) {
    await assertNoDuplicate({
      ean_barcode: opts.values.ean.trim() || null,
      article_number: opts.values.articleNumber.trim() || null,
      targetRetailer: retailer || "ALDI",
    });
  }

  const gallery = opts.processedGalleryPhotos ?? [];

  if (isAldi || opts.editAldiProduct) {
    const aldiResult = await saveAldiProduct(
      opts.values,
      opts.editAldiProduct,
      opts.extractedDetails,
      opts.processedThumbnail,
      gallery,
    );
    return { productId: aldiResult.productId, productType: "aldi", name: opts.values.name.trim(), thumbnailUrl: aldiResult.thumbnailUrl };
  }

  const compResult = await saveCompetitorProduct(
    opts.values,
    opts.editCompetitorProduct,
    opts.extractedDetails,
    opts.processedThumbnail,
    gallery,
    opts.photoFiles,
    opts.country,
  );
  return { productId: compResult.productId, productType: "competitor", name: opts.values.name.trim(), thumbnailUrl: compResult.thumbnailUrl };
}
