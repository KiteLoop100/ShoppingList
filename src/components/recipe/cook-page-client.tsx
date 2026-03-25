"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { CookChat, type CookChatHandle } from "@/components/recipe/CookChat";

export function CookPageClient() {
  const t = useTranslations("cookChat");
  const tCommon = useTranslations("common");
  const chatRef = useRef<CookChatHandle>(null);

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-2xl">
      <header className="flex shrink-0 items-center gap-2 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-5">
        <Link
          href="/recipes"
          className="touch-target -ml-2 flex shrink-0 items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">{t("pageTitle")}</h1>
        <button
          type="button"
          onClick={() => chatRef.current?.resetConversation()}
          className="touch-target shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-aldi-blue hover:bg-aldi-blue-light"
        >
          {t("newConversation")}
        </button>
      </header>
      <CookChat ref={chatRef} />
    </main>
  );
}
