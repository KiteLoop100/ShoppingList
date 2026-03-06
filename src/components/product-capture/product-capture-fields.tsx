"use client";

import type { DemandGroup } from "@/types";
import type { DemandSubGroupRow } from "@/lib/categories/category-service";
import type { RetailerConfig } from "@/lib/retailers/retailers";
import type { ProductCaptureValues } from "./hooks/use-product-capture-form";
import { ProductCaptureCriteria, type CriteriaLabels } from "./product-capture-criteria";

export interface ProductCaptureFieldLabels {
  name: string;
  brand: string;
  retailer: string;
  category: string;
  subcategory: string;
  noSubcategory: string;
  ean: string;
  articleNumber: string;
  price: string;
  weightQuantity: string;
  assortmentType: string;
  assortmentDailyRange: string;
  assortmentSpecialFood: string;
  assortmentSpecialNonfood: string;
  otherRetailer: string;
  otherRetailerPlaceholder: string;
  criteria: CriteriaLabels;
}

export function ProductCaptureFields({
  values,
  setField,
  retailers,
  demandGroups,
  filteredSubGroups,
  hiddenFields,
  labels,
}: {
  values: ProductCaptureValues;
  setField: <K extends keyof ProductCaptureValues>(key: K, value: ProductCaptureValues[K]) => void;
  retailers: RetailerConfig[];
  demandGroups: DemandGroup[];
  filteredSubGroups: DemandSubGroupRow[];
  hiddenFields?: string[];
  labels: ProductCaptureFieldLabels;
}) {
  const hidden = new Set(hiddenFields ?? []);
  const showCustomRetailer = values.retailer === "__custom__";

  return (
    <>
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.name} *</label>
        <input
          type="text" value={values.name} onChange={(e) => setField("name", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      </div>

      {/* Brand */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.brand}</label>
        <input
          type="text" value={values.brand} onChange={(e) => setField("brand", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      </div>

      {/* Retailer + Price row */}
      {!hidden.has("retailer") && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.retailer} *</label>
            <select
              value={values.retailer} onChange={(e) => setField("retailer", e.target.value)}
              className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
            >
              <option value="">--</option>
              {retailers.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
              <option value="__custom__">{labels.otherRetailer}</option>
            </select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.price}</label>
            <div className="flex items-center rounded-xl border-2 border-aldi-muted-light focus-within:border-aldi-blue">
              <span className="pl-3 text-sm text-aldi-muted">&euro;</span>
              <input
                type="text" inputMode="decimal" value={values.price}
                onChange={(e) => setField("price", e.target.value)} placeholder="0,00"
                className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom retailer */}
      {!hidden.has("retailer") && showCustomRetailer && (
        <input
          type="text" value={values.customRetailer}
          onChange={(e) => setField("customRetailer", e.target.value)}
          placeholder={labels.otherRetailerPlaceholder}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      )}

      {/* Price (when retailer is hidden, show price standalone) */}
      {hidden.has("retailer") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.price}</label>
          <div className="flex items-center rounded-xl border-2 border-aldi-muted-light focus-within:border-aldi-blue">
            <span className="pl-3 text-sm text-aldi-muted">&euro;</span>
            <input
              type="text" inputMode="decimal" value={values.price}
              onChange={(e) => setField("price", e.target.value)} placeholder="0,00"
              className="w-full bg-transparent px-2 py-2.5 text-sm focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.category}</label>
        <select
          value={values.demandGroupCode} onChange={(e) => setField("demandGroupCode", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        >
          <option value="">--</option>
          {demandGroups.map((dg) => (
            <option key={dg.code} value={dg.code}>{dg.name}</option>
          ))}
        </select>
      </div>

      {/* Subcategory */}
      {filteredSubGroups.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.subcategory}</label>
          <select
            value={values.demandSubGroup} onChange={(e) => setField("demandSubGroup", e.target.value)}
            className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
          >
            <option value="">{labels.noSubcategory}</option>
            {filteredSubGroups.map((sg) => (
              <option key={sg.code} value={sg.code}>{sg.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* EAN */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.ean}</label>
        <input
          type="text" value={values.ean} onChange={(e) => setField("ean", e.target.value)}
          placeholder="4001234567890"
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      </div>

      {/* Article number */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.articleNumber}</label>
        <input
          type="text" value={values.articleNumber} onChange={(e) => setField("articleNumber", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      </div>

      {/* Weight / Quantity */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.weightQuantity}</label>
        <input
          type="text" value={values.weightOrQuantity} onChange={(e) => setField("weightOrQuantity", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        />
      </div>

      {/* Assortment Type */}
      <div>
        <label className="mb-1 block text-xs font-medium text-aldi-muted">{labels.assortmentType}</label>
        <select
          value={values.assortmentType} onChange={(e) => setField("assortmentType", e.target.value)}
          className="w-full rounded-xl border-2 border-aldi-muted-light px-3 py-2.5 text-sm focus:border-aldi-blue focus:outline-none"
        >
          <option value="daily_range">{labels.assortmentDailyRange}</option>
          <option value="special_food">{labels.assortmentSpecialFood}</option>
          <option value="special_nonfood">{labels.assortmentSpecialNonfood}</option>
        </select>
      </div>

      {/* Criteria (dietary flags) */}
      <ProductCaptureCriteria
        values={{
          isBio: values.isBio, isVegan: values.isVegan,
          isGlutenFree: values.isGlutenFree, isLactoseFree: values.isLactoseFree,
          animalWelfareLevel: values.animalWelfareLevel,
        }}
        onChange={(cv) => {
          setField("isBio", cv.isBio);
          setField("isVegan", cv.isVegan);
          setField("isGlutenFree", cv.isGlutenFree);
          setField("isLactoseFree", cv.isLactoseFree);
          setField("animalWelfareLevel", cv.animalWelfareLevel);
        }}
        labels={labels.criteria}
      />
    </>
  );
}
