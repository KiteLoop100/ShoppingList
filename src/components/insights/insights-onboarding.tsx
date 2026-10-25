import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { formatReceiptDate } from "@/lib/insights/receipt-window";

interface InsightsOnboardingProps {
  /** Newest receipt purchase_date (YYYY-MM-DD); omit when the user has no dated receipts. */
  latestReceiptDate: string | null;
}

/** Shown when fewer than 3 receipts fall into the 90-day Insights window. */
export function InsightsOnboarding({ latestReceiptDate }: InsightsOnboardingProps) {
  const t = useTranslations("insights");
  const locale = useLocale();
  const formatted = latestReceiptDate ? formatReceiptDate(latestReceiptDate, locale) : null;

  return (
    <div className="px-4 py-12 text-center">
      <p className="mt-4 text-aldi-muted">{t("onboardingTitle")}</p>
      {formatted && (
        <p className="mt-2 text-sm text-aldi-muted">{t("onboardingLastReceipt", { date: formatted })}</p>
      )}
      <Link
        href="/capture"
        className="mt-6 inline-block rounded-lg bg-aldi-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-aldi-blue/90"
      >
        {t("onboardingScanButton")}
      </Link>
    </div>
  );
}
