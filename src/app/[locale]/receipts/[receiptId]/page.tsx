"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { ReceiptDetailContent } from "@/app/[locale]/receipts/receipt-detail-content";

export default function ReceiptDetailPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const params = useParams();
  const receiptId = params.receiptId as string;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
        <Link
          href="/receipts"
          className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">
          {t("detail")}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <ReceiptDetailContent receiptId={receiptId} />
      </div>
    </main>
  );
}
