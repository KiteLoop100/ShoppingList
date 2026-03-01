import type { SupabaseClient } from "@supabase/supabase-js";

export async function getDefaultCategoryId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("categories")
    .select("category_id")
    .eq("name", "Sonstiges")
    .limit(1);
  return data?.[0]?.category_id ?? null;
}
