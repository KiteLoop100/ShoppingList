"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CategoryChips, FeedbackTextarea } from "./feedback-shared";
import { POST_SHOPPING_CATEGORIES } from "@/lib/feedback/feedback-types";
import { useAuth } from "@/lib/auth/auth-context";
import { getDefaultStoreId } from "@/lib/settings/default-store";

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
  const [showFullForm, setShowFullForm] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
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

  const submitRatingOnly = useCallback(async (rating: number) => {
    if (!user || !tripId) return;
    setSelectedRating(rating);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "post_shopping",
          trip_id: tripId,
          store_id: getDefaultStoreId(),
          category: "experience",
          rating,
          message: `Rating: ${rating}/5`,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        dismissedRef.current = true;
        onDismiss();
      }, 1500);
    } catch {
      // silent fail for quick rating
    }
  }, [user, tripId, onDismiss]);

  const handleFullSubmit = useCallback(async () => {
    if (!category || message.length < 10 || !user) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback_type: "post_shopping",
          trip_id: tripId,
          store_id: getDefaultStoreId(),
          category,
          rating: selectedRating,
          message,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        dismissedRef.current = true;
        onDismiss();
      }, 1500);
    } catch {
      // silent fail
    } finally {
      setSubmitting(false);
    }
  }, [category, message, user, tripId, selectedRating, onDismiss]);

  const handleDismiss = useCallback(() => {
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
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleDismiss} />
      <div className="fixed inset-x-0 bottom-0 z-50 p-4">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          {!showFullForm ? (
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
                    onClick={() => submitRatingOnly(i + 1)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-all hover:scale-110 ${
                      selectedRating === i + 1
                        ? "bg-aldi-blue/10 ring-2 ring-aldi-blue"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    aria-label={t("starLabel", { count: i + 1 })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowFullForm(true)}
                  className="min-h-touch flex-1 rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 text-sm font-semibold text-aldi-blue transition-colors hover:bg-aldi-blue/5"
                >
                  {t("writeFeedback")}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="min-h-touch flex-1 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-sm font-medium text-aldi-muted transition-colors hover:bg-gray-50"
                >
                  {t("dismiss")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-lg font-semibold text-aldi-text">{t("postShoppingTitle")}</p>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-aldi-muted">
                  {t("categoryLabel")}
                </p>
                <CategoryChips
                  categories={POST_SHOPPING_CATEGORIES}
                  selected={category}
                  onChange={setCategory}
                  disabled={submitting}
                />
              </div>

              <FeedbackTextarea
                value={message}
                onChange={setMessage}
                placeholder={t("postShoppingPlaceholder")}
                disabled={submitting}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleFullSubmit}
                  disabled={!category || message.length < 10 || submitting}
                  className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="min-h-touch rounded-xl border-2 border-aldi-muted-light px-4 py-3 text-sm font-medium text-aldi-muted transition-colors hover:bg-gray-50"
                >
                  {t("dismiss")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
