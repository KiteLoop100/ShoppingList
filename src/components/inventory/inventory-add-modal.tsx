"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useProducts } from "@/lib/products-context";
import { useCurrentCountry } from "@/lib/current-country-context";
import { useSearchExecution, MIN_QUERY_LENGTH } from "@/components/search/hooks/use-search-execution";
import type { SearchResult } from "@/types";
import type { InventoryUpsertInput } from "@/lib/inventory/inventory-types";

export interface InventoryAddModalProps {
  open: boolean;
  onClose: () => void;
  onProductAdded: (input: InventoryUpsertInput) => void;
}

export function InventoryAddModal({ open, onClose, onProductAdded }: InventoryAddModalProps) {
  const t = useTranslations("inventory");
  const tSearch = useTranslations("search");
  const { products } = useProducts();
  const { country } = useCurrentCountry();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, isSearching, trimmedQuery } = useSearchExecution({ query, products, country });

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSelect = useCallback(
    (r: SearchResult) => {
      const input: InventoryUpsertInput = {
        product_id: r.product_id,
        competitor_product_id: null,
        display_name: r.name,
        demand_group_code: r.demand_group_code,
        thumbnail_url: r.thumbnail_url ?? r.product?.thumbnail_url ?? null,
        quantity: 1,
        source: "manual",
      };
      onProductAdded(input);
    },
    [onProductAdded],
  );

  if (!open) return null;

  const showResults = trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("addProduct")}
    >
      <div className="flex items-center gap-2 border-b border-aldi-muted-light px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
          aria-label={tSearch("close")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="search"
          className="flex-1 rounded-xl border border-aldi-muted-light bg-gray-50 px-4 py-2.5 text-[15px] text-aldi-text outline-none placeholder:text-aldi-muted focus:border-aldi-blue focus:ring-1 focus:ring-aldi-blue"
          placeholder={t("addProduct")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="flex-1 overflow-auto">
        {!showResults && (
          <p className="p-6 text-center text-sm text-aldi-muted">
            {tSearch("searchHint")}
          </p>
        )}

        {showResults && isSearching && (
          <p className="p-4 text-center text-sm text-aldi-muted">{tSearch("searching")}</p>
        )}

        {showResults && !isSearching && results.length === 0 && (
          <p className="p-4 text-center text-sm text-aldi-muted">{tSearch("noResults")}</p>
        )}

        {showResults && results.length > 0 && (
          <ul className="py-1">
            {results.map((r) => {
              const thumbUrl = r.thumbnail_url ?? r.product?.thumbnail_url;
              return (
                <li key={r.product_id}>
                  <button
                    type="button"
                    className="flex min-h-touch w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-aldi-muted-light/40"
                    onClick={() => handleSelect(r)}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                      {thumbUrl ? (
                        <Image src={thumbUrl} alt="" role="presentation" width={40} height={40} className="rounded object-contain" unoptimized />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-aldi-muted-light text-xs text-aldi-muted">?</span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate text-[15px] font-medium text-aldi-text">{r.name}</span>
                      <span className="truncate text-xs text-aldi-muted">{r.demand_group_name}</span>
                    </span>
                    {r.price != null && (
                      <span className="shrink-0 text-sm font-semibold text-aldi-blue">
                        {r.price.toFixed(2)}&nbsp;&euro;
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
