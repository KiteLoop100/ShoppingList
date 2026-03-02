import { createClientIfConfigured } from "@/lib/supabase/client";

export interface CategoryRow {
  category_id: string;
  name: string;
  name_translations: Record<string, string> | null;
  icon: string;
  default_sort_position: number;
}

let _cache: CategoryRow[] | null = null;
let _inflight: Promise<CategoryRow[] | null> | null = null;

/**
 * Fetch all categories from Supabase (client-side).
 * Returns null when Supabase is not configured.
 */
export async function fetchCategoriesFromSupabase(): Promise<CategoryRow[] | null> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = _fetchCategories();
  const result = await _inflight;
  _inflight = null;
  return result;
}

async function _fetchCategories(): Promise<CategoryRow[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("categories")
    .select("category_id, name, name_translations, icon, default_sort_position");

  if (data) _cache = data as CategoryRow[];
  return (data as CategoryRow[] | null) ?? null;
}

/**
 * Get cached categories synchronously if available, or fetch and cache.
 */
export async function getCachedCategories(): Promise<CategoryRow[]> {
  const result = await fetchCategoriesFromSupabase();
  return result ?? [];
}
