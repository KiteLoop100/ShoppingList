"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useProducts } from "@/lib/products-context";
import type { Product } from "@/types";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PhotoUploadReviewRow {
  upload_id: string;
  user_id: string;
  photo_url: string;
  photo_type: string | null;
  status: string;
  extracted_data: {
    photo_type?: string;
    thumbnail_url?: string | null;
    thumbnail_back_url?: string | null;
    products?: Array<{
      name?: string;
      brand?: string | null;
      price?: number | null;
      ean_barcode?: string | null;
      article_number?: string | null;
      weight_or_quantity?: string | null;
      demand_group?: string | null;
    }>;
  } | null;
  created_at: string;
}

interface ReviewCardProps {
  upload: PhotoUploadReviewRow;
  userId: string;
  onConfirmed: () => void;
  onDiscarded: () => void;
}

export function ReviewCard({ upload, userId, onConfirmed, onDiscarded }: ReviewCardProps) {
  const t = useTranslations("capture.review");
  const tCapture = useTranslations("capture");
  const tCommon = useTranslations("common");
  const { products } = useProducts();
  const extracted = upload.extracted_data ?? {};
  const photoType = extracted.photo_type ?? upload.photo_type ?? "product_front";
  const first = extracted.products?.[0];

  const [name, setName] = useState(first?.name ?? "");
  const [brand, setBrand] = useState(first?.brand ?? "");
  const [price, setPrice] = useState(first?.price != null ? String(first.price) : "");
  const [ean, setEan] = useState(first?.ean_barcode ?? "");
  const [articleNumber, setArticleNumber] = useState(
    first?.article_number != null ? String(first.article_number) : ""
  );
  const [weightOrQuantity, setWeightOrQuantity] = useState(first?.weight_or_quantity ?? "");
  const [demandGroup, setDemandGroup] = useState(first?.demand_group ?? "");
  const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestedProduct, setSuggestedProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameNorm = normalizeName(name || "");
  const matchedProduct =
    linkedProductId !== null
      ? products.find((p) => p.product_id === linkedProductId) ?? null
      : (() => {
          if (articleNumber) {
            const byArticle = products.find(
              (p) => p.article_number != null && String(p.article_number) === articleNumber.trim()
            );
            if (byArticle) return byArticle;
          }
          if (ean.trim()) {
            const byEan = products.find(
              (p) => p.ean_barcode != null && String(p.ean_barcode) === ean.trim()
            );
            if (byEan) return byEan;
          }
          if (nameNorm) {
            const byName = products.find(
              (p) => p.name_normalized && p.name_normalized === nameNorm
            );
            if (byName) return byName;
          }
          return null;
        })();

  const runProductSearch = useCallback(async (q: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase || !q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("products")
      .select("product_id, name, name_normalized, article_number, ean_barcode, brand, price, thumbnail_url, thumbnail_back_url, category_id, demand_group, demand_sub_group, assortment_type, availability, region, country, special_start_date, special_end_date, status, source, crowdsource_status, created_at, updated_at, photo_source_id, nutrition_info, ingredients, allergens, weight_or_quantity, price_updated_at, popularity_score")
      .eq("status", "active")
      .ilike("name", `%${q.trim()}%`)
      .limit(20);
    setSearchResults((data ?? []) as Product[]);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => runProductSearch(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchOpen, searchQuery, runProductSearch]);

  useEffect(() => {
    if (photoType !== "product_back") return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data: lastUpload } = await supabase
        .from("photo_uploads")
        .select("upload_id")
        .eq("user_id", userId)
        .eq("photo_type", "product_front")
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !lastUpload?.upload_id) return;
      const { data: prod } = await supabase
        .from("products")
        .select("product_id, name, article_number, ean_barcode, brand, price")
        .eq("photo_source_id", lastUpload.upload_id)
        .maybeSingle();
      if (!cancelled && prod) setSuggestedProduct(prod as Product);
    })();
    return () => {
      cancelled = true;
    };
  }, [photoType, userId]);

  useEffect(() => {
    if (photoType === "product_back" && suggestedProduct && ean.trim()) {
      const byEan = products.find(
        (p) => p.ean_barcode != null && String(p.ean_barcode) === ean.trim()
      );
      if (byEan && !linkedProductId) setLinkedProductId(byEan.product_id);
    }
  }, [photoType, suggestedProduct, ean, products, linkedProductId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/confirm-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: upload.upload_id,
          action: "confirm",
          product: {
            name: name.trim() || undefined,
            brand: brand.trim() || undefined,
            price: price.trim() ? parseFloat(price) : undefined,
            ean_barcode: ean.trim() || undefined,
            article_number: articleNumber.trim() || undefined,
            weight_or_quantity: weightOrQuantity.trim() || undefined,
            demand_group: demandGroup.trim() || undefined,
          },
          linked_product_id: matchedProduct?.product_id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to confirm");
        return;
      }
      onConfirmed();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscard = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/confirm-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_id: upload.upload_id,
          action: "discard",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to discard");
        return;
      }
      onDiscarded();
    } finally {
      setSubmitting(false);
    }
  };

  const openSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(true);
  };

  const selectProduct = (p: Product) => {
    setLinkedProductId(p.product_id);
    setName(p.name);
    if (p.brand) setBrand(p.brand);
    if (p.price != null) setPrice(String(p.price));
    if (p.ean_barcode) setEan(p.ean_barcode);
    if (p.article_number) setArticleNumber(String(p.article_number));
    if (p.weight_or_quantity) setWeightOrQuantity(p.weight_or_quantity);
    if (p.demand_group) setDemandGroup(p.demand_group);
    setSearchOpen(false);
  };

  const clearLink = () => {
    setLinkedProductId(null);
  };

  return (
    <article className="rounded-xl border border-aldi-muted-light bg-white p-4 shadow-sm">
      <div className="mb-4 flex justify-center">
        <img
          src={upload.photo_url}
          alt=""
          className="max-h-40 rounded-lg object-contain"
        />
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("name")}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("brand")}</span>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("price")}</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("ean")}</span>
          <input
            type="text"
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("articleNumber")}</span>
          <input
            type="text"
            value={articleNumber}
            onChange={(e) => setArticleNumber(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("weightOrQuantity")}</span>
          <input
            type="text"
            value={weightOrQuantity}
            onChange={(e) => setWeightOrQuantity(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-aldi-muted">{t("demandGroup")}</span>
          <input
            type="text"
            value={demandGroup}
            onChange={(e) => setDemandGroup(e.target.value)}
            className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
          />
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-aldi-muted-light/40 p-3">
        {photoType === "product_back" ? (
          <>
            <p className="mb-2 text-sm font-medium text-aldi-text">{t("assignToProduct")}</p>
            {matchedProduct ? (
              <p className="text-sm text-aldi-text">
                {t("linkedTo", { name: matchedProduct.name })}
                <button
                  type="button"
                  onClick={openSearch}
                  className="ml-2 text-aldi-blue underline"
                >
                  {t("chooseOtherProduct")}
                </button>
              </p>
            ) : suggestedProduct ? (
              <p className="text-sm text-aldi-text">
                Vorschlag: {suggestedProduct.name}
                <button
                  type="button"
                  onClick={() => selectProduct(suggestedProduct)}
                  className="ml-2 text-aldi-blue underline"
                >
                  {t("assignSuggested")}
                </button>
                <button
                  type="button"
                  onClick={openSearch}
                  className="ml-2 text-aldi-blue underline"
                >
                  {t("searchExistingProduct")}
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={openSearch}
                className="text-sm text-aldi-blue underline"
              >
                {t("searchExistingProduct")}
              </button>
            )}
          </>
        ) : matchedProduct ? (
          <p className="text-sm text-aldi-text">
            {t("linkedTo", { name: matchedProduct.name })}
            <button
              type="button"
              onClick={openSearch}
              className="ml-2 text-aldi-blue underline"
            >
              {t("chooseOtherProduct")}
            </button>
          </p>
        ) : (
          <p className="text-sm text-aldi-text">
            {t("newProduct")}
            <button
              type="button"
              onClick={openSearch}
              className="ml-2 text-aldi-blue underline"
            >
              {t("searchExistingProduct")}
            </button>
          </p>
        )}
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white p-4">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="flex-1 rounded-lg border border-aldi-muted-light px-3 py-2"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="rounded-lg bg-aldi-muted-light px-4 py-2"
            >
              {tCommon("cancel")}
            </button>
          </div>
          <ul className="mt-2 flex-1 overflow-auto">
            {searching ? (
              <li className="p-2 text-aldi-muted">{tCommon("loading")}</li>
            ) : searchResults.length === 0 && searchQuery.trim() ? (
              <li className="p-2 text-aldi-muted">{t("noMatch")}</li>
            ) : (
              searchResults.map((p) => (
                <li key={p.product_id}>
                  <button
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="w-full rounded-lg px-3 py-2 text-left text-aldi-text hover:bg-aldi-muted-light/50"
                  >
                    {p.name}
                    {p.price != null && (
                      <span className="ml-2 text-sm text-aldi-muted">€{p.price.toFixed(2)}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {t("confirm")}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={submitting}
          className="flex-1 rounded-xl border-2 border-aldi-muted bg-white px-4 py-3 font-medium text-aldi-muted disabled:opacity-50"
        >
          {tCapture("discard")}
        </button>
      </div>
    </article>
  );
}
