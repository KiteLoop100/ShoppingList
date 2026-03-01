import { createClientIfConfigured } from "@/lib/supabase/client";

export interface CategoryRow {
  category_id: string;
  name: string;
  name_translations: Record<string, string> | null;
  icon: string;
  default_sort_position: number;
}

/**
 * Fetch all categories from Supabase (client-side).
 * Returns null when Supabase is not configured.
 */
export async function fetchCategoriesFromSupabase(): Promise<CategoryRow[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;

  const { data } = await supabase
    .from("categories")
    .select("category_id, name, name_translations, icon, default_sort_position");

  return (data as CategoryRow[] | null) ?? null;
}
