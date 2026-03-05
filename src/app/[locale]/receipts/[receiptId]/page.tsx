"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { formatDateLong } from "@/lib/utils/format-date";
import { getRetailerByName } from "@/lib/retailers/retailers";
import {
  loadReceiptWithItems,
  type ReceiptData,
  type ReceiptItem,
} from "@/lib/receipts/receipt-service";

export default function ReceiptDetailPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const params = useParams();
  const receiptId = params.receiptId as string;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPhotos, setShowPhotos] = useState(false);

  const loadReceipt = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase || !receiptId) {
      setLoading(false);
      return;
    }

    const result = await loadReceiptWithItems(receiptId, supabase);
    if (result) {
      setReceipt(result.receipt);
      setItems(result.items);
      setPhotoUrls(result.photoUrls);
    }
    setLoading(false);
  }, [receiptId]);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
        <p className="py-16 text-center text-sm text-aldi-muted">
          {tCommon("loading")}
        </p>
      </main>
    );
  }

  if (!receipt) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
        <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
          <Link
            href="/receipts"
            className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </Link>
          <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">
            {t("detail")}
          </h1>
        </header>
        <p className="py-16 text-center text-sm text-aldi-muted">
          {t("notFound")}
        </p>
      </main>
    );
  }

  const itemsSubtotal = items.reduce((sum, item) => {
    return sum + (item.total_price ?? item.unit_price ?? 0) * (item.total_price ? 1 : item.quantity);
  }, 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl lg:max-w-4xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
        <Link
          href="/receipts"
          className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">
          {t("detail")}
        </h1>
      </header>

      <div className="flex flex-col gap-3 p-4 md:p-6 lg:p-8">
        {/* Receipt header card */}
        <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {receipt.store_name && (
                  <h2 className="text-lg font-semibold text-aldi-text">
                    {receipt.store_name}
                  </h2>
                )}
                {receipt.retailer && (() => {
                  const cfg = getRetailerByName(receipt.retailer);
                  return cfg ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${cfg.color}`}>
                      {cfg.name}
                    </span>
                  ) : null;
                })()}
              </div>
              {receipt.store_address && (
                <p className="mt-0.5 text-xs text-aldi-muted">
                  {receipt.store_address}
                </p>
              )}
            </div>
            {typeof receipt.total_amount === "number" && (
              <div className="text-right">
                <p className="text-2xl font-bold text-aldi-text">
                  {receipt.total_amount.toFixed(2)} €
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-aldi-muted">
            <span>{formatDateLong(receipt.purchase_date, "de", t("unknownDate"))}</span>
            {receipt.purchase_time && (
              <span>{receipt.purchase_time.slice(0, 5)} Uhr</span>
            )}
            {receipt.payment_method && (
              <span className="rounded-full bg-aldi-blue-light px-2 py-0.5 text-aldi-blue">
                {receipt.payment_method}
              </span>
            )}
          </div>

          {photoUrls.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPhotos(!showPhotos)}
              className="mt-3 text-xs font-medium text-aldi-blue"
            >
              {showPhotos ? t("hidePhotos") : t("showPhotos")}
            </button>
          )}
          {showPhotos && photoUrls.length > 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {photoUrls.map((url, idx) => (
                <Image
                  key={idx}
                  src={url}
                  alt={`${t("photo")} ${idx + 1}`}
                  width={96}
                  height={128}
                  className="h-32 w-auto rounded-lg object-contain"
                  unoptimized
                />
              ))}
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between border-b border-aldi-muted-light px-5 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">
              {t("products")} ({items.length})
            </h3>
            {items.length > 0 && (() => {
              const linked = items.filter((i) => i.product_name).length;
              const unlinked = items.length - linked;
              return unlinked > 0 ? (
                <span className="text-[11px] text-aldi-muted">
                  {linked} {t("linked")}, {unlinked} {t("unlinked")}
                </span>
              ) : null;
            })()}
          </div>

          <div className="divide-y divide-aldi-muted-light/50">
            {items.map((item) => {
              const displayName =
                item.product_name || item.receipt_name;
              const isLinked = !!(item.product_id || item.competitor_product_id);
              const price =
                item.total_price ??
                (item.unit_price != null
                  ? item.unit_price * item.quantity
                  : null);

              return (
                <div
                  key={item.receipt_item_id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-aldi-muted">
                    {item.position}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-sm ${
                        isLinked
                          ? "font-medium text-aldi-text"
                          : "text-aldi-text-secondary"
                      }`}
                    >
                      {displayName}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-aldi-muted">
                      {item.article_number && (
                        <span>Art. {item.article_number}</span>
                      )}
                      {item.quantity > 1 && !item.is_weight_item && (
                        <span>{item.quantity}×</span>
                      )}
                      {item.is_weight_item && item.weight_kg && (
                        <span>{item.weight_kg} kg</span>
                      )}
                      {isLinked ? (
                        <span className="rounded bg-green-50 px-1 text-green-600">
                          ✓
                        </span>
                      ) : (
                        <span
                          className="rounded bg-amber-50 px-1 text-amber-500"
                          title={t("notLinkedTooltip")}
                        >
                          ?
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-aldi-text">
                    {typeof price === "number"
                      ? `${price.toFixed(2)} €`
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="border-t border-aldi-muted-light px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-aldi-text">
                {t("total")}
              </span>
              <span className="text-base font-bold text-aldi-text">
                {typeof receipt.total_amount === "number"
                  ? `${receipt.total_amount.toFixed(2)} €`
                  : `${itemsSubtotal.toFixed(2)} €`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
