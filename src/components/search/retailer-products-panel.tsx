"use client";

import { memo } from "react";
import type { RetailerProductResult } from "@/lib/competitor-products/competitor-product-service";
import type { RetailerConfig } from "@/lib/retailers/retailers";

export interface RetailerProductsPanelProps {
  loading: boolean;
  retailer: RetailerConfig;
  products: RetailerProductResult[];
  productQuery: string;
  onSelect: (product: RetailerProductResult) => void;
  onAddGeneric: () => void;
  searchingLabel: string;
  noProductsLabel: string;
  myPurchasesLabel: string;
  otherProductsLabel: string;
}

export const RetailerProductsPanel = memo(function RetailerProductsPanel({
  loading,
  retailer,
  products,
  productQuery,
  onSelect,
  onAddGeneric,
  searchingLabel,
  noProductsLabel,
  myPurchasesLabel,
  otherProductsLabel,
}: RetailerProductsPanelProps) {
  const myPurchases = products.filter((p) => p.user_purchase_count > 0);
  const otherProducts = products.filter((p) => p.user_purchase_count === 0);

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col overflow-auto bg-white"
      role="listbox"
    >
      {/* Header with retailer badge */}
      <div className="flex items-center gap-2 border-b border-aldi-muted-light px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${retailer.color}`}
        >
          {retailer.name}
        </span>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-aldi-muted">
          {searchingLabel}
        </div>
      ) : (
        <>
          {/* Generic add action (always visible when there is a product query) */}
          {productQuery && (
            <button
              type="button"
              className="flex min-h-touch w-full items-center gap-3 border-b border-aldi-muted-light px-4 py-3 text-left text-[15px] text-aldi-blue transition-colors hover:bg-aldi-blue/5"
              onClick={onAddGeneric}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aldi-blue text-white text-sm font-bold">
                +
              </span>
              <span className="flex-1 truncate font-medium">
                &ldquo;{productQuery}&rdquo;
              </span>
            </button>
          )}

          {products.length === 0 ? (
            <div className="p-4 text-center text-sm text-aldi-muted">
              {noProductsLabel}
            </div>
          ) : (
            <>
              {myPurchases.length > 0 && (
                <ProductSection
                  label={myPurchasesLabel}
                  items={myPurchases}
                  onSelect={onSelect}
                  retailer={retailer}
                />
              )}
              {otherProducts.length > 0 && (
                <ProductSection
                  label={myPurchases.length > 0 ? otherProductsLabel : undefined}
                  items={otherProducts}
                  onSelect={onSelect}
                  retailer={retailer}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
});

function ProductSection({
  label,
  items,
  onSelect,
  retailer,
}: {
  label?: string;
  items: RetailerProductResult[];
  onSelect: (product: RetailerProductResult) => void;
  retailer: RetailerConfig;
}) {
  return (
    <div>
      {label && (
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-aldi-muted">
            {label}
          </span>
        </div>
      )}
      <ul className="py-1">
        {items.map((p) => (
          <li key={p.product_id} role="option" aria-selected="false">
            <button
              type="button"
              className="flex min-h-touch w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-aldi-text transition-colors hover:bg-aldi-muted-light/40 focus:bg-aldi-muted-light/40 focus:outline-none"
              onClick={() => onSelect(p)}
            >
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                <span className="truncate">{p.name}</span>
                {p.brand && (
                  <span className="truncate text-[12px] text-aldi-muted">
                    {p.brand}
                    {p.weight_or_quantity ? ` · ${p.weight_or_quantity}` : ""}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.latest_price != null && (
                  <span className="text-sm font-medium tabular-nums text-aldi-muted">
                    {p.latest_price.toFixed(2)}&thinsp;€
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${retailer.color}`}
                >
                  {retailer.name}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
