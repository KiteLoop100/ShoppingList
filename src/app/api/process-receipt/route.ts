import { NextResponse } from "next/server";
import { z } from "zod";
import { claudeRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { log } from "@/lib/utils/logger";
import {
  callReceiptOcr,
  cleanupPhotos,
  processValidReceipt,
} from "@/lib/receipts/parse-receipt";

export const maxDuration = 300;

const processReceiptSchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(5),
  photo_paths: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.user.id;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = processReceiptSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { photo_urls, photo_paths } = parsed.data;

    const rateLimitResponse = await checkRateLimit(claudeRateLimit, userId);
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = requireSupabaseAdmin();
    if (supabase instanceof NextResponse) return supabase;

    const apiKeyCheck = requireApiKey();
    if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

    let ocrResult;
    try {
      ocrResult = await callReceiptOcr(photo_urls);
    } catch (err) {
      log.error("[process-receipt] OCR error:", err);
      return NextResponse.json(
        { error: "OCR processing failed" },
        { status: 502 }
      );
    }

    if (ocrResult.status === "not_a_receipt") {
      cleanupPhotos(supabase, photo_paths || []);
      return NextResponse.json(
        { error: "not_a_receipt", store_name: null },
        { status: 422 }
      );
    }

    if (ocrResult.status === "unsupported_retailer") {
      cleanupPhotos(supabase, photo_paths || []);
      return NextResponse.json(
        { error: "unsupported_retailer", store_name: ocrResult.store_name || null },
        { status: 422 }
      );
    }

    const result = await processValidReceipt(
      supabase,
      userId,
      ocrResult,
      photo_urls,
      photo_paths || [],
    );

    return NextResponse.json(result);
  } catch (err) {
    log.error("[process-receipt] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
