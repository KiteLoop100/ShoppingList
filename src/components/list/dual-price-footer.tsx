"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/utils/format-price";

export interface DualPriceFooterProps {
  listTotal: number;
  listWithoutPriceCount: number;
  listItemCount: number;
  cartTotal: number;
  cartWithoutPriceCount: number;
  cartItemCount: number;
  onScanPress?: () => void;
  /** Whether the cart-price column is shown (scan visible OR checked items exist). */
  showCartColumn?: boolean;
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="16" x2="17" y2="16" />
    </svg>
  );
}

export const DualPriceFooter = memo(function DualPriceFooter({
  listTotal,
  listWithoutPriceCount,
  listItemCount,
  cartTotal,
  cartWithoutPriceCount,
  cartItemCount,
  onScanPress,
  showCartColumn = true,
}: DualPriceFooterProps) {
  const t = useTranslations("list");

  const listPriceFormatted = formatPrice(listTotal);
  const cartPriceFormatted = formatPrice(cartTotal);
  const hasCartItems = cartItemCount > 0;
  const totalWithoutPrice = listWithoutPriceCount + cartWithoutPriceCount;
  const showScan = Boolean(onScanPress);

  return (
    <footer
      className="sticky bottom-0 z-10 border-t border-aldi-muted-light bg-white/95 backdrop-blur-sm px-4 py-3"
      role="region"
      aria-label={`${t("footerListLabel")}: ${listPriceFormatted}${showCartColumn ? `, ${t("footerCartLabel")}: ${hasCartItems ? cartPriceFormatted : t("footerCartEmpty")}` : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aldi-blue/10 text-aldi-blue">
            <ListIcon />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight text-aldi-text">
              {t("footerListPrice", { price: listPriceFormatted })}
            </p>
            <p className="mt-0.5 text-xs text-aldi-muted">
              {t("footerItemCount", { count: listItemCount })}
            </p>
          </div>
        </div>

        {showCartColumn && (
          <>
            <div className="mt-1 h-8 w-px shrink-0 bg-aldi-muted-light animate-scan-fade-in" />

            <div className="flex min-w-0 flex-1 items-start gap-2.5 animate-scan-fade-in">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F37D1E]/10 text-[#F37D1E]">
                <CartIcon />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold leading-tight text-aldi-text">
                  {hasCartItems
                    ? t("footerCartPrice", { price: cartPriceFormatted })
                    : t("footerCartEmpty")}
                </p>
                <p className="mt-0.5 text-xs text-aldi-muted">
                  {t("footerItemCount", { count: cartItemCount })}
                </p>
              </div>
            </div>
          </>
        )}

        {showScan && (
          <>
            <div className="mt-1 h-8 w-px shrink-0 bg-aldi-muted-light animate-scan-fade-in" />
            <button
              type="button"
              onClick={onScanPress}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F37D1E] text-white shadow-sm transition-all active:scale-95 hover:bg-[#E06D0E] animate-scan-fade-in"
              aria-label={t("scanBarcode")}
            >
              <ScanIcon />
            </button>
          </>
        )}
      </div>

      {totalWithoutPrice > 0 && (
        <p className="mt-1.5 text-center text-xs text-aldi-muted">
          {t("footerWithoutPrice", { count: totalWithoutPrice })}
        </p>
      )}
    </footer>
  );
});
