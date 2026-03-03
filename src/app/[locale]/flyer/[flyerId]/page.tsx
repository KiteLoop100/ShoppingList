"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { getOrCreateActiveList, getListItems, addListItem } from "@/lib/list";
import {
  loadFlyerWithPages,
  fetchFlyerProducts,
  type FlyerRow,
  type FlyerPageRow,
  type ProductRow,
} from "@/lib/flyers/flyer-service";
import { FlyerPageImage, type Hotspot } from "@/app/[locale]/flyer/flyer-page-image";
import { log } from "@/lib/utils/logger";
import { formatFlyerDate } from "@/lib/utils/format-date";

const MIN_HOTSPOT_SIZE = 80;

export default function FlyerDetailPage() {
  const params = useParams();
  const rawId = params?.flyerId;
  const flyerId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  const t = useTranslations("flyer");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [flyer, setFlyer] = useState<FlyerRow | null>(null);
  const [pages, setPages] = useState<FlyerPageRow[]>([]);
  const [productsByPage, setProductsByPage] = useState<Map<number, ProductRow[]>>(new Map());
  const [productIdsOnList, setProductIdsOnList] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{
    pagesProcessed: number;
    totalPages: number;
  } | null>(null);
  const processingRef = useRef(false);

  const refreshListIds = useCallback(async () => {
    try {
      const list = await getOrCreateActiveList();
      const items = await getListItems(list.list_id);
      setProductIdsOnList(new Set(items.map((i) => i.product_id).filter(Boolean) as string[]));
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    if (!flyerId) {
      setLoading(false);
      return;
    }
    refreshListIds();
  }, [flyerId, refreshListIds]);

  useEffect(() => {
    if (!flyerId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const result = await loadFlyerWithPages(flyerId);
        if ("error" in result) {
          setFetchError(result.error);
          return;
        }
        setFlyer(result.flyer);
        setPages(result.pages);
        setProductsByPage(result.productsByPage);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : tCommon("unknownError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [flyerId]);

  const refreshProducts = useCallback(async () => {
    if (!flyerId) return;
    const byPage = await fetchFlyerProducts(flyerId);
    setProductsByPage(byPage);
  }, [flyerId]);

  useEffect(() => {
    if (!flyerId || loading || processingRef.current) return;

    let cancelled = false;

    (async () => {
      let statusData: { pending: boolean; upload_id?: string; status?: string; total_pages?: number; pages_processed?: number };
      try {
        const statusRes = await fetch(`/api/flyer-processing-status?flyer_id=${encodeURIComponent(flyerId)}`);
        if (!statusRes.ok) return;
        statusData = await statusRes.json();
      } catch { return; }

      if (cancelled || !statusData.pending) return;

      const uploadId = statusData.upload_id!;
      const totalPages = statusData.total_pages!;
      let pagesProcessed = statusData.pages_processed ?? 0;

      if (pagesProcessed >= totalPages) return;

      processingRef.current = true;
      setProcessingProgress({ pagesProcessed, totalPages });

      while (pagesProcessed < totalPages && !cancelled) {
        const nextPage = pagesProcessed + 1;
        try {
          const res = await fetch("/api/process-flyer-page", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              upload_id: uploadId,
              flyer_id: flyerId,
              page_number: nextPage,
            }),
          });
          if (!res.ok) {
            log.error("[flyer-detail] page", nextPage, "failed:", await res.text());
            break;
          }
          const data = await res.json();
          pagesProcessed = data.pages_processed ?? nextPage;
          if (!cancelled) {
            setProcessingProgress({ pagesProcessed, totalPages });
            await refreshProducts();
          }
          if (data.completed) break;
        } catch (e) {
          log.error("[flyer-detail] page processing error:", e);
          break;
        }
      }

      if (!cancelled) {
        setProcessingProgress(null);
        processingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [flyerId, loading, refreshProducts]);

  const handleAddProduct = useCallback(async (product: ProductRow) => {
    try {
      const list = await getOrCreateActiveList();
      await addListItem({
        list_id: list.list_id,
        product_id: product.product_id,
        custom_name: null,
        display_name: product.name,
        demand_group_code: product.demand_group_code ?? "AK",
        quantity: 1,
      });
      setProductIdsOnList((prev) => new Set(prev).add(product.product_id));
      setToast(true);
      setTimeout(() => setToast(false), 2000);
    } catch {
      // non-fatal
    }
  }, []);

  // Guard: invalid flyerId in URL
  if (!flyerId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-aldi-bg md:max-w-3xl lg:max-w-5xl">
        <p className="p-4 text-aldi-muted">{t("invalidId")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-3xl lg:h-[calc(100vh-49px)] lg:max-w-5xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
        <button
          type="button"
          className="touch-target -ml-1 flex items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          onClick={() => router.back()}
          aria-label={tCommon("back")}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-aldi-blue">
            {flyer?.title ?? (loading ? "" : "Handzettel")}
          </h1>
          {flyer && (
            <p className="text-sm text-aldi-muted">
              {t("validUntil", { date: formatFlyerDate(flyer.valid_until) })}
            </p>
          )}
        </div>
      </header>

      {processingProgress && (
        <div className="shrink-0 bg-aldi-blue/5 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-aldi-blue">
                {t("processingPages", {
                  current: processingProgress.pagesProcessed,
                  total: processingProgress.totalPages,
                })}
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-aldi-blue/10">
                <div
                  className="h-full rounded-full bg-aldi-blue transition-all duration-500"
                  style={{
                    width: `${(processingProgress.pagesProcessed / processingProgress.totalPages) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain pb-8">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
            <p className="text-sm text-aldi-muted">{tCommon("loading")}</p>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-3 py-16 px-8 text-center">
            <p className="font-medium text-aldi-text">{t(fetchError)}</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-aldi-blue px-4 py-2 text-aldi-blue"
            >
              {tCommon("back")}
            </button>
          </div>
        ) : pages.length === 0 ? (
          <p className="py-8 text-center text-sm text-aldi-muted">{t("noPages")}</p>
        ) : (
          pages.map((page) => {
            const pageProducts = productsByPage.get(page.page_number) ?? [];
            const hotspots: Hotspot[] = [];

            for (const p of pageProducts) {
              if (
                p.bbox &&
                p.bbox.x_max - p.bbox.x_min >= MIN_HOTSPOT_SIZE &&
                p.bbox.y_max - p.bbox.y_min >= MIN_HOTSPOT_SIZE
              ) {
                hotspots.push({ product: p, bbox: p.bbox });
              }
            }

            return (
              <section key={page.page_id} className="border-b border-aldi-muted-light">
                {page.image_url && (
                  <FlyerPageImage
                    imageUrl={page.image_url}
                    className="h-auto w-full object-contain"
                    alt={`Seite ${page.page_number}`}
                    hotspots={hotspots}
                    onHotspotTap={handleAddProduct}
                    productIdsOnList={productIdsOnList}
                  />
                )}
                {pageProducts.length > 0 && (
                  <div className="px-4 py-3">
                    <h2 className="mb-2 text-sm font-medium text-aldi-muted">
                      {t("productsOnPage")}
                    </h2>
                    <ul className="flex flex-col gap-1">
                      {pageProducts.map((product) => {
                        const onList = productIdsOnList.has(product.product_id);
                        const displayPrice = product.price_in_flyer ?? product.price;
                        return (
                          <li
                            key={product.product_id}
                            className="flex min-h-touch items-center justify-between gap-3 rounded-lg bg-aldi-muted-light/30 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-aldi-text">
                                {product.name}
                              </span>
                              {displayPrice != null && (
                                <span className="text-sm tabular-nums text-aldi-muted">
                                  {"\u20AC"}{displayPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {onList ? (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aldi-blue/10 text-aldi-blue" aria-label={t("alreadyOnList")}>
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-aldi-blue text-aldi-blue transition-colors hover:bg-aldi-blue hover:text-white active:bg-aldi-blue active:text-white"
                                onClick={() => handleAddProduct(product)}
                                aria-label={t("addToList")}
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            );
          }))
        }
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-4 right-4 z-20 rounded-lg bg-aldi-blue px-4 py-3 text-center text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          {t("addedToast")}
        </div>
      )}
    </main>
  );
}
