"use client";

import type { ExtractedCompetitorProductInfo } from "@/lib/product-photo-studio/types";

export function ExtractedInfoCards({
  details,
}: {
  details: ExtractedCompetitorProductInfo;
}) {
  const hasNutrition = details.nutrition_info && Object.values(details.nutrition_info).some((v) => v != null);
  if (!details.ingredients && !hasNutrition && !details.allergens && !details.nutri_score) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-aldi-muted-light bg-gray-50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-aldi-muted">Extrahierte Details</p>

      {details.nutri_score && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-aldi-muted">Nutri-Score</span>
          <NutriScoreBadge score={details.nutri_score} />
        </div>
      )}

      {details.ingredients && (
        <div>
          <span className="text-[10px] font-medium uppercase text-aldi-muted">Zutaten</span>
          <p className="mt-0.5 text-xs text-aldi-text leading-relaxed">{details.ingredients}</p>
        </div>
      )}

      {details.allergens && (
        <div>
          <span className="text-[10px] font-medium uppercase text-aldi-muted">Allergene</span>
          <p className="mt-0.5 text-xs font-medium text-amber-700">{details.allergens}</p>
        </div>
      )}

      {hasNutrition && details.nutrition_info && (
        <div>
          <span className="text-[10px] font-medium uppercase text-aldi-muted">Nährwerte pro 100g</span>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
            {details.nutrition_info.energy_kcal != null && <NutritionRow label="Energie" value={`${details.nutrition_info.energy_kcal} kcal`} />}
            {details.nutrition_info.fat != null && <NutritionRow label="Fett" value={`${details.nutrition_info.fat} g`} />}
            {details.nutrition_info.carbs != null && <NutritionRow label="Kohlenhydrate" value={`${details.nutrition_info.carbs} g`} />}
            {details.nutrition_info.protein != null && <NutritionRow label="Eiweiß" value={`${details.nutrition_info.protein} g`} />}
            {details.nutrition_info.salt != null && <NutritionRow label="Salz" value={`${details.nutrition_info.salt} g`} />}
          </div>
        </div>
      )}
    </div>
  );
}

function NutritionRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-aldi-muted">{label}</span>
      <span className="text-right text-aldi-text">{value}</span>
    </>
  );
}

export function NutriScoreBadge({ score }: { score: string }) {
  const colors: Record<string, string> = {
    A: "bg-green-600",
    B: "bg-green-400",
    C: "bg-yellow-400 text-yellow-900",
    D: "bg-orange-400",
    E: "bg-red-500",
  };
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${colors[score] ?? "bg-gray-400"}`}>
      {score}
    </span>
  );
}
