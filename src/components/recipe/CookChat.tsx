"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { loadSettings } from "@/lib/settings/settings-sync";
import { MAX_COOK_TURNS } from "@/lib/recipe/constants";
import { toCookChatApiHistory } from "@/lib/recipe/cook-chat-helpers";
import type { AICookResponse, CookChatMessage, GeneratedRecipeDetail } from "@/lib/recipe/types";
import { ChatInput } from "@/components/recipe/ChatInput";
import { ChatMessage } from "@/components/recipe/ChatMessage";
import { CookRecipeDetail } from "@/components/recipe/CookRecipeDetail";

function buildWelcomeMessage(t: (key: string) => string): CookChatMessage {
  return {
    role: "assistant",
    content: t("welcomeMessage"),
    timestamp: new Date().toISOString(),
  };
}

export type CookChatHandle = {
  resetConversation: () => void;
};

type CookChatApiOk = {
  conversation_id: string;
  response: AICookResponse;
};

export const CookChat = forwardRef<CookChatHandle>(function CookChat(_props, ref) {
  const t = useTranslations("cookChat");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [nerdMode, setNerdMode] = useState(false);

  const [messages, setMessages] = useState<CookChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<GeneratedRecipeDetail | null>(null);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  /** Synchronous guard — `isLoading` updates only after paint, so double-submit can race without this. */
  const submitInFlightRef = useRef(false);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setTurnCount(0);
    setIsLoading(false);
    setRateLimited(false);
    setDetailRecipe(null);
    setMessages([buildWelcomeMessage(t)]);
  }, [t]);

  useImperativeHandle(ref, () => ({
    resetConversation: handleNewConversation,
  }));

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setNerdMode(s.enable_inventory);
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useLayoutEffect(() => {
    if (!settingsLoaded || !nerdMode) return;
    if (messages.length === 0) {
      setMessages([buildWelcomeMessage(t)]);
    }
  }, [settingsLoaded, nerdMode, messages.length, t]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, detailRecipe]);

  const runAssistantResponse = useCallback(
    (response: AICookResponse): CookChatMessage => ({
      role: "assistant",
      content: response.message,
      timestamp: new Date().toISOString(),
      structuredResponse: response,
    }),
    [],
  );

  const submitMessage = useCallback(
    async (trimmed: string, messagesBeforeUser: CookChatMessage[]) => {
      if (!trimmed || rateLimited) return;
      if (turnCount >= MAX_COOK_TURNS) return;

      if (submitInFlightRef.current) {
        console.log("COOK-CHAT: Blocked double submit");
        return;
      }
      submitInFlightRef.current = true;
      setIsLoading(true);

      const userMsg: CookChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages([...messagesBeforeUser, userMsg]);

      const priorHistory = toCookChatApiHistory(messagesBeforeUser);

      try {
        const res = await fetch("/api/recipe/cook-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            ...(conversationId ? { conversation_id: conversationId } : {}),
            conversation_history: priorHistory,
          }),
        });

        if (res.status === 429) {
          await res.json().catch(() => ({}));
          setRateLimited(true);
          setTurnCount((c) => c + 1);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: t("rateLimitMessage"),
              timestamp: new Date().toISOString(),
              messageKind: "rate_limit",
            },
          ]);
          return;
        }

        if (!res.ok) {
          await res.json().catch(() => ({}));
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: t("networkError"),
              timestamp: new Date().toISOString(),
              messageKind: "error",
            },
          ]);
          return;
        }

        const data = (await res.json()) as CookChatApiOk;
        setConversationId(data.conversation_id);
        setTurnCount((c) => c + 1);
        setMessages((prev) => [...prev, runAssistantResponse(data.response)]);
      } catch (e) {
        console.error("[CookChat] fetch:", e);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: t("networkError"),
            timestamp: new Date().toISOString(),
            messageKind: "error",
          },
        ]);
      } finally {
        submitInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [conversationId, rateLimited, runAssistantResponse, t, turnCount],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (isLoading || submitInFlightRef.current) {
        console.log("COOK-CHAT: Blocked double submit");
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;
      await submitMessage(trimmed, messagesRef.current);
    },
    [isLoading, submitMessage],
  );

  const handleRetry = useCallback(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const secondLast = prev[prev.length - 2];
      if (last?.messageKind !== "error" || secondLast?.role !== "user") return prev;
      const text = secondLast.content;
      const back = prev.slice(0, -2);
      queueMicrotask(() => {
        void submitMessage(text, back);
      });
      return back;
    });
  }, [submitMessage]);

  const handleSelectRecipeSuggestion = useCallback(
    (_index: number, title: string) => {
      if (!title.trim()) return;
      void handleSend(t("showRecipePrompt", { title }));
    },
    [handleSend, t],
  );

  const handleOpenRecipeDetail = useCallback((recipe: GeneratedRecipeDetail) => {
    setDetailRecipe(recipe);
  }, []);

  if (!settingsLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-aldi-muted" aria-live="polite">
        {tCommon("loading")}
      </div>
    );
  }

  if (!nerdMode) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light text-4xl" aria-hidden>
          🔒
        </div>
        <div className="max-w-sm space-y-3">
          <h2 className="text-lg font-semibold text-aldi-text">{t("nerdModeRequired")}</h2>
          <p className="text-sm leading-relaxed text-aldi-muted">{t("nerdModeExplanation")}</p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href="/settings"
            className="touch-target flex min-h-[44px] items-center justify-center rounded-xl bg-aldi-blue px-4 py-3 text-center text-sm font-semibold text-white"
          >
            {t("activateNerdMode")}
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="touch-target min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-aldi-text shadow-sm"
          >
            {tCommon("back")}
          </button>
        </div>
      </div>
    );
  }

  const lastIdx = messages.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {detailRecipe && (
        <CookRecipeDetail
          recipe={detailRecipe}
          onAddMissingToList={() => {}}
          onSave={() => {}}
          onClose={() => setDetailRecipe(null)}
        />
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <ChatMessage
            key={`${m.timestamp}-${i}`}
            message={m}
            onSelectRecipeSuggestion={m.structuredResponse?.type === "suggestions" ? handleSelectRecipeSuggestion : undefined}
            onOpenRecipeDetail={m.structuredResponse?.type === "recipe_detail" ? handleOpenRecipeDetail : undefined}
            onRetry={handleRetry}
            showRetry={m.messageKind === "error" && i === lastIdx}
          />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-3 text-sm text-aldi-muted shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent"
                  aria-hidden
                />
                {t("loading")}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollAnchorRef} className="h-px w-full shrink-0" aria-hidden />
      </div>
      <ChatInput
        onSend={handleSend}
        disabled={rateLimited}
        loading={isLoading}
        turnCount={turnCount}
        maxTurns={MAX_COOK_TURNS}
        onNewConversation={handleNewConversation}
      />
    </div>
  );
});
