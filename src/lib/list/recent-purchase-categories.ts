/**
 * Category grouping for the "Letzte Einkäufe" view.
 *
 * Products are sorted into four tiers:
 *  1. Obst & Gemüse    (perishable produce)
 *  2. Kühlartikel       (refrigerated fresh goods)
 *  3. Tiefkühlartikel   (frozen goods)
 *  4. Trockensortiment  (everything else)
 *
 * Within each tier the original ordering (frequency DESC) is preserved.
 */

export type CategoryGroupKey = "produce" | "chilled" | "frozen" | "dry";

const PRODUCE_CODES = new Set(["38", "58", "88"]);

const CHILLED_CODES = new Set([
  "51", // Joghurts/Quark
  "55", // Eier
  "56", // Bake-Off (in-store bakery, perishable)
  "60", // Margarine/pflanzliche Fette
  "62", // Frischfleisch
  "64", // Fisch, frisch
  "67", // Geflügel, frisch
  "68", // Schweinefleisch, frisch
  "69", // Gekühlte Wurstwaren
  "70", // Gekühltes verzehrfertiges Fleisch
  "71", // Gekühlter verzehrfertiger Fisch
  "72", // Gekühlte Fertiggerichte
  "73", // Gekühlte Feinkost
  "74", // Gekühlte Getränke
  "83", // Milch/Sahne/Butter
  "84", // Käse
]);

const FROZEN_CODES = new Set([
  "75", // TK Fleisch/Fisch
  "76", // TK Obst/Gemüse
  "77", // TK Desserts/Backwaren/Eis
  "78", // TK Fertiggerichte/Pizzas
]);

export function getCategoryGroup(
  demandGroupCode: string | undefined | null,
  isFrozen?: boolean,
): CategoryGroupKey {
  if (isFrozen) return "frozen";
  if (!demandGroupCode) return "dry";
  if (PRODUCE_CODES.has(demandGroupCode)) return "produce";
  if (CHILLED_CODES.has(demandGroupCode)) return "chilled";
  if (FROZEN_CODES.has(demandGroupCode)) return "frozen";
  return "dry";
}

export function isNativelyFrozen(demandGroupCode: string | null | undefined): boolean {
  return !!demandGroupCode && FROZEN_CODES.has(demandGroupCode);
}

const GROUP_ORDER: Record<CategoryGroupKey, number> = {
  produce: 0,
  chilled: 1,
  frozen: 2,
  dry: 3,
};

export function sortRecentByCategory<T extends { product_id: string }>(
  items: T[],
  productMap: Map<string, { demand_group_code: string }>,
): T[] {
  return [...items].sort((a, b) => {
    const ga = getCategoryGroup(productMap.get(a.product_id)?.demand_group_code);
    const gb = getCategoryGroup(productMap.get(b.product_id)?.demand_group_code);
    return GROUP_ORDER[ga] - GROUP_ORDER[gb];
  });
}

export interface CategorySection {
  key: CategoryGroupKey;
  startIndex: number;
  count: number;
}

export function computeSections<T extends { product_id: string }>(
  sortedItems: T[],
  productMap: Map<string, { demand_group_code: string }>,
): CategorySection[] {
  const sections: CategorySection[] = [];
  let currentGroup: CategoryGroupKey | null = null;
  let startIndex = 0;

  for (let i = 0; i < sortedItems.length; i++) {
    const code = productMap.get(sortedItems[i].product_id)?.demand_group_code;
    const group = getCategoryGroup(code);
    if (group !== currentGroup) {
      if (currentGroup !== null) {
        sections.push({ key: currentGroup, startIndex, count: i - startIndex });
      }
      currentGroup = group;
      startIndex = i;
    }
  }

  if (currentGroup !== null) {
    sections.push({
      key: currentGroup,
      startIndex,
      count: sortedItems.length - startIndex,
    });
  }

  return sections;
}

export const SECTION_ICONS: Record<CategoryGroupKey, string> = {
  produce: "🥬",
  chilled: "❄️",
  frozen: "🧊",
  dry: "📦",
};
