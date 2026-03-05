"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useProducts } from "@/lib/products-context";
import type { Product } from "@/types";
import { matchProducts } from "@/lib/products/product-matcher";

export interface GenericProductPickerProps {
  genericName: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
  onCreateProduct?: () => void;
}

export function GenericProductPicker({
  genericName,
  onSelect,
  onClose,
  onCreateProduct,
}: GenericProductPickerProps) {
  const t = useTranslations("list");
  const tCapture = useTranslations("productCapture");
  const { products } = useProducts();
  const [search, setSearch] = useState("");

  const needle = (search || genericName).toLowerCase().trim();

  const matches = useMemo(() => matchProducts(products, needle), [products, needle]);

  const handleSelect = useCallback(
    (product: Product) => {
      onSelect(product);
    },
    [onSelect]
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 touch-none bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-[7.5vh] z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-aldi-muted-light p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-aldi-text">
              {t("pickerTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-aldi-muted">
              {t("pickerSubtitle", { name: genericName })}
            </p>
          </div>
          <button
            type="button"
            className="touch-target -m-2 shrink-0 rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
            onClick={onClose}
            aria-label={t("pickerClose")}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b border-aldi-muted-light px-4 py-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pickerSearchPlaceholder")}
            className="w-full rounded-xl border border-aldi-muted-light bg-aldi-bg px-3 py-2 text-sm text-aldi-text outline-none transition-colors focus:border-aldi-blue focus:bg-white focus:ring-1 focus:ring-aldi-blue/20"
            autoFocus
          />
          {onCreateProduct && (
            <button
              type="button"
              onClick={onCreateProduct}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-aldi-blue/40 bg-aldi-blue/5 px-3 py-2 text-sm font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/10"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {tCapture("createProduct")}
            </button>
          )}
        </div>

        {/* Results */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {matches.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-aldi-muted">
              {t("pickerNoResults")}
            </div>
          ) : (
            <ul className="divide-y divide-aldi-muted-light/50">
              {matches.map((product) => (
                <li key={product.product_id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(product)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-aldi-blue-light/30 active:bg-aldi-blue-light/50"
                  >
                    {product.thumbnail_url ? (
                      <Image
                        src={product.thumbnail_url}
                        alt=""
                        role="presentation"
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aldi-muted-light text-aldi-muted">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-aldi-text">
                        {product.name}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-aldi-muted">
                        {product.brand && <span>{product.brand}</span>}
                        {product.weight_or_quantity && (
                          <span>{product.weight_or_quantity}</span>
                        )}
                      </p>
                    </div>
                    {product.price != null && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-aldi-text">
                        {product.price.toFixed(2)} €
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
