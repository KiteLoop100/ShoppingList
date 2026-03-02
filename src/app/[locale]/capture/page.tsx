"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { useProducts } from "@/lib/products-context";
import { CreateProductModal } from "@/app/[locale]/capture/create-product-modal";
import { ReceiptScanner } from "@/app/[locale]/capture/receipt-scanner";

export default function CapturePage() {
  const t = useTranslations("capture");
  const tCommon = useTranslations("common");
  const { refetch: refetchProducts } = useProducts();
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [receiptScannerOpen, setReceiptScannerOpen] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <Link
          href="/"
          className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">{t("title")}</h1>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Produkt anlegen */}
        <button
          type="button"
          onClick={() => setCreateProductOpen(true)}
          className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </span>
          <span className="flex flex-col items-start">
            <span className="text-[15px] font-medium text-aldi-text">{t("createProduct.button")}</span>
          </span>
          <svg className="ml-auto h-4 w-4 text-aldi-muted opacity-40 transition-opacity group-hover:opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Kassenzettel scannen */}
        <button
          type="button"
          onClick={() => setReceiptScannerOpen(true)}
          className="group flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </span>
          <span className="flex flex-col items-start gap-0.5">
            <span className="text-[15px] font-medium text-aldi-text">{t("scanReceipt")}</span>
            <span className="text-xs text-aldi-muted">{t("scanReceiptDesc")}</span>
          </span>
          <svg className="ml-auto h-4 w-4 text-aldi-muted opacity-40 transition-opacity group-hover:opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <CreateProductModal
        open={createProductOpen}
        onClose={() => setCreateProductOpen(false)}
        onSaved={() => {
          refetchProducts();
        }}
      />

      <ReceiptScanner
        open={receiptScannerOpen}
        onClose={() => setReceiptScannerOpen(false)}
      />
    </main>
  );
}
