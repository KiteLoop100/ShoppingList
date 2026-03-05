"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { db, type LocalProduct, type LocalCategoryAlias, type LocalSortingError } from "@/lib/db";
import { getStoresSorted } from "@/lib/store/store-service";
import { useProducts } from "@/lib/products-context";
import type { DemandGroup } from "@/types";

import { AdminAuthGuard } from "./admin-auth-guard";
import { CategoryAliasPanel } from "./category-alias-panel";
import { BatchJobsPanel } from "./batch-jobs-panel";
import { GalleryUploadPanel } from "./gallery-upload-panel";
import { SortingErrorsPanel } from "./sorting-errors-panel";
import { FeedbackPanel } from "./feedback-panel";
import { useBatchJobs } from "./use-batch-jobs";
import { useGalleryUpload } from "./use-gallery-upload";
import { CreateProductModal } from "@/app/[locale]/capture/create-product-modal";

type Section = "products" | "aliases" | "errors" | "feedback";

export function AdminClient() {
  const t = useTranslations("admin");
  const tCapture = useTranslations("capture");
  const tCommon = useTranslations("common");
  const { refetch: refetchProducts } = useProducts();
  const [section, setSection] = useState<Section>("products");
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const [, setProducts] = useState<LocalProduct[]>([]);
  const [demandGroups, setDemandGroups] = useState<DemandGroup[]>([]);
  const [aliases, setAliases] = useState<LocalCategoryAlias[]>([]);
  const [errors, setErrors] = useState<LocalSortingError[]>([]);
  const [stores, setStores] = useState<{ store_id: string; name: string }[]>([]);

  const batchJobs = useBatchJobs(true);
  const gallery = useGalleryUpload();

  const loadData = useCallback(async () => {
    const [prods, dgs, al, errs, sts] = await Promise.all([
      db.products.toArray(),
      db.demand_groups.toArray(),
      db.category_aliases.toArray(),
      db.sorting_errors.toArray(),
      getStoresSorted().then((s) => s.map((x) => ({ store_id: x.store_id, name: x.name }))),
    ]);
    setProducts(prods as LocalProduct[]);
    setDemandGroups(dgs.map(dg => ({ code: dg.code, name: dg.name, name_en: dg.name_en, icon: dg.icon, color: dg.color, sort_position: dg.sort_position })));
    setAliases(al as LocalCategoryAlias[]);
    setErrors(errs as LocalSortingError[]);
    setStores(sts);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <AdminAuthGuard>
      <main className="mx-auto min-h-screen max-w-4xl bg-aldi-bg p-4">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/" className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50" aria-label={tCommon("back")}>←</Link>
          <h1 className="text-xl font-bold text-aldi-blue">{t("title")}</h1>
        </header>

        <nav className="mb-6 flex gap-2 border-b border-aldi-muted-light pb-2">
          {(["products", "aliases", "errors", "feedback"] as Section[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`min-h-touch rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                section === s ? "bg-aldi-blue text-white" : "bg-aldi-muted-light/40 text-aldi-text hover:bg-aldi-muted-light/70"
              }`}
            >
              {t(s)}
            </button>
          ))}
        </nav>

        {section === "products" && (
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-aldi-blue">{t("products")}</h2>
            <button
              type="button"
              onClick={() => setCreateProductOpen(true)}
              className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-aldi-blue text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="text-[15px] font-medium text-aldi-text">{tCapture("createProduct.button")}</span>
            </button>
            <BatchJobsPanel batchJobs={batchJobs} />
            <GalleryUploadPanel gallery={gallery} />
          </section>
        )}

        {section === "aliases" && (
          <CategoryAliasPanel aliases={aliases} demandGroups={demandGroups} onDataChanged={loadData} />
        )}

        {section === "errors" && (
          <SortingErrorsPanel errors={errors} stores={stores} />
        )}

        {section === "feedback" && (
          <FeedbackPanel />
        )}
        <CreateProductModal
          open={createProductOpen}
          onClose={() => setCreateProductOpen(false)}
          onSaved={() => {
            refetchProducts();
            loadData();
          }}
        />
      </main>
    </AdminAuthGuard>
  );
}
