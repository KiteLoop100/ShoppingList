"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatListAsText } from "@/lib/list/format-list-text";
import { log } from "@/lib/utils/logger";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

export interface ShareListButtonProps {
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
  locale: string;
}

export function ShareListButton({ unchecked, checked, deferred, locale }: ShareListButtonProps) {
  const t = useTranslations("list");
  const shareInFlightRef = useRef(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleShare = useCallback(async () => {
    if (shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    setSharing(true);
    try {
      const text = formatListAsText(unchecked, checked, deferred, {
        grouped: true,
        locale: locale === "en" ? "en" : "de",
      });
      const title = t("shareTitle");

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title, text });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            return;
          }
          log.warn("[share-list] navigator.share failed:", e);
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          setToast({ kind: "ok", message: t("shareCopied") });
          return;
        } catch (e) {
          log.warn("[share-list] clipboard.writeText failed:", e);
        }
      }

      window.prompt(t("sharePromptFallback"), text);
    } catch (e) {
      log.warn("[share-list] unexpected share error:", e);
      setToast({ kind: "err", message: t("shareError") });
    } finally {
      shareInFlightRef.current = false;
      setSharing(false);
    }
  }, [checked, deferred, locale, t, unchecked]);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={sharing}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
          sharing
            ? "border-aldi-muted-light opacity-50"
            : "border-aldi-muted-light bg-white text-aldi-muted hover:border-aldi-blue/50 hover:text-aldi-blue"
        }`}
        aria-label={t("shareList")}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      </button>
      {toast && (
        <div
          className={`max-w-[min(100%,280px)] rounded-lg px-3 py-2 text-center text-xs font-medium shadow-md ${
            toast.kind === "ok"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
