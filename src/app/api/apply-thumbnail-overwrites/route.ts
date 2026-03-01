/**
 * Apply or discard pending thumbnail overwrites for an upload (F13 duplicate handling).
 */

import { NextResponse } from "next/server";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { applyThumbnailOverwritesSchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  const validated = await validateBody(request, applyThumbnailOverwritesSchema);
  if (validated instanceof NextResponse) return validated;
  const { upload_id, apply } = validated;

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(generalRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { data: row } = await supabase
    .from("photo_uploads")
    .select("pending_thumbnail_overwrites")
    .eq("upload_id", upload_id)
    .single();

  const pending = (row?.pending_thumbnail_overwrites ?? null) as
    | Array<{ product_id: string; thumbnail_url: string }>
    | null;

  if (pending?.length && apply) {
    for (const { product_id, thumbnail_url } of pending) {
      await supabase
        .from("products")
        .update({ thumbnail_url, photo_source_id: upload_id, updated_at: new Date().toISOString() })
        .eq("product_id", product_id);
    }
  }

  await supabase
    .from("photo_uploads")
    .update({ pending_thumbnail_overwrites: null })
    .eq("upload_id", upload_id);

  return NextResponse.json({ ok: true });
}
