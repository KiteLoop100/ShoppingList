"use client";

import { SectionLabel } from "./section-label";
import type { AnyProduct } from "./types";
import { isAldiProduct } from "./types";
import { formatNutritionInfo } from "@/lib/products/nutrition-utils";

interface NutritionSectionProps {
  product: AnyProduct;
  labels: {
    nutritionInfo: string;
    ingredients: string;
    allergens: string;
    nutriScore?: string;
  };
}

export function NutritionSection({ product, labels }: NutritionSectionProps) {
  const hasIngredients = product.ingredients != null && product.ingredients !== "";
  const hasAllergens = product.allergens != null && product.allergens !== "";

  if (isAldiProduct(product)) {
    return <AldiNutritionContent product={product} labels={labels} hasIngredients={hasIngredients} hasAllergens={hasAllergens} />;
  }

  return <CompetitorNutritionContent product={product} labels={labels} hasIngredients={hasIngredients} hasAllergens={hasAllergens} />;
}

function AldiNutritionContent({
  product,
  labels,
  hasIngredients,
  hasAllergens,
}: {
  product: AnyProduct;
  labels: NutritionSectionProps["labels"];
  hasIngredients: boolean;
  hasAllergens: boolean;
}) {
  const hasNutrition = product.nutrition_info != null
    && typeof product.nutrition_info === "object"
    && Object.keys(product.nutrition_info).length > 0;

  if (!hasNutrition && !hasIngredients && !hasAllergens) return null;

  return (
    <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
      {hasNutrition && (
        <div>
          <SectionLabel>{labels.nutritionInfo}</SectionLabel>
          <dd className="mt-0.5 text-sm text-aldi-text">
            {formatNutritionInfo(product.nutrition_info as Record<string, unknown>)}
          </dd>
        </div>
      )}
      {hasIngredients && (
        <div>
          <SectionLabel>{labels.ingredients}</SectionLabel>
          <dd className="mt-0.5 text-sm text-aldi-text">{product.ingredients}</dd>
        </div>
      )}
      {hasAllergens && (
        <div>
          <SectionLabel>{labels.allergens}</SectionLabel>
          <dd className="mt-0.5 text-sm text-aldi-text">{product.allergens}</dd>
        </div>
      )}
    </dl>
  );
}

function CompetitorNutritionContent({
  product,
  labels,
  hasIngredients,
  hasAllergens,
}: {
  product: AnyProduct;
  labels: NutritionSectionProps["labels"];
  hasIngredients: boolean;
  hasAllergens: boolean;
}) {
  const nutrition = product.nutrition_info as Record<string, number | null> | null;
  const hasNutrition = nutrition && Object.values(nutrition).some((v) => v != null);
  const nutriScore = "nutri_score" in product ? (product as { nutri_score: string | null }).nutri_score : null;

  return (
    <>
      {nutriScore && labels.nutriScore && (
        <dl className="mt-4 border-t border-aldi-muted-light pt-3">
          <SectionLabel>{labels.nutriScore}</SectionLabel>
          <dd className="mt-1"><NutriScoreBadge score={nutriScore} /></dd>
        </dl>
      )}
      {hasNutrition && nutrition && (
        <NutritionTable nutrition={nutrition} label={labels.nutritionInfo} />
      )}
      {hasIngredients && (
        <dl className="mt-4 border-t border-aldi-muted-light pt-3">
          <SectionLabel>{labels.ingredients}</SectionLabel>
          <dd className="mt-1 text-sm leading-relaxed text-aldi-text">{product.ingredients}</dd>
        </dl>
      )}
      {hasAllergens && (
        <dl className="mt-4 border-t border-aldi-muted-light pt-3">
          <SectionLabel>{labels.allergens}</SectionLabel>
          <dd className="mt-1 text-sm font-medium text-amber-700">{product.allergens}</dd>
        </dl>
      )}
    </>
  );
}

const NUTRITION_KEYS: Array<{ key: string; labelKey: string; indent?: boolean }> = [
  { key: "energy_kcal", labelKey: "energy" },
  { key: "fat", labelKey: "fat" },
  { key: "saturated_fat", labelKey: "saturatedFat", indent: true },
  { key: "carbs", labelKey: "carbs" },
  { key: "sugar", labelKey: "sugar", indent: true },
  { key: "fiber", labelKey: "fiber" },
  { key: "protein", labelKey: "protein" },
  { key: "salt", labelKey: "salt" },
];

function NutritionTable({ nutrition, label }: { nutrition: Record<string, number | null>; label: string }) {
  return (
    <dl className="mt-4 border-t border-aldi-muted-light pt-3">
      <SectionLabel>{label}</SectionLabel>
      <dd className="mt-1">
        <table className="w-full text-sm">
          <tbody>
            {NUTRITION_KEYS.map(({ key, labelKey, indent }) => {
              const val = nutrition[key];
              if (val == null) return null;
              const unit = key === "energy_kcal" ? "kcal" : "g";
              return (
                <tr key={key} className="border-b border-aldi-muted-light/50 last:border-0">
                  <td className={`py-1 text-aldi-muted ${indent ? "pl-3" : ""}`}>{labelKey}</td>
                  <td className="py-1 text-right text-aldi-text">{val} {unit}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </dd>
    </dl>
  );
}

function NutriScoreBadge({ score }: { score: string }) {
  const colors: Record<string, string> = {
    A: "bg-green-600",
    B: "bg-green-400",
    C: "bg-yellow-400 text-yellow-900",
    D: "bg-orange-400",
    E: "bg-red-500",
  };
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white ${colors[score] ?? "bg-gray-400"}`}>
      {score}
    </span>
  );
}
