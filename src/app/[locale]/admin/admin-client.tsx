"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { db, type LocalProduct, type LocalCategoryAlias, type LocalSortingError } from "@/lib/db";
import { getStoresSorted } from "@/lib/store/store-service";
import type { Category } from "@/types";

import { AdminAuthGuard } from "./admin-auth-guard";
import { CategoryAliasPanel } from "./category-alias-panel";
import { BatchJobsPanel } from "./batch-jobs-panel";
import { GalleryUploadPanel } from "./gallery-upload-panel";
import { SortingErrorsPanel } from "./sorting-errors-panel";
import { useBatchJobs } from "./use-batch-jobs";
import { useGalleryUpload } from "./use-gallery-upload";

type Section = "products" | "aliases" | "errors";

export function AdminClient() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [section, setSection] = useState<Section>("products");

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [aliases, setAliases] = useState<LocalCategoryAlias[]>([]);
  const [errors, setErrors] = useState<LocalSortingError[]>([]);
  const [stores, setStores] = useState<{ store_id: string; name: string }[]>([]);

  const batchJobs = useBatchJobs(true);
  const gallery = useGalleryUpload();

  const loadData = useCallback(async () => {
    const [prods, cats, al, errs, sts] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.category_aliases.toArray(),
      db.sorting_errors.toArray(),
      getStoresSorted().then((s) => s.map((x) => ({ store_id: x.store_id, name: x.name }))),
    ]);
    setProducts(prods as LocalProduct[]);
    setCategories(cats);
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
          {(["products", "aliases", "errors"] as Section[]).map((s) => (
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
            <BatchJobsPanel batchJobs={batchJobs} />
            <GalleryUploadPanel gallery={gallery} />
          </section>
        )}

        {section === "aliases" && (
          <CategoryAliasPanel aliases={aliases} categories={categories} onDataChanged={loadData} />
        )}

        {section === "errors" && (
          <SortingErrorsPanel errors={errors} stores={stores} />
        )}
      </main>
    </AdminAuthGuard>
  );
}
