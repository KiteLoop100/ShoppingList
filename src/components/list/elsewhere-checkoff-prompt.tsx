"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useCurrentCountry } from "@/lib/current-country-context";
import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { uploadCompetitorPhoto } from "@/lib/competitor-products/upload-competitor-photo";
import { log } from "@/lib/utils/logger";

interface ElsewhereCheckoffPromptProps {
  open: boolean;
  itemName: string;
  retailer: string;
  onDone: (competitorProductId: string | null) => void;
  onSkip: () => void;
}

export function ElsewhereCheckoffPrompt({
  open,
  itemName,
  retailer,
  onDone,
  onSkip,
}: ElsewhereCheckoffPromptProps) {
  const t = useTranslations("list");
  const { country } = useCurrentCountry();
  const [price, setPrice] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const product = await findOrCreateCompetitorProduct(
        itemName,
        country ?? "DE"
      );

      const priceNum = parseFloat(price.replace(",", "."));
      if (!isNaN(priceNum) && priceNum > 0) {
        await addCompetitorPrice(product.product_id, retailer, priceNum);
      }

      if (photoFile) {
        const publicUrl = await uploadCompetitorPhoto(product.product_id, photoFile);
        if (publicUrl) {
          await updateCompetitorProduct(product.product_id, {
            thumbnail_url: publicUrl,
          });
        }
      }

      onDone(product.product_id);
    } catch (e) {
      log.error("[ElsewhereCheckoffPrompt] save failed:", e);
      onDone(null);
    } finally {
      setSaving(false);
    }
  }, [itemName, price, photoFile, retailer, country, onDone]);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoFile(file);
  }, []);

  if (!open) return null;

  const hasPriceOrPhoto = price.trim().length > 0 || photoFile !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onSkip} />
      <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300 rounded-t-2xl bg-white px-4 pb-8 pt-5 shadow-xl sm:rounded-2xl">
        <div className="mb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <p className="mt-3 text-center text-sm text-aldi-text">
          {t("checkoffPromptTitle", { name: itemName, retailer })}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex flex-1 items-center rounded-xl border-2 border-aldi-muted-light focus-within:border-aldi-blue">
            <span className="pl-3 text-sm text-aldi-muted">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("checkoffPromptPricePlaceholder")}
              autoFocus
              className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`shrink-0 rounded-xl border-2 px-3 py-2.5 text-sm transition-colors ${
              photoFile
                ? "border-aldi-blue bg-aldi-blue/5 text-aldi-blue"
                : "border-aldi-muted-light text-aldi-muted hover:border-aldi-blue"
            }`}
          >
            {photoFile ? "✓" : "📷"}
          </button>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-xl py-3 text-sm font-medium text-aldi-muted transition-colors hover:text-aldi-text"
          >
            {t("checkoffPromptSkip")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasPriceOrPhoto || saving}
            className="flex-1 rounded-xl bg-aldi-blue py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {saving ? t("competitorProductSaving") : t("checkoffPromptSave")}
          </button>
        </div>
      </div>
    </div>
  );
}
