/**
 * Category helpers — loads the category list from Supabase at runtime.
 * Used by API routes for Claude-based classification.
 *
 * No hardcoded UUIDs: the source of truth is the `categories` table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CategoryEntry {
  id: string;
  name: string;
}

let _cached: CategoryEntry[] | null = null;

/**
 * Load categories from Supabase. The result is cached in-memory for the
 * lifetime of the serverless function (categories rarely change).
 */
export async function loadCategories(
  supabase: SupabaseClient,
): Promise<CategoryEntry[]> {
  if (_cached) return _cached;
  const { data, error } = await supabase
    .from("categories")
    .select("category_id, name")
    .order("name");
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  _cached = (data ?? []).map(
    (c: { category_id: string; name: string }) => ({
      id: c.category_id,
      name: c.name,
    }),
  );
  return _cached;
}

export function buildCategoryListPrompt(
  categories: CategoryEntry[],
): string {
  return categories.map((c) => `- ${c.id}: ${c.name}`).join("\n");
}
