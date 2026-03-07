"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { FeedbackTextarea } from "./feedback-shared";
import { useAuth } from "@/lib/auth/auth-context";
import { getDefaultStoreId } from "@/lib/settings/default-store";
import { log } from "@/lib/utils/logger";

const EMOJI_FACES = ["😞", "😐", "🙂", "😊", "🤩"] as const;
const PROMPT_SHOWN_KEY = "feedback:lastTripPrompt";

interface PostShoppingPromptProps {
  tripId: string | null;
  checkedCount: number;
  onDismiss: () => void;
}

export function PostShoppingPrompt({ tripId, checkedCount, onDismiss }: PostShoppingPromptProps) {
  const t = useTranslations("feedback");
  const { user } = useAuth();

  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (checkedCount < 3 || !tripId) return;

    const lastPrompt = sessionStorage.getItem(PROMPT_SHOWN_KEY);
    if (lastPrompt === tripId) return;

    sessionStorage.setItem(PROMPT_SHOWN_KEY, tripId);
    const timer = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(timer);
  }, [tripId, checkedCount]);

  const hasContent = selectedRating !== null || message.trim().length > 0;

  const handleEmojiSelect = useCallback((rating: number) => {
    setSelectedRating((prev) => (prev === rating ? null : rating));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user || !tripId || !hasContent || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "post_shopping",
          trip_id: tripId,
          store_id: getDefaultStoreId(),
          rating: selectedRating,
          message: message.trim(),
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        dismissedRef.current = true;
        onDismiss();
      }, 1500);
    } catch (e) {
      log.warn("[PostShoppingPrompt] submit failed:", e);
    } finally {
      setSubmitting(false);
    }
  }, [user, tripId, hasContent, submitting, selectedRating, message, onDismiss]);

  const handleClose = useCallback(() => {
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  if (!visible || dismissedRef.current) return null;

  if (submitted) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 p-4">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 text-center shadow-xl">
          <span className="text-3xl">✓</span>
          <p className="mt-2 font-medium text-aldi-text">{t("thankYou")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={submitting ? undefined : handleClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 p-4">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-aldi-text">{t("postShoppingTitle")}</p>
              <p className="mt-1 text-sm text-aldi-muted">{t("postShoppingSubtitle")}</p>
            </div>

            <div className="flex justify-center gap-3">
              {EMOJI_FACES.map((emoji, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleEmojiSelect(i + 1)}
                  disabled={submitting}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-all hover:scale-110 disabled:opacity-50 ${
                    selectedRating === i + 1
                      ? "bg-aldi-blue/10 ring-2 ring-aldi-blue"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                  aria-label={t("starLabel", { count: i + 1 })}
                  aria-pressed={selectedRating === i + 1}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <FeedbackTextarea
              value={message}
              onChange={setMessage}
              placeholder={t("postShoppingPlaceholder")}
              disabled={submitting}
              minLength={0}
            />

            <div className="flex gap-3">
              {hasContent && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className={`min-h-touch rounded-xl border-2 border-aldi-muted-light px-4 py-3 text-sm font-medium text-aldi-muted transition-colors hover:bg-gray-50 disabled:opacity-50 ${
                  hasContent ? "" : "flex-1"
                }`}
              >
                {t("closeWindow")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
