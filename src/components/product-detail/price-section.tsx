"use client";

import type { CompetitorProductPrice } from "@/types";
import { SectionLabel } from "./section-label";

interface AldiPriceSectionProps {
  kind: "aldi";
  price: number | null;
  weightOrQuantity?: string | null;
  labels: { price: string; weightQuantity: string };
}

interface CompetitorPriceSectionProps {
  kind: "competitor";
  prices: CompetitorProductPrice[];
  locale: string;
  labels: { latestPrice: string; noPrices: string };
}

export type PriceSectionProps = AldiPriceSectionProps | CompetitorPriceSectionProps;

export function PriceSection(props: PriceSectionProps) {
  if (props.kind === "aldi") {
    return <AldiPriceSection {...props} />;
  }
  return <CompetitorPriceSection {...props} />;
}

function AldiPriceSection({ price, weightOrQuantity, labels }: AldiPriceSectionProps) {
  const hasPrice = price != null;
  const hasWeight = weightOrQuantity != null && weightOrQuantity !== "";

  if (!hasPrice && !hasWeight) return null;

  return (
    <dl className="space-y-2 border-t border-aldi-muted-light pt-3">
      {hasPrice && (
        <div>
          <SectionLabel>{labels.price}</SectionLabel>
          <dd className="mt-0.5 text-aldi-text">€{price!.toFixed(2)}</dd>
        </div>
      )}
      {hasWeight && (
        <div>
          <SectionLabel>{labels.weightQuantity}</SectionLabel>
          <dd className="mt-0.5 text-aldi-text">{weightOrQuantity}</dd>
        </div>
      )}
    </dl>
  );
}

function CompetitorPriceSection({ prices, locale, labels }: CompetitorPriceSectionProps) {
  if (prices.length > 0) {
    return (
      <dl className="space-y-2 border-t border-aldi-muted-light pt-3">
        {prices.map((p) => (
          <div key={p.price_id}>
            <SectionLabel>{labels.latestPrice} – {p.retailer}</SectionLabel>
            <dd className="mt-0.5 text-aldi-text">
              €{p.price.toFixed(2)}
              <span className="ml-2 text-xs text-aldi-muted">
                {new Date(p.observed_at).toLocaleDateString(
                  locale === "de" ? "de-DE" : "en-US",
                  { day: "2-digit", month: "2-digit", year: "2-digit" },
                )}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <p className="border-t border-aldi-muted-light pt-3 text-sm text-aldi-muted">
      {labels.noPrices}
    </p>
  );
}
