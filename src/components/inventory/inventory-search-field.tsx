"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { Product, CompetitorProduct } from "@/types";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import { pickInventoryItemForBarcode } from "@/lib/inventory/inventory-search";

const BarcodeScannerModal = dynamic(
  () => import("@/components/search/barcode-scanner-modal").then((m) => m.BarcodeScannerModal),
  { ssr: false },
);

export interface InventorySearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  items: InventoryItem[];
  placeholder: string;
  onBarcodeMatchedItem: (itemId: string) => void;
  showToast: (message: string) => void;
}

export function InventorySearchField({
  value,
  onChange,
  items,
  placeholder,
  onBarcodeMatchedItem,
  showToast,
}: InventorySearchFieldProps) {
  const tInv = useTranslations("inventory");
  const tSearch = useTranslations("search");
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleAldiProduct = useCallback(
    (product: Product) => {
      const item = pickInventoryItemForBarcode(items, product.product_id, null);
      if (!item) {
        showToast(tInv("notInInventory"));
        return;
      }
      onChange("");
      onBarcodeMatchedItem(item.id);
    },
    [items, onChange, onBarcodeMatchedItem, showToast, tInv],
  );

  const handleCompetitorProduct = useCallback(
    (product: CompetitorProduct, _ean: string) => {
      const item = pickInventoryItemForBarcode(items, null, product.product_id);
      if (!item) {
        showToast(tInv("notInInventory"));
        return;
      }
      onChange("");
      onBarcodeMatchedItem(item.id);
    },
    [items, onChange, onBarcodeMatchedItem, showToast, tInv],
  );

  const handleNotFound = useCallback(
    (_ean: string) => {
      showToast(tSearch("barcodeNotFound"));
    },
    [showToast, tSearch],
  );

  return (
    <>
      <div className="relative">
        <input
          type="search"
          className="w-full rounded-xl border border-aldi-muted-light bg-gray-50 py-2 pl-3 pr-11 text-sm text-aldi-text outline-none placeholder:text-aldi-muted focus:border-aldi-blue focus:ring-1 focus:ring-aldi-blue"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          aria-label={tSearch("barcodeScanner")}
          className="touch-target absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-aldi-muted transition-colors hover:bg-gray-200/80 hover:text-aldi-blue"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onProductAdded={handleAldiProduct}
        onProductNotFound={handleNotFound}
        onCompetitorProductFound={handleCompetitorProduct}
      />
    </>
  );
}
