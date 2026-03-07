"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { KNOWN_RETAILERS } from "@/lib/store/known-retailers";
import { createStore, reverseGeocode } from "@/lib/store/store-service";
import type { LocalStore } from "@/lib/db";
import type { GeoPosition } from "@/lib/store/store-service";

interface CreateStoreDialogProps {
  position?: GeoPosition | null;
  onCreated: (store: LocalStore) => void;
  onSkip: () => void;
}

export function CreateStoreDialog({ position, onCreated, onSkip }: CreateStoreDialogProps) {
  const t = useTranslations("createStore");
  const tCommon = useTranslations("common");

  const [selectedRetailer, setSelectedRetailer] = useState("");
  const [customRetailer, setCustomRetailer] = useState("");
  const [storeName, setStoreName] = useState("");
  const [detectedAddress, setDetectedAddress] = useState("");
  const [creating, setCreating] = useState(false);

  const isOther = selectedRetailer === "__other__";
  const effectiveRetailer = isOther ? customRetailer.trim() : selectedRetailer;
  const canSubmit = effectiveRetailer.length > 0 && !creating;

  useEffect(() => {
    if (!position) return;
    let cancelled = false;
    reverseGeocode(position.latitude, position.longitude).then((geo) => {
      if (!cancelled && geo) {
        const parts = [geo.address, geo.postalCode, geo.city].filter(Boolean);
        setDetectedAddress(parts.join(", "));
      }
    });
    return () => { cancelled = true; };
  }, [position]);

  const handleCreate = useCallback(async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const store = await createStore({
        retailer: effectiveRetailer,
        name: storeName.trim() || undefined,
        latitude: position?.latitude,
        longitude: position?.longitude,
      });
      onCreated(store);
    } catch {
      setCreating(false);
    }
  }, [canSubmit, effectiveRetailer, storeName, position, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <h2 className="mb-1 text-lg font-bold text-aldi-blue">{t("title")}</h2>
        <p className="mb-4 text-sm text-aldi-muted">{t("prompt")}</p>

        {/* Retailer selection */}
        <label className="mb-1 block text-sm font-semibold text-aldi-text">
          {t("retailerLabel")}
        </label>
        <select
          value={selectedRetailer}
          onChange={(e) => setSelectedRetailer(e.target.value)}
          className="mb-3 min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text focus:border-aldi-blue focus:outline-none"
        >
          <option value="" disabled>{t("retailerPlaceholder")}</option>
          {KNOWN_RETAILERS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value="__other__">{t("otherRetailer")}</option>
        </select>

        {isOther && (
          <input
            type="text"
            value={customRetailer}
            onChange={(e) => setCustomRetailer(e.target.value)}
            placeholder={t("customRetailerPlaceholder")}
            className="mb-3 min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
            autoFocus
          />
        )}

        {/* Store name (optional) */}
        <label className="mb-1 block text-sm font-semibold text-aldi-text">
          {t("storeNameLabel")}
        </label>
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder={t("storeNamePlaceholder")}
          className="mb-3 min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
        />

        {/* Detected address (read-only) */}
        {detectedAddress && (
          <div className="mb-4 rounded-xl border border-aldi-muted-light bg-gray-50 px-4 py-2">
            <p className="text-xs font-semibold text-aldi-muted">{t("addressLabel")}</p>
            <p className="text-sm text-aldi-text">{detectedAddress}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-touch flex-1 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-sm font-semibold text-aldi-muted transition-colors hover:bg-gray-50"
          >
            {t("skip")}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? t("creating") : t("create")}
          </button>
        </div>
      </div>
    </div>
  );
}
