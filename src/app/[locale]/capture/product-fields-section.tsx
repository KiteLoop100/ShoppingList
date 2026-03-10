"use client";

import { formatDemandGroupLabel } from "@/lib/i18n/category-translations";
import type { ProductFormFields } from "./use-product-creation";

interface DgOption { code: string; name: string }
interface SgOption { code: string; name: string; demand_group_code: string }

interface ProductFieldsSectionProps {
  t: (key: string) => string;
  tReview: (key: string) => string;
  fields: ProductFormFields;
  demandGroupOptions: DgOption[];
  subGroupOptions: SgOption[];
  setters: {
    setName: (v: string) => void;
    setBrand: (v: string) => void;
    setPrice: (v: string) => void;
    setEan: (v: string) => void;
    setArticleNumber: (v: string) => void;
    setWeightOrQuantity: (v: string) => void;
    setDemandGroup: (v: string) => void;
    setDemandSubGroup: (v: string) => void;
    setIngredients: (v: string) => void;
    setAllergens: (v: string) => void;
    setAssortmentType: (v: "daily_range" | "special_food" | "special_nonfood") => void;
  };
}

const INPUT_CLASS =
  "rounded-xl border border-aldi-muted-light bg-aldi-bg px-3.5 py-2.5 text-[15px] text-aldi-text transition-colors focus:border-aldi-blue focus:bg-white focus:outline-none focus:ring-1 focus:ring-aldi-blue/20";

export function ProductFieldsSection({ t, tReview, fields, demandGroupOptions, subGroupOptions, setters }: ProductFieldsSectionProps) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <section className="grid gap-3.5">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("name")}</span>
          <input type="text" value={fields.name} onChange={(e) => setters.setName(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("brand")}</span>
          <input type="text" value={fields.brand} onChange={(e) => setters.setBrand(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("price")}</span>
          <input type="text" inputMode="decimal" value={fields.price} onChange={(e) => setters.setPrice(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("ean")}</span>
          <input type="text" value={fields.ean} onChange={(e) => setters.setEan(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("articleNumber")}</span>
          <input type="text" value={fields.articleNumber} onChange={(e) => setters.setArticleNumber(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{tReview("weightOrQuantity")}</span>
          <input type="text" value={fields.weightOrQuantity} onChange={(e) => setters.setWeightOrQuantity(e.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("demandGroup")}</span>
          <select value={fields.demandGroup} onChange={(e) => setters.setDemandGroup(e.target.value)} className={INPUT_CLASS}>
            <option value="">—</option>
            {demandGroupOptions.map((g) => (
              <option key={g.code} value={g.code}>
                {formatDemandGroupLabel(g.code)} — {g.name}
              </option>
            ))}
          </select>
        </label>
        {subGroupOptions.length > 0 && (
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("demandSubGroup")}</span>
            <select value={fields.demandSubGroup} onChange={(e) => setters.setDemandSubGroup(e.target.value)} className={INPUT_CLASS}>
              <option value="">—</option>
              {subGroupOptions.map((sg) => (
                <option key={sg.code} value={sg.code}>
                  {sg.code} — {sg.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-aldi-muted">{t("assortmentType")}</span>
          <select
            value={fields.assortmentType}
            onChange={(e) => setters.setAssortmentType(e.target.value as "daily_range" | "special_food" | "special_nonfood")}
            className={INPUT_CLASS}
          >
            <option value="daily_range">{t("assortmentDailyRange")}</option>
            <option value="special_food">{t("assortmentSpecialFood")}</option>
            <option value="special_nonfood">{t("assortmentSpecialNonfood")}</option>
          </select>
        </label>
      </section>
    </div>
  );
}
