"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { GeneralFeedbackForm } from "@/components/feedback/general-feedback-form";

export default function FeedbackPage() {
  const t = useTranslations("feedback");
  const tCommon = useTranslations("common");
  const router = useRouter();

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-aldi-bg p-4 md:max-w-2xl md:p-6 lg:p-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-aldi-bg px-4 py-3">
        <Link
          href="/settings"
          className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("back")}
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-aldi-blue">{t("generalTitle")}</h1>
      </header>

      <section className="pt-2">
        <GeneralFeedbackForm
          onSuccess={() => {
            setTimeout(() => router.push("/settings"), 2000);
          }}
        />
      </section>
    </main>
  );
}
