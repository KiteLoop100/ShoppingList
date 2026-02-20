"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface OverwriteThumbnailDialogProps {
  uploadId: string | null;
  onClose: () => void;
}

export function OverwriteThumbnailDialog({ uploadId, onClose }: OverwriteThumbnailDialogProps) {
  const t = useTranslations("capture");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(false);

  const handleApply = async (apply: boolean) => {
    if (!uploadId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/apply-thumbnail-overwrites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId, apply }),
      });
      if (!res.ok) console.error("apply-thumbnail-overwrites failed");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  if (!uploadId) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overwrite-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
        <h2 id="overwrite-title" className="text-lg font-semibold text-aldi-text">
          {t("overwriteImage")}
        </h2>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => handleApply(true)}
            disabled={loading}
            className="flex-1 rounded-lg bg-aldi-blue px-3 py-2 text-white disabled:opacity-50"
          >
            {t("yes")}
          </button>
          <button
            type="button"
            onClick={() => handleApply(false)}
            disabled={loading}
            className="flex-1 rounded-lg border border-aldi-muted bg-white px-3 py-2 text-aldi-text disabled:opacity-50"
          >
            {t("no")}
          </button>
        </div>
      </div>
    </div>
  );
}
