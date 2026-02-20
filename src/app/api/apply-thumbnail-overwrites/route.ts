/**
 * Apply or discard pending thumbnail overwrites for an upload (F13 duplicate handling).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let body: { upload_id?: string; apply?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { upload_id, apply } = body;
  if (!upload_id) {
    return NextResponse.json({ error: "upload_id required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin not configured" }, { status: 500 });
  }

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
