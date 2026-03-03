/**
 * Demand-group helpers — loads demand groups from Supabase at runtime.
 * Used by API routes for Claude-based classification.
 *
 * Source of truth is the `demand_groups` table (~61 ALDI commodity group codes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface DemandGroupEntry {
  code: string;
  name: string;
  name_en: string | null;
}

let _cached: DemandGroupEntry[] | null = null;

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

export function buildDemandGroupListPrompt(
  groups: DemandGroupEntry[],
): string {
  return groups.map((g) => `- ${g.code}: ${g.name}`).join("\n");
}

