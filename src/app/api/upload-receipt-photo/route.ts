import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/guards";
import { createSupabaseServerFromRequest } from "@/lib/supabase/server";
import { generalRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

const uploadReceiptPhotoSchema = z.object({
  base64: z.string().min(100).max(5_000_000),
  index: z.number().int().min(0).max(10),
  timestamp: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = uploadReceiptPhotoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { base64, index, timestamp } = parsed.data;

    const rateLimitResponse = await checkRateLimit(
      generalRateLimit,
      userId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = createSupabaseServerFromRequest(request);
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const path = `${userId}/${timestamp}_${index}.jpg`;
    const buffer = Buffer.from(base64, "base64");

    const { error: uploadErr } = await supabase.storage
      .from("receipt-photos")
      .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

    if (uploadErr) {
      log.error("[upload-receipt-photo] Storage upload error:", uploadErr);
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: signedData, error: signErr } = await supabase.storage
      .from("receipt-photos")
      .createSignedUrl(path, 600);

    if (signErr || !signedData?.signedUrl) {
      log.error("[upload-receipt-photo] Signed URL error:", signErr);
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedData.signedUrl, path });
  } catch (err) {
    log.error("[upload-receipt-photo] Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
