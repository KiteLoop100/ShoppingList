"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface CartScanPricePromptProps {
  productName: string;
  onSubmit: (price: number | null) => void;
  onSkip: () => void;
}

export function CartScanPricePrompt({ productName, onSubmit, onSkip }: CartScanPricePromptProps) {
  const t = useTranslations("list");
  const [priceStr, setPriceStr] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(priceStr.replace(",", "."));
    onSubmit(isNaN(parsed) ? null : parsed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-aldi-text">{productName}</h3>
        <p className="mb-4 text-sm text-aldi-muted">{t("scanEnterPrice")}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
            placeholder={t("scanPricePlaceholder")}
            className="mb-4 w-full rounded-xl border border-aldi-muted-light px-4 py-3 text-lg tabular-nums focus:border-aldi-blue focus:outline-none focus:ring-2 focus:ring-aldi-blue/30"
            autoFocus
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onSubmit(null)}
              className="flex-1 rounded-xl border border-aldi-muted-light px-4 py-3 text-sm font-medium text-aldi-muted transition-colors hover:bg-gray-50"
            >
              {t("scanAddWithoutPrice")}
            </button>
            <button
              type="submit"
              disabled={!priceStr.trim()}
              className="flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {t("scanEnterPrice")}
            </button>
          </div>

          <button
            type="button"
            onClick={onSkip}
            className="mt-3 w-full py-2 text-center text-sm text-aldi-muted hover:text-aldi-text"
          >
            {t("scanSkip")}
          </button>
        </form>
      </div>
    </div>
  );
}
