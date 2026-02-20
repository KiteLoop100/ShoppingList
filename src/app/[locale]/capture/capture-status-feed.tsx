"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";

export interface PhotoUploadRow {
  upload_id: string;
  user_id: string;
  photo_url: string;
  photo_type: string | null;
  status: "uploading" | "processing" | "completed" | "error";
  products_created: number;
  products_updated: number;
  error_message: string | null;
  pending_thumbnail_overwrites: Array<{ product_id: string; thumbnail_url: string }> | null;
  created_at: string;
  processed_at: string | null;
}

interface CaptureStatusFeedProps {
  userId: string;
  onPendingOverwrite?: (uploadId: string) => void;
}

export function CaptureStatusFeed({ userId, onPendingOverwrite }: CaptureStatusFeedProps) {
  const t = useTranslations("capture");
  const [uploads, setUploads] = useState<PhotoUploadRow[]>([]);

  useEffect(() => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const fetchInitial = async () => {
      const { data } = await supabase
        .from("photo_uploads")
        .select("upload_id, user_id, photo_url, photo_type, status, products_created, products_updated, error_message, pending_thumbnail_overwrites, created_at, processed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
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
              return [row, ...rest].slice(0, 20);
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

  if (uploads.length === 0) {
    return (
      <section className="rounded-xl border border-aldi-muted-light bg-aldi-muted-light/30 p-4">
        <h2 className="mb-2 text-sm font-semibold text-aldi-text">{t("recentUploads")}</h2>
        <p className="text-sm text-aldi-muted">{t("noUploadsYet")}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-aldi-muted-light bg-aldi-muted-light/30 p-4">
      <h2 className="mb-3 text-sm font-semibold text-aldi-text">{t("recentUploads")}</h2>
      <ul className="flex flex-col gap-2" role="list">
        {uploads.map((u) => (
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
              {u.status === "error" && (u.error_message || t("error"))}
            </span>
            <time className="text-aldi-muted" dateTime={u.created_at}>
              {new Date(u.created_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
