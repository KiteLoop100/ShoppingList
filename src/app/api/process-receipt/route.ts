import { NextResponse } from "next/server";
import { z } from "zod";
import { claudeRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { log } from "@/lib/utils/logger";
import { loadDemandGroups, loadDemandSubGroups, buildDemandGroupsAndSubGroupsPrompt } from "@/lib/categories/constants";
import {
  callReceiptOcr,
  cleanupPhotos,
  processValidReceipt,
} from "@/lib/receipts/parse-receipt";
import { MAX_RECEIPT_PHOTOS } from "@/lib/receipts/constants";

export const maxDuration = 300;

const KEEPALIVE_INTERVAL_MS = 10_000;

const processReceiptSchema = z.object({
  photo_urls: z.array(z.string().url()).min(1).max(MAX_RECEIPT_PHOTOS),
  photo_paths: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
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

  const paths = photo_paths || [];
  const { data: scan, error: scanErr } = await supabase
    .from("receipt_scans")
    .insert({ user_id: userId, photo_urls, photo_paths: paths, status: "processing" })
    .select("scan_id")
    .single();

  if (scanErr || !scan) {
    log.error("[process-receipt] Failed to create receipt_scans row:", scanErr);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const scanId = scan.scan_id as string;

  const updateScan = async (update: Record<string, unknown>) => {
    const { error } = await supabase
      .from("receipt_scans")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("scan_id", scanId);
    if (error) log.error("[process-receipt] receipt_scans update failed:", error);
  };

  type SSEEvent = { event: string; data: unknown };
  let resolveWork: (events: SSEEvent[]) => void;
  const workDone = new Promise<SSEEvent[]>((r) => { resolveWork = r; });

  // The work runs as a detached promise — not tied to the SSE stream lifecycle.
  // If the client disconnects, the work continues to completion.
  (async () => {
    const events: SSEEvent[] = [];
    const emit = (event: string, data: unknown) => { events.push({ event, data }); };

    try {
      const [groups, subGroups] = await Promise.all([
        loadDemandGroups(supabase),
        loadDemandSubGroups(supabase),
      ]);
      const demandGroupsBlock = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);

      let ocrResult;
      try {
        ocrResult = await callReceiptOcr(photo_urls, demandGroupsBlock);
      } catch (err) {
        log.error("[process-receipt] OCR error:", err);
        emit("error", { error: "OCR processing failed", status: 502 });
        await updateScan({ status: "failed", error_code: "ocr_failed", error_message: String(err) });
        resolveWork!(events);
        return;
      }

      if (ocrResult.status === "not_a_receipt") {
        cleanupPhotos(supabase, paths);
        emit("error", { error: "not_a_receipt", store_name: null, status: 422 });
        await updateScan({ status: "failed", error_code: "not_a_receipt" });
        resolveWork!(events);
        return;
      }

      if (ocrResult.status === "unsupported_retailer") {
        cleanupPhotos(supabase, paths);
        emit("error", { error: "unsupported_retailer", store_name: ocrResult.store_name || null, status: 422 });
        await updateScan({ status: "failed", error_code: "unsupported_retailer" });
        resolveWork!(events);
        return;
      }

      emit("progress", { step: "processing" });

      let result;
      try {
        result = await processValidReceipt(supabase, userId, ocrResult, photo_urls, paths);
      } catch (err) {
        const e = err as { code?: string; receipt_id?: string };
        if (e?.code === "duplicate_receipt") {
          emit("error", { error: "duplicate_receipt", receipt_id: e.receipt_id, status: 409 });
          await updateScan({ status: "completed", error_code: "duplicate_receipt", receipt_id: e.receipt_id });
          resolveWork!(events);
          return;
        }
        log.error("[process-receipt] Unhandled error:", err);
        emit("error", { error: "Internal server error", status: 500 });
        await updateScan({ status: "failed", error_code: "internal_error", error_message: String(err) });
        resolveWork!(events);
        return;
      }

      emit("result", { ...result, scan_id: scanId });
      await updateScan({ status: "completed", receipt_id: result.receipt_id });
      resolveWork!(events);
    } catch (err) {
      log.error("[process-receipt] Unexpected outer error:", err);
      await updateScan({ status: "failed", error_code: "internal_error", error_message: String(err) });
      const events: SSEEvent[] = [{ event: "error", data: { error: "Internal server error", status: 500 } }];
      resolveWork!(events);
    }
  })();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendSSE = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected — ignore */ }
      };

      const keepalive = setInterval(() => {
        sendSSE("keepalive", { ts: Date.now() });
      }, KEEPALIVE_INTERVAL_MS);

      try {
        sendSSE("progress", { step: "ocr_start", scan_id: scanId });
        const events = await workDone;
        for (const e of events) {
          sendSSE(e.event, e.data);
        }
      } finally {
        clearInterval(keepalive);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
