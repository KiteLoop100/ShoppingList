"use client";

import Image from "next/image";
import type { TranslationValues } from "use-intl";
import type { CapturedPhoto, ReceiptResult } from "./use-receipt-processing";
import { getRetailerByName } from "@/lib/retailers/retailers";

interface ReceiptProcessingPhaseProps {
  t: (key: string, values?: TranslationValues) => string;
  progress: string;
  photos: CapturedPhoto[];
}

export function ReceiptProcessingPhase({ t, progress, photos }: ReceiptProcessingPhaseProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-white" />
      <p className="text-center text-sm text-white/80">{progress}</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {photos.map((photo, idx) => (
          <Image
            key={photo.id}
            src={photo.dataUrl}
            alt={`${t("photo")} ${idx + 1}`}
            width={56}
            height={80}
            className="h-20 w-14 rounded-lg object-cover opacity-60"
            unoptimized
          />
        ))}
      </div>
    </div>
  );
}

interface ReceiptSubmittedPhaseProps {
  t: (key: string) => string;
  onClose: () => void;
}

export function ReceiptSubmittedPhase({ t, onClose }: ReceiptSubmittedPhaseProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-aldi-blue">
        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{t("submittedTitle")}</p>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{t("submittedMessage")}</p>
      </div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-xl bg-white/10 px-8 py-3 text-sm font-medium text-white transition-transform active:scale-95"
      >
        {t("submittedClose")}
      </button>
    </div>
  );
}

interface ReceiptDonePhaseProps {
  t: (key: string, values?: TranslationValues) => string;
  result: ReceiptResult;
  onViewReceipt: () => void;
  onClose: () => void;
}

export function ReceiptDonePhase({ t, result, onViewReceipt, onClose }: ReceiptDonePhaseProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{t("success")}</p>
        <div className="mt-3 space-y-1">
          {result.retailer && (
            <p className="text-sm font-medium text-white/90">
              {(() => {
                const cfg = getRetailerByName(result.retailer);
                return cfg ? (
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}>
                    {cfg.name}
                  </span>
                ) : result.retailer;
              })()}
            </p>
          )}
          {result.store_name && result.store_name !== result.retailer && (
            <p className="text-sm text-white/70">{result.store_name}</p>
          )}
          {result.purchase_date && (
            <p className="text-sm text-white/70">
              {new Date(result.purchase_date).toLocaleDateString("de-DE")}
            </p>
          )}
          {typeof result.total_amount === "number" && (
            <p className="text-xl font-bold text-white">
              {result.total_amount.toFixed(2)} €
            </p>
          )}
          <p className="text-sm text-white/50">
            {t("itemsFound", { count: result.items_count })}
          </p>
          {result.prices_updated > 0 && (
            <p className="text-sm text-green-400">
              {t("pricesUpdated", { count: result.prices_updated })}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onViewReceipt}
          className="rounded-xl bg-aldi-blue px-6 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
        >
          {t("viewReceipt")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}

interface ReceiptErrorPhaseProps {
  t: (key: string) => string;
  errorMsg: string;
  onRetry: () => void;
  onClose: () => void;
}

export function ReceiptErrorPhase({ t, errorMsg, onRetry, onClose }: ReceiptErrorPhaseProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="text-center text-sm text-white/80">{errorMsg}</p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white"
        >
          {t("retry")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}
