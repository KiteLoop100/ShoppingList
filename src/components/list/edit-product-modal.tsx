"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCachedCategories } from "@/lib/categories/category-service";
import { translateCategoryName } from "@/lib/i18n/category-translations";
import { BaseModal } from "@/components/ui/base-modal";
import type { Product } from "@/types";
import type { Category } from "@/types";

export interface EditProductModalProps {
  product: Product;
  onClose: () => void;
  onSaved?: () => void;
}

export function EditProductModal({ product, onClose, onSaved }: EditProductModalProps) {
  const t = useTranslations("editProduct");
  const locale = useLocale();

  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [price, setPrice] = useState(product.price != null ? String(product.price) : "");
  const [articleNumber, setArticleNumber] = useState(product.article_number ?? "");
  const [ean, setEan] = useState(product.ean_barcode ?? "");
  const [demandGroup, setDemandGroup] = useState(product.demand_group ?? "");
  const [demandSubGroup, setDemandSubGroup] = useState(product.demand_sub_group ?? "");
  const [weightOrQuantity, setWeightOrQuantity] = useState(product.weight_or_quantity ?? "");
  const [assortmentType, setAssortmentType] = useState(product.assortment_type ?? "daily_range");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedCategories().then((rows) => {
      if (cancelled) return;
      setCategories(rows.map((r) => ({
        category_id: String(r.category_id),
        name: String(r.name),
        name_translations: r.name_translations ?? {},
        icon: String(r.icon ?? "📦"),
        default_sort_position: Number(r.default_sort_position ?? 999),
      })));
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/products/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_existing_product_id: product.product_id,
          name: name.trim(),
          brand: brand.trim() || null,
          category_id: categoryId,
          price: price.trim() ? parseFloat(price) : null,
          article_number: articleNumber.trim() || null,
          ean_barcode: ean.trim() || null,
          demand_group: demandGroup.trim() || null,
          demand_sub_group: demandSubGroup.trim() || null,
          weight_or_quantity: weightOrQuantity.trim() || null,
          assortment_type: assortmentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseModal open={true} onClose={onClose} title={t("title")}>
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="overflow-y-auto overscroll-contain p-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("name")}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("brand")}</span>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("category")}</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {translateCategoryName(c.name, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("price")}</span>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("articleNumber")}</span>
                <input
                  type="text"
                  value={articleNumber}
                  onChange={(e) => setArticleNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("ean")}</span>
                <input
                  type="text"
                  value={ean}
                  onChange={(e) => setEan(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("demandGroup")}</span>
                <input
                  type="text"
                  value={demandGroup}
                  onChange={(e) => setDemandGroup(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("demandSubGroup")}</span>
                <input
                  type="text"
                  value={demandSubGroup}
                  onChange={(e) => setDemandSubGroup(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("weightQuantity")}</span>
                <input
                  type="text"
                  value={weightOrQuantity}
                  onChange={(e) => setWeightOrQuantity(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase text-aldi-muted">{t("assortmentType")}</span>
                <select
                  value={assortmentType}
                  onChange={(e) => setAssortmentType(e.target.value as "daily_range" | "special_food" | "special_nonfood")}
                  className="mt-1 w-full rounded-xl border-2 border-aldi-muted-light px-4 py-2 focus:border-aldi-blue focus:outline-none"
                >
                  <option value="daily_range">{t("assortmentDailyRange")}</option>
                  <option value="special_food">{t("assortmentSpecialFood")}</option>
                  <option value="special_nonfood">{t("assortmentSpecialNonfood")}</option>
                </select>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="shrink-0 border-t border-aldi-muted-light p-4 space-y-2">
              <button
                type="submit"
                disabled={saving || deleting || !name.trim()}
                className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                disabled={saving || deleting}
                onClick={async () => {
                  setDeleting(true);
                  setError(null);
                  try {
                    const supabase = createClientIfConfigured();
                    if (!supabase) { setError(t("supabaseUnavailable")); return; }
                    const { error: delErr } = await supabase
                      .from("products")
                      .update({ status: "inactive" })
                      .eq("product_id", product.product_id);
                    if (delErr) { setError(delErr.message); return; }
                    onSaved?.();
                    onClose();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="min-h-touch w-full rounded-xl border-2 border-red-200 bg-white px-4 py-3 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? t("deleting") : t("deleteProduct")}
              </button>
            </div>
          </form>
    </BaseModal>
  );
}
