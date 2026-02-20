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
  console.log("[capture/upload] uploadPhotoAndEnqueue start, blob size:", blob.size, "userId:", userId?.slice(0, 8) + "…");
  const supabase = createClientIfConfigured();
  if (!supabase) {
    console.log("[capture/upload] Supabase client not configured");
    return null;
  }

  const uploadId = generateUploadId();
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${uploadId}.${ext}`;
  console.log("[capture/upload] uploadId:", uploadId, "path:", path);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("[capture/upload] Storage upload failed:", uploadError);
    return null;
  }
  console.log("[capture/upload] Storage upload OK");

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = urlData.publicUrl;
  console.log("[capture/upload] photo_url:", photoUrl?.slice(0, 60) + "…");

  const { error: insertError } = await supabase.from("photo_uploads").insert({
    upload_id: uploadId,
    user_id: userId,
    photo_url: photoUrl,
    status: "uploading",
    products_created: 0,
    products_updated: 0,
  });

  if (insertError) {
    console.error("[capture/upload] photo_uploads insert failed:", insertError.code, insertError.message);
    return null;
  }
  console.log("[capture/upload] photo_uploads row inserted, upload_id:", uploadId);

  // Trigger serverless processing (fire-and-forget; status will update via Realtime)
  fetch("/api/process-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ upload_id: uploadId, photo_url: photoUrl }),
  })
    .then((r) => {
      console.log("[capture/upload] process-photo response status:", r.status, "upload_id:", uploadId);
      if (!r.ok) return r.text().then((t) => console.error("[capture/upload] process-photo error body:", t));
    })
    .catch((e) => console.error("[capture/upload] process-photo trigger failed:", e));

  return { uploadId };
}
