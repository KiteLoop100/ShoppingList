"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getOrCreateActiveList, getListItems, addListItem } from "@/lib/list";
import { assignCategory } from "@/lib/category/assign-category";
import { FlyerPageImage } from "@/app/[locale]/flyer/flyer-page-image";

interface FlyerPageRow {
  page_id: string;
  page_number: number;
  image_url: string | null;
}

interface ProductRow {
  product_id: string;
  name: string;
  price: number | null;
  category_id: string;
  flyer_page: number | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function FlyerDetailPage() {
  const params = useParams();
  const flyerId = typeof params.flyerId === "string" ? params.flyerId : null;
  const t = useTranslations("flyer");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [flyer, setFlyer] = useState<{
    flyer_id: string;
    title: string;
    valid_from: string;
    valid_until: string;
  } | null>(null);
  const [pages, setPages] = useState<FlyerPageRow[]>([]);
  const [productsByPage, setProductsByPage] = useState<Map<number, ProductRow[]>>(new Map());
  const [productIdsOnList, setProductIdsOnList] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);

  const refreshListIds = useCallback(async () => {
    const list = await getOrCreateActiveList();
    const items = await getListItems(list.list_id);
    setProductIdsOnList(new Set(items.map((i) => i.product_id).filter(Boolean) as string[]));
  }, []);

  useEffect(() => {
    if (!flyerId) {
      setLoading(false);
      return;
    }
    refreshListIds();
  }, [flyerId, refreshListIds]);

  useEffect(() => {
    const supabase = createClientIfConfigured();
    if (!flyerId || !supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: flyerData, error: flyerErr } = await supabase
        .from("flyers")
        .select("flyer_id, title, valid_from, valid_until")
        .eq("flyer_id", flyerId)
        .single();
      if (flyerErr || !flyerData) {
        setFlyer(null);
        setLoading(false);
        return;
      }
      setFlyer(flyerData);

      const { data: pagesData } = await supabase
        .from("flyer_pages")
        .select("page_id, page_number, image_url")
        .eq("flyer_id", flyerId)
        .order("page_number", { ascending: true });
      setPages(pagesData ?? []);

      const { data: productsData } = await supabase
        .from("products")
        .select("product_id, name, price, category_id, flyer_page")
        .eq("flyer_id", flyerId)
        .eq("status", "active");
      const byPage = new Map<number, ProductRow[]>();
      for (const p of productsData ?? []) {
        const pageNum = p.flyer_page ?? 0;
        if (pageNum >= 1) {
          const list = byPage.get(pageNum) ?? [];
          list.push({
            product_id: p.product_id,
            name: p.name,
            price: p.price,
            category_id: p.category_id,
            flyer_page: p.flyer_page,
          });
          byPage.set(pageNum, list);
        }
      }
      setProductsByPage(byPage);
      setLoading(false);
    })();
  }, [flyerId]);

  const handleAddProduct = useCallback(
    async (product: ProductRow) => {
      const list = await getOrCreateActiveList();
      const { category_id } = await assignCategory(product.name);
      await addListItem({
        list_id: list.list_id,
        product_id: product.product_id,
        custom_name: null,
        display_name: product.name,
        category_id: category_id ?? product.category_id,
        quantity: 1,
      });
      setProductIdsOnList((prev) => new Set(prev).add(product.product_id));
      setToast(true);
      const id = setTimeout(() => setToast(false), 2000);
      return () => clearTimeout(id);
    },
    []
  );

  if (!flyerId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
        <p className="p-4 text-aldi-muted">{tCommon("loading")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-aldi-muted-light bg-white px-4 py-3">
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
          <h1 className="truncate text-lg font-bold text-aldi-blue">{flyer?.title ?? ""}</h1>
          {flyer && (
            <p className="text-sm text-aldi-muted">
              {t("validUntil", { date: formatDate(flyer.valid_until) })}
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto pb-8">
        {loading ? (
          <p className="py-8 text-center text-aldi-muted">{tCommon("loading")}</p>
        ) : (
          <>
            {pages.map((page) => (
              <section key={page.page_id} className="border-b border-aldi-muted-light">
                {page.image_url && (
                  <FlyerPageImage
                    imageUrl={page.image_url}
                    className="h-auto w-full object-contain"
                    alt=""
                  />
                )}
                <div className="px-4 py-3">
                  <h2 className="mb-2 text-sm font-medium text-aldi-muted">
                    {t("productsOnPage")}
                  </h2>
                  <ul className="flex flex-col gap-1">
                    {(productsByPage.get(page.page_number) ?? []).map((product) => {
                      const onList = productIdsOnList.has(product.product_id);
                      return (
                        <li
                          key={product.product_id}
                          className="flex min-h-touch items-center justify-between gap-3 rounded-lg bg-aldi-muted-light/30 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-aldi-text">
                              {product.name}
                            </span>
                            {product.price != null && (
                              <span className="text-sm tabular-nums text-aldi-muted">
                                €{product.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {onList ? (
                            <span className="shrink-0 text-aldi-blue" aria-hidden>
                              {t("alreadyOnList")}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="min-h-touch shrink-0 rounded-lg bg-aldi-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                              onClick={() => handleAddProduct(product)}
                            >
                              + {t("addToList")}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </>
        )}
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