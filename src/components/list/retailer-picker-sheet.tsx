"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useCurrentCountry } from "@/lib/current-country-context";
import { getRetailersForCountry, type RetailerConfig } from "@/lib/retailers/retailers";

interface RetailerPickerSheetProps {
  open: boolean;
  itemName: string;
  suggestedRetailer?: string | null;
  onSelect: (retailerName: string) => void;
  onClose: () => void;
}

export function RetailerPickerSheet({ open, itemName, suggestedRetailer, onSelect, onClose }: RetailerPickerSheetProps) {
  const t = useTranslations("list");
  const { country } = useCurrentCountry();
  const retailers = getRetailersForCountry(country ?? "DE");
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowCustom(false);
      setCustomName("");
    }
  }, [open]);

  useEffect(() => {
    if (showCustom) {
      inputRef.current?.focus();
    }
  }, [showCustom]);

  const handleSelect = useCallback((name: string) => {
    onSelect(name);
    onClose();
  }, [onSelect, onClose]);

  const handleCustomSubmit = useCallback(() => {
    const trimmed = customName.trim();
    if (trimmed) {
      handleSelect(trimmed);
    }
  }, [customName, handleSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg animate-in slide-in-from-bottom duration-300 rounded-t-2xl bg-white px-4 pb-8 pt-6 shadow-xl sm:rounded-2xl">
        <div className="mb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        <h3 className="mt-3 text-center text-lg font-semibold text-aldi-text">
          {t("retailerPickerTitle")}
        </h3>
        <p className="mb-5 text-center text-sm text-aldi-muted">
          {t("retailerPickerSubtitle", { name: itemName })}
        </p>

        {!showCustom ? (
          <>
            {suggestedRetailer && (
              <button
                type="button"
                onClick={() => handleSelect(suggestedRetailer)}
                className="mb-3 w-full rounded-xl border-2 border-aldi-blue bg-blue-50/50 px-3 py-3 text-sm font-medium text-aldi-blue transition-transform active:scale-[0.98]"
              >
                {t("retailerSuggestion", { retailer: suggestedRetailer })}
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {retailers.map((r: RetailerConfig) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r.name)}
                  className="rounded-xl border border-aldi-muted-light bg-white px-3 py-3 text-sm font-medium text-aldi-text transition-transform active:scale-95 active:bg-gray-50"
                >
                  {r.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="mt-3 w-full rounded-xl border border-dashed border-gray-300 px-3 py-3 text-sm text-aldi-muted transition-colors hover:border-gray-400 hover:text-aldi-text"
            >
              {t("otherRetailer")}
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); }}
              placeholder={t("otherRetailerPlaceholder")}
              className="min-h-touch flex-1 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-sm text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customName.trim()}
              className="rounded-xl bg-aldi-blue px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-40"
            >
              OK
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl py-3 text-sm font-medium text-aldi-muted transition-colors hover:text-aldi-text"
        >
          {t("pickerClose")}
        </button>
      </div>
    </div>
  );
}
