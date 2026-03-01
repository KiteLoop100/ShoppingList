"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrentCountry } from "@/lib/current-country-context";
import { getRetailersForCountry } from "@/lib/retailers/retailers";
import { createClientIfConfigured } from "@/lib/supabase/client";
import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { log } from "@/lib/utils/logger";

interface CompetitorProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (productId: string) => void;
  initialName?: string;
  initialRetailer?: string;
  initialEan?: string;
  initialBrand?: string;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function titleCase(s: string): string {
  return s.replace(/[a-zA-ZäöüÄÖÜßàáâãèéêìíîòóôùúûñç]+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}

export function CompetitorProductFormModal({
  open,
  onClose,
  onSaved,
  initialName = "",
  initialRetailer = "",
  initialEan = "",
  initialBrand = "",
}: CompetitorProductFormModalProps) {
  const t = useTranslations("list");
  const { country } = useCurrentCountry();
  const retailers = getRetailersForCountry(country ?? "DE");

  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState(initialBrand);
  const [price, setPrice] = useState("");
  const [ean, setEan] = useState(initialEan);
  const [retailer, setRetailer] = useState(initialRetailer);
  const [customRetailer, setCustomRetailer] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [frontPhotoPreview, setFrontPhotoPreview] = useState<string | null>(null);
  const [otherPhotoPreview, setOtherPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const otherInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initialName ? titleCase(initialName) : "");
      setBrand(initialBrand);
      setPrice("");
      setEan(initialEan);
      setRetailer(initialRetailer);
      setCustomRetailer("");
      setPhotoFile(null);
      setFrontPhotoPreview(null);
      setOtherPhotoPreview(null);
      setError(null);
      setAnalyzing(false);
    }
  }, [open, initialName, initialBrand, initialEan, initialRetailer]);

  const handleFrontPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setFrontPhotoPreview(URL.createObjectURL(file));

    setAnalyzing(true);
    setError(null);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/extract-product-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.name) setName(titleCase(data.name));
      if (data.brand && !brand) setBrand(data.brand);
      if (data.ean_barcode && !ean) setEan(data.ean_barcode);
      if (data.price != null && !price) setPrice(String(data.price).replace(".", ","));
    } catch (err) {
      log.error("[CompetitorProductForm] auto-fill failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [brand, ean, price]);

  const handleOtherPhoto = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setOtherPhotoPreview(URL.createObjectURL(file));

    setAnalyzing(true);
    setError(null);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/extract-product-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.name) setName(titleCase(data.name));
      if (data.brand && !brand) setBrand(data.brand);
      if (data.ean_barcode && !ean) setEan(data.ean_barcode);
      if (data.price != null && !price) setPrice(String(data.price).replace(".", ","));
    } catch (err) {
      log.error("[CompetitorProductForm] other-photo extraction failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [brand, ean, price]);

  const effectiveRetailer = retailer === "__custom__" ? customRetailer.trim() : retailer;

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    if (!effectiveRetailer) return;
    setSaving(true);
    setError(null);

    try {
      const product = await findOrCreateCompetitorProduct(
        name.trim(),
        country ?? "DE",
        ean.trim() || null
      );

      if (brand.trim() && !product.brand) {
        await updateCompetitorProduct(product.product_id, { brand: brand.trim() });
      }
      if (ean.trim() && !product.ean_barcode) {
        await updateCompetitorProduct(product.product_id, { ean_barcode: ean.trim() });
      }

      const priceNum = parseFloat(price.replace(",", "."));
      if (!isNaN(priceNum) && priceNum > 0) {
        await addCompetitorPrice(product.product_id, effectiveRetailer, priceNum);
      }

      if (photoFile) {
        const supabase = createClientIfConfigured();
        if (supabase) {
          const ext = photoFile.name.split(".").pop() ?? "jpg";
          const path = `${product.product_id}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("competitor-product-photos")
            .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from("competitor-product-photos")
              .getPublicUrl(path);
            if (urlData?.publicUrl) {
              await updateCompetitorProduct(product.product_id, {
                thumbnail_url: urlData.publicUrl,
              });
            }
          } else {
            log.error("[CompetitorProductForm] photo upload failed:", uploadErr);
          }
        }
      }

      onSaved(product.product_id);
      onClose();
    } catch (e) {
      log.error("[CompetitorProductForm] save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [name, brand, price, ean, effectiveRetailer, photoFile, country, onSaved, onClose]);

  if (!open) return null;

  const showCustomRetailerInput = retailer === "__custom__";
  const canSubmit = name.trim().length > 0 && effectiveRetailer.length > 0 && !saving && !analyzing;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-aldi-text">
              {t("competitorProductTitle")}
            </h2>
            <p className="text-[11px] text-aldi-muted">{t("competitorProductSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-aldi-muted hover:text-aldi-text"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          {/* Photo section -- first element for quick capture */}
          <div>
            <label className="mb-1 block text-xs font-medium text-aldi-muted">
              {t("competitorProductPhoto")}
            </label>
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFrontPhoto}
              className="hidden"
            />
            <input
              ref={otherInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleOtherPhoto}
              className="hidden"
            />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => frontInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-blue/40 bg-aldi-blue/5 px-3 py-2 text-sm font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/10 disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  {t("competitorPhotoFront")}
                </button>
                {frontPhotoPreview && (
                  <img src={frontPhotoPreview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => otherInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-muted-light px-3 py-2 text-sm text-aldi-muted transition-colors hover:border-aldi-blue hover:text-aldi-blue disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                  {t("competitorPhotoOther")}
                </button>
                {otherPhotoPreview && (
                  <img src={otherPhotoPreview} alt="" className="h-12 w-12 rounded-lg object-cover" />
                )}
              </div>
            </div>
            {analyzing && (
              <div className="mt-2 flex items-center gap-2 text-xs text-aldi-blue">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {t("competitorPhotoAnalyzing")}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-aldi-muted">
              {t("competitorProductName")} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-aldi-muted">
              {t("competitorProductBrand")}
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-aldi-muted">
                {t("competitorProductRetailer")} *
              </label>
              <select
                value={retailer}
                onChange={(e) => setRetailer(e.target.value)}
                className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
              >
                <option value="">--</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
                <option value="__custom__">{t("otherRetailer")}</option>
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium text-aldi-muted">
                {t("competitorProductPrice")}
              </label>
              <div className="flex items-center rounded-xl border-2 border-aldi-muted-light focus-within:border-aldi-blue">
                <span className="pl-3 text-sm text-aldi-muted">€</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          {showCustomRetailerInput && (
            <input
              type="text"
              value={customRetailer}
              onChange={(e) => setCustomRetailer(e.target.value)}
              placeholder={t("otherRetailerPlaceholder")}
              className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
            />
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-aldi-muted">
              {t("competitorProductEan")}
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              placeholder="4001234567890"
              className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="border-t border-aldi-muted-light px-4 py-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {saving ? t("competitorProductSaving") : t("competitorProductSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
