/**
 * F13/F14: Process uploaded photo with Claude Vision.
 * Thin router — delegates to focused modules in lib/api/photo-processing/.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { claudeRateLimit } from "@/lib/api/rate-limit";
import { requireAiUser, enforceAiLimits } from "@/lib/api/ai-guard";
import { validateStoragePhotoUrl } from "@/lib/api/photo-processing/validate-photo-url";
import { requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { fetchAndPreprocessImage } from "@/lib/api/photo-processing/image-utils";
import { processDataExtraction } from "@/lib/api/photo-processing/process-data-extraction";
import { processFlyer } from "@/lib/api/photo-processing/process-flyer";
import { processVisionPhoto } from "@/lib/api/photo-processing/process-product-photo";
import { log } from "@/lib/utils/logger";


/** PDF flyers are split and extracted page by page inside this request. */
export const maxDuration = 300;

const processPhotoSchema = z.object({
  upload_id: z.string().min(1).max(100),
  photo_url: z.string().url(),
  is_pdf: z.boolean().optional(),
  data_extraction: z.boolean().optional(),
});

export async function POST(request: Request) {
  log.debug("[process-photo] POST received");

  const apiKey = requireApiKey();
  if (apiKey instanceof NextResponse) return apiKey;

  const access = await requireAiUser(request);
  if (access instanceof NextResponse) return access;
  const { user } = access;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    log.debug("[process-photo] Invalid request JSON");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = processPhotoSchema.safeParse(rawBody);
  if (!parsed.success) {
    log.debug("[process-photo] Validation failed:", parsed.error.flatten());
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { upload_id, photo_url, is_pdf, data_extraction } = parsed.data;
  log.debug(
    "[process-photo] upload_id:",
    upload_id,
    "is_pdf:",
    is_pdf,
    "data_extraction:",
    data_extraction,
  );

  // SSRF guard: only fetch public objects from our own Supabase Storage.
  try {
    validateStoragePhotoUrl(photo_url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid photo_url";
    log.warn("[process-photo] Rejected photo_url:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const limited = await enforceAiLimits(request, user.id, claudeRateLimit);
  if (limited) return limited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  // The service-role client below bypasses RLS, so ownership is checked here.
  // Missing and foreign uploads both return 404 so upload ids cannot be probed.
  const { data: upload, error: uploadErr } = await supabase
    .from("photo_uploads")
    .select("upload_id, user_id")
    .eq("upload_id", upload_id)
    .maybeSingle();
  if (uploadErr) {
    log.error("[process-photo] Upload lookup failed:", uploadErr.message);
    return NextResponse.json({ error: "Failed to load upload" }, { status: 500 });
  }
  if (!upload || upload.user_id !== user.id) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("photo_uploads")
    .update({
      status: "error",
      error_message:
        "Timeout: Verarbeitung dauerte zu lange (> 5 Minuten).",
      processed_at: now,
    })
    .eq("status", "processing")
    .lt("created_at", fiveMinutesAgo);

  const { error: updateProcessing } = await supabase
    .from("photo_uploads")
    .update({ status: "processing" })
    .eq("upload_id", upload_id);

  if (updateProcessing) {
    log.error(
      "[process-photo] Failed to update status to processing:",
      updateProcessing.message,
    );
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }
  log.debug("[process-photo] Status set to processing for", upload_id);

  let preprocessed;
  try {
    preprocessed = await fetchAndPreprocessImage(photo_url, is_pdf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    log.error("[process-photo] Fetch failed:", msg);
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", upload_id);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
  log.debug(
    "[process-photo] Fetched, isPdf:",
    preprocessed.isPdf,
    "calling Claude",
  );

  if (data_extraction && !preprocessed.isPdf) {
    return processDataExtraction(
      supabase,
      upload_id,
      preprocessed.imageBase64,
      preprocessed.mediaType,
      preprocessed.imageBuffer,
      now,
    );
  }

  if (preprocessed.isPdf && preprocessed.pdfBuf) {
    return processFlyer(supabase, upload_id, photo_url, preprocessed.pdfBuf, now);
  }

  return processVisionPhoto(
    supabase,
    upload_id,
    photo_url,
    preprocessed.imageBase64,
    preprocessed.mediaType,
    preprocessed.imageBuffer,
    now,
  );
}
