"use client";

import { useTranslations } from "next-intl";
import type { CookChatMessage, GeneratedRecipeDetail } from "@/lib/recipe/types";
import { RecipeSuggestionCard } from "@/components/recipe/RecipeSuggestionCard";

type ChatMessageProps = {
  message: CookChatMessage;
  onSelectRecipeSuggestion?: (index: number, title: string) => void;
  onOpenRecipeDetail?: (recipe: GeneratedRecipeDetail) => void;
  onRetry?: () => void;
  showRetry?: boolean;
};

/**
 * Single chat bubble: user (right, accent) vs assistant (left, neutral).
 * Timestamps hidden per product spec.
 */
export function ChatMessage({
  message,
  onSelectRecipeSuggestion,
  onOpenRecipeDetail,
  onRetry,
  showRetry,
}: ChatMessageProps) {
  const t = useTranslations("cookChat");
  const isUser = message.role === "user";
  const sr = message.structuredResponse;

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isUser
            ? "bg-aldi-orange text-white shadow-sm"
            : "bg-white text-aldi-text shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {!isUser && sr?.type === "suggestions" && sr.suggestions && sr.suggestions.length > 0 && onSelectRecipeSuggestion && (
          <div className="mt-3 space-y-2" role="group" aria-label={t("suggestionsGroupLabel")}>
            {sr.suggestions.map((s, i) => (
              <RecipeSuggestionCard
                key={`${s.title}-${i}`}
                suggestion={s}
                index={i}
                onSelect={(idx) => onSelectRecipeSuggestion(idx, sr.suggestions![idx].title)}
              />
            ))}
          </div>
        )}

        {!isUser && sr?.type === "clarification" && sr.question && (
          <div className="mt-3 rounded-xl border border-aldi-blue/25 bg-aldi-blue-light/40 px-3 py-2.5">
            <p className="text-[15px] font-semibold text-aldi-text">{sr.question}</p>
          </div>
        )}

        {!isUser && sr?.type === "recipe_detail" && sr.recipe && onOpenRecipeDetail && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => sr.recipe && onOpenRecipeDetail(sr.recipe)}
              className="touch-target w-full rounded-xl bg-aldi-blue px-4 py-2.5 text-sm font-semibold text-white"
            >
              {t("showFullRecipe")}
            </button>
          </div>
        )}

        {!isUser && message.messageKind === "error" && showRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-gray-200 bg-aldi-bg px-3 py-2 text-sm font-semibold text-aldi-blue"
          >
            {t("retrySend")}
          </button>
        )}
      </div>
    </div>
  );
}
