/**
 * Upload photo to Supabase Storage (product-photos) and enqueue for processing.
 * Inserts photo_uploads row then triggers API process-photo.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";

const BUCKET = "product-photos";

function generateUploadId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface UploadResult {
  uploadId: string;
  pendingOverwrite?: boolean;
}

export async function uploadPhotoAndEnqueue(
  blob: Blob,
  userId: string
): Promise<UploadResult | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const uploadId = generateUploadId();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${uploadId}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  const { error: insertError } = await supabase.from("photo_uploads").insert({
    upload_id: uploadId,
    user_id: userId,
    photo_url: photoUrl,
    status: "uploading",
    products_created: 0,
    products_updated: 0,
  });

  if (insertError) {
    console.error("photo_uploads insert failed:", insertError);
    return null;
  }

  // Trigger serverless processing (fire-and-forget; status will update via Realtime)
  fetch("/api/process-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId, photo_url: photoUrl }),
  }).catch((e) => console.error("process-photo trigger failed:", e));

  return { uploadId };
}
