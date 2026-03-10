/**
 * Demand-group helpers — loads demand groups + sub-groups from Supabase at runtime.
 * Used by API routes for AI-based classification.
 *
 * Source of truth: `demand_groups` (~61 rows) + `demand_sub_groups` (~380 rows).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DemandGroupEntry {
  code: string;
  name: string;
  name_en: string | null;
}

export interface DemandSubGroupEntry {
  code: string;
  name: string;
  name_en: string | null;
  demand_group_code: string;
}

let _cached: DemandGroupEntry[] | null = null;
let _subCached: DemandSubGroupEntry[] | null = null;

/**
 * Load demand groups from Supabase. Cached in-memory for the lifetime of
 * the serverless function (demand groups rarely change).
 */
export async function loadDemandGroups(
  supabase: SupabaseClient,
): Promise<DemandGroupEntry[]> {
  if (_cached) return _cached;
  const { data, error } = await supabase
    .from("demand_groups")
    .select("code, name, name_en")
    .order("sort_position");
  if (error) throw new Error(`Failed to load demand_groups: ${error.message}`);
  _cached = (data ?? []).map(
    (dg: { code: string; name: string; name_en: string | null }) => ({
      code: dg.code,
      name: dg.name,
      name_en: dg.name_en,
    }),
  );
  return _cached;
}

/**
 * Load demand sub-groups from Supabase. Cached in-memory like groups.
 */
export async function loadDemandSubGroups(
  supabase: SupabaseClient,
): Promise<DemandSubGroupEntry[]> {
  if (_subCached) return _subCached;
  const { data, error } = await supabase
    .from("demand_sub_groups")
    .select("code, name, name_en, demand_group_code")
    .order("sort_position");
  if (error) throw new Error(`Failed to load demand_sub_groups: ${error.message}`);
  _subCached = (data ?? []).map(
    (sg: { code: string; name: string; name_en: string | null; demand_group_code: string }) => ({
      code: sg.code,
      name: sg.name,
      name_en: sg.name_en,
      demand_group_code: sg.demand_group_code,
    }),
  );
  return _subCached;
}

/**
 * Build a prompt block listing all demand groups with their sub-groups
 * in the DB code format for AI classification.
 *
 * Example output line:
 *   Demand Group 83 (Milch/Sahne/Butter):
 *     Sub-Groups: 83-01 Milchgetränke, 83-02 Milch, 83-03 Sahne, 83-04 Butter/tierische Fette
 */
export function buildDemandGroupsAndSubGroupsPrompt(
  groups: DemandGroupEntry[],
  subGroups: DemandSubGroupEntry[],
): string {
  const subsByGroup = new Map<string, DemandSubGroupEntry[]>();
  for (const sg of subGroups) {
    const arr = subsByGroup.get(sg.demand_group_code) ?? [];
    arr.push(sg);
    subsByGroup.set(sg.demand_group_code, arr);
  }

  const lines: string[] = [
    "Ordne jedes Produkt einer demand_group und demand_sub_group zu. " +
    "Verwende die Codes aus dieser Liste – erfinde keine neuen Werte.\n",
  ];

  for (const g of groups) {
    const subs = subsByGroup.get(g.code);
    const subList = subs?.length
      ? subs.map((s) => `${s.code} ${s.name}`).join(", ")
      : "(keine Sub-Groups)";
    lines.push(`Demand Group ${g.code} (${g.name}):\n  Sub-Groups: ${subList}`);
  }

  return lines.join("\n");
}

/** Simple flat list prompt used by assign-category. */
export function buildDemandGroupListPrompt(
  groups: DemandGroupEntry[],
): string {
  return groups.map((g) => `- ${g.code}: ${g.name}`).join("\n");
}

