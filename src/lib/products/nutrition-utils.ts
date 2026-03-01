export function formatNutritionInfo(info: Record<string, unknown>): string {
  const parts: string[] = [];
  const per100 = (info["per_100g"] ?? info["per 100g"]) as Record<string, unknown> | undefined;
  if (per100 && typeof per100 === "object") {
    const keys = ["energy-kcal", "energy_kcal", "fat", "carbohydrates", "sugars", "protein", "salt", "fiber"];
    for (const k of keys) {
      const v = per100[k];
      if (v != null && v !== "") parts.push(`${k}: ${String(v)}`);
    }
  }
  if (parts.length === 0) return JSON.stringify(info);
  return parts.join(" · ");
}
