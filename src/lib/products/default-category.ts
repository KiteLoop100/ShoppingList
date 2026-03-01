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

let cachedAktionsartikelId: string | null = null;
let aktionsartikelLoaded = false;

export async function getAktionsartikelCategoryId(
  supabase: SupabaseClient,
): Promise<string | null> {
  if (aktionsartikelLoaded) return cachedAktionsartikelId;
  const { data } = await supabase
    .from("categories")
    .select("category_id")
    .eq("name", "Aktionsartikel")
    .limit(1);
  cachedAktionsartikelId = data?.[0]?.category_id ?? null;
  aktionsartikelLoaded = true;
  return cachedAktionsartikelId;
}
