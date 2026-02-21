"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { ReviewCard, type PhotoUploadReviewRow } from "@/app/[locale]/capture/review-card";

export interface PhotoUploadRow {
  upload_id: string;
  user_id: string;
  photo_url: string;
  photo_type: string | null;
  status: "uploading" | "processing" | "completed" | "error" | "pending_review" | "confirmed" | "discarded";
  products_created: number;
  products_updated: number;
  error_message: string | null;
  pending_thumbnail_overwrites: Array<{ product_id: string; thumbnail_url: string }> | null;
  extracted_data: PhotoUploadReviewRow["extracted_data"];
  created_at: string;
  processed_at: string | null;
}

/** extracted_data shape for flyer PDF with remaining pages */
interface FlyerExtractedData {
  flyer_id?: string;
  total_pages?: number;
  pages_processed?: number;
}

export interface CaptureStatusFeedRef {
  refetch: () => Promise<void>;
}

interface CaptureStatusFeedProps {
  userId: string;
  onPendingOverwrite?: (uploadId: string) => void;
}

export const CaptureStatusFeed = forwardRef<CaptureStatusFeedRef, CaptureStatusFeedProps>(function CaptureStatusFeed(
  { userId, onPendingOverwrite },
  ref
) {
  const t = useTranslations("capture");
  const tReview = useTranslations("capture.review");
  const [uploads, setUploads] = useState<PhotoUploadRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const fetchUploads = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const { data } = await supabase
      .from("photo_uploads")
      .select("upload_id, user_id, photo_url, photo_type, status, products_created, products_updated, error_message, pending_thumbnail_overwrites, extracted_data, created_at, processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) setUploads(data as PhotoUploadRow[]);
  }, [userId]);

  useImperativeHandle(ref, () => ({ refetch: fetchUploads }), [fetchUploads]);

  useEffect(() => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const fetchInitial = async () => {
      // Timeout cleanup: set uploads stuck in 'processing' > 15 min to 'error' (flyer can have many pages)
      const timeoutAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      await supabase
        .from("photo_uploads")
        .update({
          status: "error",
          error_message: "Timeout: Verarbeitung dauerte zu lange.",
          processed_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("status", "processing")
        .lt("created_at", timeoutAgo);

      const { data } = await supabase
        .from("photo_uploads")
        .select("upload_id, user_id, photo_url, photo_type, status, products_created, products_updated, error_message, pending_thumbnail_overwrites, extracted_data, created_at, processed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (data) setUploads(data as PhotoUploadRow[]);
    };

    fetchInitial();

    const channel = supabase
      .channel("photo_uploads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "photo_uploads",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const row = payload.new as PhotoUploadRow;
            setUploads((prev) => {
              const rest = prev.filter((u) => u.upload_id !== row.upload_id);
              return [row, ...rest].slice(0, 40);
            });
            if (
              row.status === "completed" &&
              row.pending_thumbnail_overwrites?.length &&
              onPendingOverwrite
            ) {
              onPendingOverwrite(row.upload_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onPendingOverwrite]);

  // Polling: solange etwas "uploading"/"processing" ist, alle 3 s refetchen
  const hadInProgressRef = useRef(false);
  const hasInProgress = uploads.some(
    (u) => u.status === "uploading" || u.status === "processing"
  );
  useEffect(() => {
    if (!hasInProgress) return;
    hadInProgressRef.current = true;
    const interval = setInterval(fetchUploads, 3000);
    return () => clearInterval(interval);
  }, [uploads, hasInProgress, fetchUploads]);

  // Sobald nichts mehr "in Progress" ist: einmal refetchen, damit pending_review sofort erscheint (Realtime kann ausbleiben)
  useEffect(() => {
    if (hasInProgress) return;
    if (!hadInProgressRef.current) return;
    hadInProgressRef.current = false;
    fetchUploads();
  }, [hasInProgress, fetchUploads]);

  const processingFlyerRef = useRef<string | null>(null);

  useEffect(() => {
    const u = uploads.find(
      (x) =>
        x.status === "processing" &&
        x.photo_type === "flyer_pdf" &&
        (x.extracted_data as FlyerExtractedData)?.flyer_id &&
        (x.extracted_data as FlyerExtractedData)?.total_pages != null &&
        ((x.extracted_data as FlyerExtractedData)?.pages_processed ?? 0) < (x.extracted_data as FlyerExtractedData).total_pages!
    );
    if (!u || processingFlyerRef.current === u.upload_id) return;
    const ext = u.extracted_data as FlyerExtractedData;
    const nextPage = (ext.pages_processed ?? 0) + 1;
    processingFlyerRef.current = u.upload_id;
    fetch("/api/process-flyer-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_id: u.upload_id,
        flyer_id: ext.flyer_id,
        page_number: nextPage,
      }),
    })
      .then((res) => {
        if (!res.ok) return res.text().then((t) => Promise.reject(new Error(t)));
        return res.json();
      })
      .then((data) => {
        processingFlyerRef.current = null;
        setUploads((prev) =>
          prev.map((x) =>
            x.upload_id === u.upload_id && x.extracted_data && typeof x.extracted_data === "object"
              ? {
                  ...x,
                  extracted_data: {
                    ...(x.extracted_data as Record<string, unknown>),
                    pages_processed: data.pages_processed,
                  },
                  ...(data.completed ? { status: "completed" as const } : {}),
                }
              : x
          )
        );
      })
      .catch(() => {
        processingFlyerRef.current = null;
      });
  }, [uploads]);

  const inProgress = uploads.filter((u) => u.status === "uploading" || u.status === "processing");
  const pendingReview = uploads.filter((u) => u.status === "pending_review");
  const history = uploads.filter((u) =>
    ["confirmed", "discarded", "completed", "error"].includes(u.status)
  );

  const handleReviewConfirmed = (uploadId: string) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.upload_id === uploadId ? { ...u, status: "confirmed" as const } : u
      )
    );
  };

  const handleReviewDiscarded = (uploadId: string) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.upload_id === uploadId ? { ...u, status: "discarded" as const } : u
      )
    );
  };

  return (
    <>
      {inProgress.length > 0 && (
        <section className="flex flex-col gap-2">
          {inProgress.map((u) => {
            const ext = u.extracted_data as FlyerExtractedData | undefined;
            const isFlyerProgress =
              u.photo_type === "flyer_pdf" &&
              ext?.total_pages != null &&
              ext?.pages_processed != null;
            return (
              <div
                key={u.upload_id}
                className="flex items-center gap-3 rounded-xl border border-aldi-blue/20 bg-aldi-blue/5 p-3"
              >
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
                <span className="text-sm font-medium text-aldi-blue">
                  {u.status === "uploading"
                    ? t("uploading")
                    : isFlyerProgress
                      ? t("flyerPageProgress", {
                          current: ext.pages_processed,
                          total: ext.total_pages,
                        })
                      : t("processing")}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {pendingReview.length > 0 && (
        <section className="flex flex-col gap-4">
          {pendingReview.map((u) => (
            <ReviewCard
              key={u.upload_id}
              upload={u as PhotoUploadReviewRow}
              userId={userId}
              onConfirmed={() => handleReviewConfirmed(u.upload_id)}
              onDiscarded={() => handleReviewDiscarded(u.upload_id)}
            />
          ))}
        </section>
      )}

      <section className="rounded-xl border border-aldi-muted-light bg-aldi-muted-light/30 p-4">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={historyOpen}
        >
          <h2 className="text-sm font-semibold text-aldi-text">{tReview("historyTitle")}</h2>
          <svg
            className={`h-5 w-5 text-aldi-muted transition-transform ${historyOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {historyOpen && (
          <ul className="mt-3 flex flex-col gap-2" role="list">
            {history.length === 0 ? (
              <li className="text-sm text-aldi-muted">{t("noUploadsYet")}</li>
            ) : (
              history.map((u) => (
                <li
                  key={u.upload_id}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <span className="text-aldi-text">
                    {u.status === "uploading" && t("uploading")}
                    {u.status === "processing" && t("processing")}
                    {u.status === "completed" &&
                      (u.products_created + u.products_updated > 0
                        ? t("productsRecognized", { count: u.products_created + u.products_updated })
                        : "Fertig")}
                    {u.status === "confirmed" && tReview("confirmed")}
                    {u.status === "discarded" && tReview("discarded")}
                    {u.status === "error" && (u.error_message || t("error"))}
                  </span>
                  <time className="text-aldi-muted" dateTime={u.created_at}>
                    {new Date(u.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </>
  );
});
