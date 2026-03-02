import { createClientIfConfigured } from "@/lib/supabase/client";
import { log } from "@/lib/utils/logger";

const BUCKET = "competitor-product-photos";

/**
 * Upload a photo to the competitor-product-photos bucket.
 * Returns the public URL on success, null on failure.
 */
export async function uploadCompetitorPhoto(
  productId: string,
  file: File,
  suffix?: string,
): Promise<string | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = suffix
    ? `${productId}_${suffix}.${ext}`
    : `${productId}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) {
    log.error("[uploadCompetitorPhoto] upload failed:", uploadErr);
    return null;
  }
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData?.publicUrl ?? null;
}
