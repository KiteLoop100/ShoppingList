"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_COOK_TURNS } from "@/lib/recipe/constants";

const MAX_TEXTAREA_LINES = 3;
const LINE_HEIGHT_PX = 22;

type ChatInputProps = {
  onSend: (message: string) => void;
  disabled: boolean;
  /** True while the dummy / future API round-trip is in progress. */
  loading: boolean;
  turnCount: number;
  maxTurns?: number;
  onNewConversation: () => void;
};

type ChipDef = {
  key: string;
  labelKey: "chipNudeln" | "chipSalat" | "chipSuppe" | "chipSchnell" | "chipVegetarisch";
  fillKey: "chipFillNudeln" | "chipFillSalat" | "chipFillSuppe" | "chipFillSchnell" | "chipFillVegetarisch";
};

const CHIPS: ChipDef[] = [
  { key: "nudeln", labelKey: "chipNudeln", fillKey: "chipFillNudeln" },
  { key: "salat", labelKey: "chipSalat", fillKey: "chipFillSalat" },
  { key: "suppe", labelKey: "chipSuppe", fillKey: "chipFillSuppe" },
  { key: "schnell", labelKey: "chipSchnell", fillKey: "chipFillSchnell" },
  { key: "veg", labelKey: "chipVegetarisch", fillKey: "chipFillVegetarisch" },
];

export function ChatInput({
  onSend,
  disabled,
  loading,
  turnCount,
  maxTurns = MAX_COOK_TURNS,
  onNewConversation,
}: ChatInputProps) {
  const t = useTranslations("cookChat");
  const [value, setValue] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showChips = turnCount === 0;
  const atLimit = turnCount >= maxTurns;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = LINE_HEIGHT_PX * MAX_TEXTAREA_LINES;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(Math.min(hidden, 320));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled || loading || atLimit) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, loading, atLimit, onSend]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputLocked = disabled || loading || atLimit;

  return (
    <div
      className="shrink-0 border-t border-gray-200 bg-aldi-bg px-3 pt-2"
      style={{
        paddingBottom: `max(0.75rem, env(safe-area-inset-bottom), ${keyboardInset}px)`,
      }}
    >
      {atLimit && (
        <div className="mb-3 rounded-xl bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-sm text-aldi-text">{t("turnLimitReached", { max: maxTurns })}</p>
          <button
            type="button"
            onClick={onNewConversation}
            className="mt-2 min-h-[44px] w-full rounded-xl bg-aldi-blue px-4 py-2 text-sm font-semibold text-white"
          >
            {t("newConversation")}
          </button>
        </div>
      )}

      {showChips && !atLimit && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setValue(t(c.fillKey));
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              className="min-h-[36px] shrink-0 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm text-aldi-text shadow-sm transition-colors hover:bg-aldi-blue-light"
            >
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      )}

      {!atLimit && (
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("inputPlaceholder")}
            rows={1}
            disabled={inputLocked}
            className="min-h-[44px] max-h-[66px] min-w-0 flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none focus:ring-2 focus:ring-aldi-blue/20 disabled:bg-gray-100"
            aria-label={t("inputPlaceholder")}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim() || inputLocked}
            className="touch-target flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-aldi-blue text-white transition-opacity disabled:opacity-40"
            aria-label={loading ? t("loading") : t("send")}
          >
            {loading ? (
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
