import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { claudeRateLimit, checkRateLimit } from "@/lib/api/rate-limit";
import { requireAuth, requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { log } from "@/lib/utils/logger";
import {
  callReceiptOcr,
  cleanupPhotos,
  processValidReceipt,
} from "@/lib/receipts/parse-receipt";
import { MAX_RECEIPT_PHOTOS } from "@/lib/receipts/constants";

// #region agent log
function dbgLog(hypothesisId: string, message: string, data?: unknown) {
  try {
    const logPath = path.join(process.cwd(), "debug-4c9d8e.log");
    const entry = JSON.stringify({ sessionId: "4c9d8e", timestamp: Date.now(), hypothesisId, message, data }) + "\n";
    fs.appendFileSync(logPath, entry);
  } catch { /* best effort */ }
}
// #endregion

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

  // #region agent log
  dbgLog("H-1B,H-2A", "process-receipt called", { userId, photoCount: photo_urls.length, ts: Date.now() });
  // #endregion

  const rateLimitResponse = await checkRateLimit(claudeRateLimit, userId);
  if (rateLimitResponse) return rateLimitResponse;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  type SSEEvent = { event: string; data: unknown };
  let resolveWork: (events: SSEEvent[]) => void;
  const workDone = new Promise<SSEEvent[]>((r) => { resolveWork = r; });

  // The work runs as a detached promise — not tied to the SSE stream lifecycle.
  // If the client disconnects, the work continues to completion.
  (async () => {
    const events: SSEEvent[] = [];
    const emit = (event: string, data: unknown) => { events.push({ event, data }); };

    // #region agent log
    const ocrStart = Date.now();
    dbgLog("H-1C", "calling callReceiptOcr", { photoCount: photo_urls.length });
    // #endregion

    let ocrResult;
    try {
      ocrResult = await callReceiptOcr(photo_urls);
      // #region agent log
      dbgLog("H-1C,H-2B", "callReceiptOcr returned", { durationMs: Date.now() - ocrStart, status: ocrResult.status, retailer: ocrResult.retailer });
      // #endregion
    } catch (err) {
      // #region agent log
      dbgLog("H-1C", "callReceiptOcr threw error", { durationMs: Date.now() - ocrStart, error: String(err) });
      // #endregion
      log.error("[process-receipt] OCR error:", err);
      emit("error", { error: "OCR processing failed", status: 502 });
      resolveWork!(events);
      return;
    }

    if (ocrResult.status === "not_a_receipt") {
      cleanupPhotos(supabase, photo_paths || []);
      emit("error", { error: "not_a_receipt", store_name: null, status: 422 });
      resolveWork!(events);
      return;
    }

    if (ocrResult.status === "unsupported_retailer") {
      cleanupPhotos(supabase, photo_paths || []);
      emit("error", { error: "unsupported_retailer", store_name: ocrResult.store_name || null, status: 422 });
      resolveWork!(events);
      return;
    }

    emit("progress", { step: "processing" });

    // #region agent log
    dbgLog("H-1A,H-2A", "status valid — calling processValidReceipt", { productCount: ocrResult.products?.length });
    // #endregion

    let result;
    try {
      result = await processValidReceipt(supabase, userId, ocrResult, photo_urls, photo_paths || []);
    } catch (err) {
      const e = err as { code?: string; receipt_id?: string };
      if (e?.code === "duplicate_receipt") {
        // #region agent log
        dbgLog("H-2A", "duplicate_receipt", { receiptId: e.receipt_id });
        // #endregion
        emit("error", { error: "duplicate_receipt", receipt_id: e.receipt_id, status: 409 });
        resolveWork!(events);
        return;
      }
      // #region agent log
      dbgLog("H-1A", "processValidReceipt threw", { error: String(err) });
      // #endregion
      log.error("[process-receipt] Unhandled error:", err);
      emit("error", { error: "Internal server error", status: 500 });
      resolveWork!(events);
      return;
    }

    // #region agent log
    dbgLog("H-1A", "processValidReceipt done", { receiptId: result.receipt_id, itemsCount: result.items_count });
    // #endregion

    emit("result", result);
    resolveWork!(events);
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
        sendSSE("progress", { step: "ocr_start" });
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
