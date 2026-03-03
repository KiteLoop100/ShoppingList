/**
 * Translates demand-group names for display.
 *
 * Demand groups use ALDI commodity group codes with a `name` (DE) and
 * `name_en` field in the `demand_groups` table. Translation is done via
 * a runtime map populated from IndexedDB or Supabase.
 *
 * For cases where the runtime map is not available (e.g. static rendering),
 * `formatDemandGroupLabel` strips the numeric prefix from legacy
 * demand_group strings like "83-Milch/Sahne/Butter".
 */

import type { DemandGroup } from "@/types";

// ── Demand-group display aliases ────────────────────────────────────
// Manual overrides for codes whose DB name is truncated or ugly.
const DEMAND_GROUP_ALIASES_DE: Record<string, string> = {
  "70": "Fertigfleisch/-wurst, gekühlt",
  "50": "H-Milch & Milchersatz",
  "82": "Wurst-, Fleisch- & Fischkonserven",
  "80": "Erfrischungsgetränke",
  "62": "Frischfleisch (Rind, Lamm u.a.)",
  "AK": "Aktionsartikel",
};

const DEMAND_GROUP_PREFIX_RE = /^\d+-/;

/**
 * Converts a legacy demand-group string (e.g. "83-Milch/Sahne/Butter")
 * to a user-friendly label by stripping the numeric prefix.
 */
export function formatDemandGroupLabel(codeOrLegacy: string): string {
  if (DEMAND_GROUP_ALIASES_DE[codeOrLegacy]) return DEMAND_GROUP_ALIASES_DE[codeOrLegacy];
  return codeOrLegacy.replace(DEMAND_GROUP_PREFIX_RE, "");
}

/**
 * Translate a demand-group code for display using the runtime map.
 * Falls back to the code itself if no map entry exists.
 */
export function translateDemandGroupName(
  code: string,
  locale: string,
  demandGroupMap?: Map<string, DemandGroup>,
): string {
  if (demandGroupMap) {
    const dg = demandGroupMap.get(code);
    if (dg) {
      if (locale === "en" && dg.name_en) return dg.name_en;
      return DEMAND_GROUP_ALIASES_DE[code] ?? dg.name;
    }
  }
  return DEMAND_GROUP_ALIASES_DE[code] ?? code;
}

/**
 * @deprecated Use translateDemandGroupName.
 * Kept for backward compatibility during frontend migration.
 */
export function translateCategoryName(name: string, locale: string): string {
  if (DEMAND_GROUP_PREFIX_RE.test(name) || name.startsWith("AK-")) {
    return formatDemandGroupLabel(name);
  }
  // Legacy EN category names -- pass through for now
  return name;
}
