"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { formatDateLong } from "@/lib/utils/format-date";
import { getRetailerByName } from "@/lib/retailers/retailers";
import {
  loadReceiptWithItems,
  linkReceiptItemToProduct,
  groupReceiptItems,
  type ReceiptData,
  type ReceiptItem,
  type GroupedReceiptItem,
} from "@/lib/receipts/receipt-service";
import { ProductCaptureModal } from "@/components/product-capture/product-capture-modal";
import { ProductDetailModal } from "@/components/list/product-detail-modal";
import { CompetitorProductDetailModal } from "@/components/list/competitor-product-detail-modal";
import { db } from "@/lib/db";
import { findCompetitorProductById } from "@/lib/competitor-products/competitor-product-service";
import { log } from "@/lib/utils/logger";
import type { Product, CompetitorProduct } from "@/types";
import type { ProductCaptureValues } from "@/components/product-capture/hooks/use-product-capture-form";

const RECEIPT_THUMB_SIZE = 40;

export default function ReceiptDetailPage() {
  const t = useTranslations("receipts");
  const tCommon = useTranslations("common");
  const params = useParams();
  const receiptId = params.receiptId as string;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [rawItems, setRawItems] = useState<ReceiptItem[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPhotos, setShowPhotos] = useState(false);
  const [captureItem, setCaptureItem] = useState<GroupedReceiptItem | null>(null);
  const [toast, setToast] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailCompetitor, setDetailCompetitor] = useState<CompetitorProduct | null>(null);
  const [detailRetailer, setDetailRetailer] = useState<string | null>(null);
  const [editAldiProduct, setEditAldiProduct] = useState<Product | null>(null);
  const [editCompetitorProduct, setEditCompetitorProduct] = useState<CompetitorProduct | null>(null);

  const groupedItems = useMemo(() => groupReceiptItems(rawItems), [rawItems]);

  const loadReceipt = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase || !receiptId) {
      setLoading(false);
      return;
    }

    const result = await loadReceiptWithItems(receiptId, supabase);
    if (result) {
      setReceipt(result.receipt);
      setRawItems(result.items);
      setPhotoUrls(result.photoUrls);
    }
    setLoading(false);
  }, [receiptId]);

  useEffect(() => {
    loadReceipt();
  }, [loadReceipt]);

  const handlePhotoSaved = useCallback(async (productId: string, productType: "aldi" | "competitor") => {
    if (captureItem) {
      const itemIds = captureItem.original_item_ids ?? [captureItem.receipt_item_id];
      const supabase = createClientIfConfigured();
      if (supabase) {
        try {
          await linkReceiptItemToProduct(itemIds, productId, supabase, productType);
        } catch (e) {
          log.warn("[receipts] Failed to link receipt item(s) after product creation:", e);
        }
      }
    }

    setCaptureItem(null);
    setEditAldiProduct(null);
    setEditCompetitorProduct(null);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
    await loadReceipt();
  }, [captureItem, loadReceipt]);

  const handleItemClick = useCallback(async (item: GroupedReceiptItem) => {
    if (item.competitor_product_id) {
      const cp = await findCompetitorProductById(item.competitor_product_id);
      if (cp) {
        setDetailCompetitor(cp);
        setDetailRetailer(receipt?.retailer ?? null);
        return;
      }
    }
    if (item.product_id) {
      const fromDb = await db.products
        .where("product_id").equals(item.product_id).first();
      if (fromDb) {
        setDetailProduct(fromDb as Product);
        return;
      }
      const supabase = createClientIfConfigured();
      if (supabase) {
        const { data } = await supabase
          .from("products").select("*")
          .eq("product_id", item.product_id).maybeSingle();
        if (data) { setDetailProduct(data as Product); return; }
      }
    }
    setCaptureItem(item);
  }, [receipt?.retailer]);

  const captureInitialValues: Partial<ProductCaptureValues> | undefined = captureItem
    ? {
        name: captureItem.receipt_name,
        articleNumber: captureItem.article_number ?? "",
        retailer: receipt?.retailer ?? "ALDI",
        price: captureItem.unit_price != null
          ? String(captureItem.unit_price).replace(".", ",")
          : captureItem.total_price != null
            ? String(captureItem.total_price).replace(".", ",")
            : "",
      }
    : undefined;

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

  const itemsSubtotal = rawItems.reduce((sum, item) => {
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
              {t("products")} ({groupedItems.length})
            </h3>
            {groupedItems.length > 0 && (() => {
              const linked = groupedItems.filter((i) => i.product_name).length;
              const unlinked = groupedItems.length - linked;
              return unlinked > 0 ? (
                <span className="text-[11px] text-aldi-muted">
                  {linked} {t("linked")}, {unlinked} {t("unlinked")}
                </span>
              ) : null;
            })()}
          </div>

          <div className="divide-y divide-aldi-muted-light/50">
            {groupedItems.map((item) => {
              const displayName =
                item.product_name || item.receipt_name;
              const isLinked = !!(item.product_id || item.competitor_product_id);
              const price = item.total_price;

              return (
                <div
                  key={item.receipt_item_id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  {item.thumbnail_url ? (
                    <div
                      className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-white"
                      onClick={() => handleItemClick(item)}
                    >
                      <Image
                        src={item.thumbnail_url}
                        alt=""
                        role="presentation"
                        width={RECEIPT_THUMB_SIZE}
                        height={RECEIPT_THUMB_SIZE}
                        className="h-full w-full object-contain object-center"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCaptureItem(item)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-aldi-muted-light text-aldi-muted transition-colors hover:border-aldi-blue hover:text-aldi-blue"
                      title={t("addPhoto")}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </button>
                  )}

                  <button
                    type="button"
                    className="flex min-h-touch min-w-0 flex-1 flex-col py-1 text-left"
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-sm ${
                          isLinked
                            ? "font-medium text-aldi-text hover:underline"
                            : "text-aldi-text-secondary hover:underline"
                        }`}
                      >
                        {displayName}
                      </span>
                      {item.quantity > 1 && !item.is_weight_item && (
                        <span className="shrink-0 rounded-full bg-aldi-blue-light px-1.5 py-0.5 text-[11px] font-semibold leading-none text-aldi-blue">
                          {item.quantity}×
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-aldi-muted">
                      {item.article_number && (
                        <span>Art. {item.article_number}</span>
                      )}
                      {item.is_weight_item && item.weight_kg != null && (
                        <span>
                          {Number.isInteger(item.weight_kg)
                            ? item.weight_kg
                            : item.weight_kg.toFixed(2)}{" "}
                          kg
                        </span>
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
                  </button>

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

      <ProductCaptureModal
        open={!!captureItem || !!editAldiProduct || !!editCompetitorProduct}
        mode={editAldiProduct || editCompetitorProduct ? "edit" : "create"}
        onClose={() => { setCaptureItem(null); setEditAldiProduct(null); setEditCompetitorProduct(null); }}
        onSaved={(productId, productType) => {
          handlePhotoSaved(productId, productType);
        }}
        initialValues={captureInitialValues}
        lockedFields={captureItem ? ["name", "articleNumber", "price"] : undefined}
        editAldiProduct={editAldiProduct}
        editCompetitorProduct={editCompetitorProduct}
      />

      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        onEdit={(p) => {
          setDetailProduct(null);
          setEditAldiProduct(p);
        }}
      />

      <CompetitorProductDetailModal
        product={detailCompetitor}
        onClose={() => setDetailCompetitor(null)}
        onEdit={(cp) => {
          setDetailCompetitor(null);
          setEditCompetitorProduct(cp);
        }}
        retailer={detailRetailer}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-aldi-text px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {t("photoSaved")}
        </div>
      )}
    </main>
  );
}
