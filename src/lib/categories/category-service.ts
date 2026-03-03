import { createClientIfConfigured } from "@/lib/supabase/client";
import type { DemandGroup } from "@/types";

export interface CategoryRow {
  category_id: string;
  name: string;
  name_translations: Record<string, string> | null;
  icon: string;
  default_sort_position: number;
}

export interface DemandGroupRow {
  code: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  color: string | null;
  sort_position: number;
}

let _categoryCache: CategoryRow[] | null = null;
let _dgCache: DemandGroupRow[] | null = null;
let _categoryInflight: Promise<CategoryRow[] | null> | null = null;
let _dgInflight: Promise<DemandGroupRow[] | null> | null = null;

/**
 * Fetch all categories from Supabase (client-side).
 * @deprecated Use fetchDemandGroupsFromSupabase instead.
 */
export async function fetchCategoriesFromSupabase(): Promise<CategoryRow[] | null> {
  if (_categoryCache) return _categoryCache;
  if (_categoryInflight) return _categoryInflight;
  _categoryInflight = _fetchCategories();
  const result = await _categoryInflight;
  _categoryInflight = null;
  return result;
}

async function _fetchCategories(): Promise<CategoryRow[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("categories")
    .select("category_id, name, name_translations, icon, default_sort_position");

  if (data) _categoryCache = data as CategoryRow[];
  return (data as CategoryRow[] | null) ?? null;
}

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

/** @deprecated Use fetchDemandGroupsFromSupabase. */
export async function getCachedCategories(): Promise<CategoryRow[]> {
  const result = await fetchCategoriesFromSupabase();
  return result ?? [];
}
