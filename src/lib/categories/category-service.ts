import { createClientIfConfigured } from "@/lib/supabase/client";
import type { DemandGroup } from "@/types";

export interface DemandGroupRow {
  code: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  color: string | null;
  sort_position: number;
}

let _dgCache: DemandGroupRow[] | null = null;
let _dgInflight: Promise<DemandGroupRow[] | null> | null = null;

/**
 * Fetch all demand groups from Supabase (client-side).
 */
export async function fetchDemandGroupsFromSupabase(): Promise<DemandGroupRow[] | null> {
  if (_dgCache) return _dgCache;
  if (_dgInflight) return _dgInflight;
  _dgInflight = _fetchDemandGroups();
  const result = await _dgInflight;
  _dgInflight = null;
  return result;
}

async function _fetchDemandGroups(): Promise<DemandGroupRow[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("demand_groups")
    .select("code, name, name_en, icon, color, sort_position")
    .order("sort_position");

  if (data) _dgCache = data as DemandGroupRow[];
  return (data as DemandGroupRow[] | null) ?? null;
}

/** Convert DemandGroupRow[] to DemandGroup[] */
export function toDemandGroups(rows: DemandGroupRow[]): DemandGroup[] {
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    name_en: r.name_en,
    icon: r.icon,
    color: r.color,
    sort_position: r.sort_position,
  }));
}

// ── Demand Sub-Groups ───────────────────────────────────────────────

export interface DemandSubGroupRow {
  code: string;
  name: string;
  demand_group_code: string;
  sort_position: number;
}

let _dsgCache: DemandSubGroupRow[] | null = null;
let _dsgInflight: Promise<DemandSubGroupRow[] | null> | null = null;

export async function fetchDemandSubGroupsFromSupabase(): Promise<DemandSubGroupRow[] | null> {
  if (_dsgCache) return _dsgCache;
  if (_dsgInflight) return _dsgInflight;
  _dsgInflight = _fetchDemandSubGroups();
  const result = await _dsgInflight;
  _dsgInflight = null;
  return result;
}

async function _fetchDemandSubGroups(): Promise<DemandSubGroupRow[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("demand_sub_groups")
    .select("code, name, demand_group_code, sort_position")
    .order("sort_position");

  if (data) _dsgCache = data as DemandSubGroupRow[];
  return (data as DemandSubGroupRow[] | null) ?? null;
}

/** Build a lookup map from sub-group code → display name */
export function buildSubGroupNameMap(rows: DemandSubGroupRow[]): Map<string, string> {
  return new Map(rows.map((r) => [r.code, r.name]));
}
