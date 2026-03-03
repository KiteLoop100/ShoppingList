/**
 * Default demand group codes for fallback scenarios.
 * Uses the new demand_groups table codes instead of category UUIDs.
 */

/** Default demand group for unclassified items. */
export const DEFAULT_DEMAND_GROUP_CODE = "AK";

/** Demand group for promotional / Aktionsartikel items. */
export const AKTIONSARTIKEL_DEMAND_GROUP_CODE = "AK";

/** @deprecated Use DEFAULT_DEMAND_GROUP_CODE. */
export async function getDefaultCategoryId(
  supabase: import("@supabase/supabase-js").SupabaseClient,
): Promise<string | null> {
  return DEFAULT_DEMAND_GROUP_CODE;
}

/** @deprecated Use AKTIONSARTIKEL_DEMAND_GROUP_CODE. */
export async function getAktionsartikelCategoryId(
  supabase: import("@supabase/supabase-js").SupabaseClient,
): Promise<string | null> {
  return AKTIONSARTIKEL_DEMAND_GROUP_CODE;
}
