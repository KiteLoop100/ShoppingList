import { createClientIfConfigured } from "@/lib/supabase/client";
import { log } from "@/lib/utils/logger";
import type { PhotoCategory } from "./classify-photo-category";
import { sortPhotos, type ProductPhoto, type ProductType } from "./types";

const GALLERY_BUCKET = "product-gallery";
const MAX_PHOTOS = 5;

function getClient() {
  const client = createClientIfConfigured();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

function idColumn(productType: ProductType): string {
  return productType === "aldi" ? "product_id" : "competitor_product_id";
}

export async function getProductPhotos(
  productId: string,
  productType: ProductType,
): Promise<ProductPhoto[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];

  const column = idColumn(productType);
  const { data, error } = await supabase
    .from("product_photos")
    .select("*")
    .eq(column, productId)
    .order("sort_order", { ascending: true });

  if (error) {
    log.warn("[ProductPhotoService] getProductPhotos failed:", error.message);
    return [];
  }
  return sortPhotos((data as ProductPhoto[]) ?? []);
}

export async function addProductPhoto(
  productId: string,
  productType: ProductType,
  file: File,
  category: PhotoCategory,
): Promise<ProductPhoto | null> {
  const supabase = getClient();
  const column = idColumn(productType);

  const { count, error: countErr } = await supabase
    .from("product_photos")
    .select("id", { count: "exact", head: true })
    .eq(column, productId);

  if (countErr) {
    log.error("[ProductPhotoService] count check failed:", countErr.message);
    return null;
  }
  if ((count ?? 0) >= MAX_PHOTOS) {
    throw new Error("Maximal 5 Fotos pro Produkt erlaubt");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(GALLERY_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadErr) {
    log.error("[ProductPhotoService] upload failed:", uploadErr.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(GALLERY_BUCKET)
    .getPublicUrl(storagePath);
  const photoUrl = urlData.publicUrl;

  const nextOrder =
    category === "thumbnail" ? 0 : category === "price_tag" ? 99 : (count ?? 0);

  const insertData: Record<string, unknown> = {
    [column]: productId,
    photo_url: photoUrl,
    storage_bucket: GALLERY_BUCKET,
    storage_path: storagePath,
    category,
    sort_order: nextOrder,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("product_photos")
    .insert(insertData)
    .select()
    .single();

  if (insertErr) {
    log.error("[ProductPhotoService] insert failed:", insertErr.message);
    await supabase.storage.from(GALLERY_BUCKET).remove([storagePath]);
    return null;
  }

  return inserted as ProductPhoto;
}

export async function deleteProductPhoto(photoId: string): Promise<boolean> {
  const supabase = getClient();

  const { data: photo, error: fetchErr } = await supabase
    .from("product_photos")
    .select("id, storage_bucket, storage_path, category")
    .eq("id", photoId)
    .single();

  if (fetchErr || !photo) {
    log.warn("[ProductPhotoService] photo not found:", photoId);
    return false;
  }

  const { error: deleteErr } = await supabase
    .from("product_photos")
    .delete()
    .eq("id", photoId);

  if (deleteErr) {
    log.error("[ProductPhotoService] delete failed:", deleteErr.message);
    return false;
  }

  // Only delete from storage for photos in our gallery bucket.
  // Legacy buckets (product-thumbnails, competitor-product-photos) are not touched.
  if (photo.storage_bucket === GALLERY_BUCKET) {
    const { error: storageErr } = await supabase.storage
      .from(GALLERY_BUCKET)
      .remove([photo.storage_path]);
    if (storageErr) {
      log.warn("[ProductPhotoService] storage delete failed:", storageErr.message);
    }
  }

  return true;
}

export async function setAsThumbnail(photoId: string): Promise<boolean> {
  const supabase = getClient();

  const { data: photo, error: fetchErr } = await supabase
    .from("product_photos")
    .select("id, product_id, competitor_product_id, category")
    .eq("id", photoId)
    .single();

  if (fetchErr || !photo) {
    log.warn("[ProductPhotoService] photo not found for setAsThumbnail:", photoId);
    return false;
  }
  if (photo.category === "price_tag") {
    log.warn("[ProductPhotoService] cannot set price_tag as thumbnail");
    return false;
  }

  const column = photo.product_id ? "product_id" : "competitor_product_id";
  const ownerProductId = photo.product_id ?? photo.competitor_product_id;

  // Demote all current thumbnails to 'product'
  const { error: demoteErr } = await supabase
    .from("product_photos")
    .update({ category: "product" })
    .eq(column, ownerProductId!)
    .eq("category", "thumbnail");

  if (demoteErr) {
    log.error("[ProductPhotoService] demote failed:", demoteErr.message);
    return false;
  }

  // Promote this photo to thumbnail
  const { error: promoteErr } = await supabase
    .from("product_photos")
    .update({ category: "thumbnail", sort_order: 0 })
    .eq("id", photoId);

  if (promoteErr) {
    log.error("[ProductPhotoService] promote failed:", promoteErr.message);
    return false;
  }

  return true;
}

export async function updatePhotoCategory(
  photoId: string,
  newCategory: PhotoCategory,
): Promise<boolean> {
  if (newCategory === "thumbnail") {
    return setAsThumbnail(photoId);
  }

  const supabase = getClient();
  const { error } = await supabase
    .from("product_photos")
    .update({ category: newCategory })
    .eq("id", photoId);

  if (error) {
    log.error("[ProductPhotoService] updatePhotoCategory failed:", error.message);
    return false;
  }
  return true;
}
