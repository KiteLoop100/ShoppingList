"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { generateId } from "@/lib/utils/generate-id";

export function useGalleryUpload() {
  const t = useTranslations("admin");
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (files: FileList) => {
    setUploading(true);
    setLog([]);
    const addLog = (msg: string) => setLog((prev) => [...prev, msg]);
    const supabase = createClientIfConfigured();
    if (!supabase) {
      addLog(t("supabaseNotConfigured"));
      setUploading(false);
      return;
    }
    const userId = getCurrentUserId();
    const bucket = "product-photos";
    let uploaded = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) {
        addLog(t("fileSkipped", { file: file.name }));
        continue;
      }

      const uploadId = generateId();
      const ext = isPdf ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/${uploadId}.${ext}`;

      addLog(t("fileUploading", { current: i + 1, total: files.length, file: file.name }));

      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        addLog(t("fileUploadFailed", { file: file.name, message: upErr.message }));
        errors++;
        continue;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      await supabase.from("photo_uploads").insert({
        upload_id: uploadId,
        user_id: userId,
        photo_url: photoUrl,
        status: "uploading",
        products_created: 0,
        products_updated: 0,
        ...(isPdf ? { photo_type: "flyer_pdf" } : {}),
      });

      fetch("/api/process-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: uploadId,
          photo_url: photoUrl,
          ...(isPdf ? { is_pdf: true } : {}),
        }),
      }).catch(() => {});

      uploaded++;
      addLog(t("fileProcessingStarted", { file: file.name }));
    }

    addLog(`\n━━━ ${t("uploadSummary", { uploaded, errors })} ━━━`);
    setUploading(false);
  }, [t]);

  return { uploading, log, inputRef, upload };
}
