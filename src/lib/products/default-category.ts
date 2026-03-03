/**
 * Default demand group codes for fallback scenarios.
 * Uses the new demand_groups table codes instead of category UUIDs.
 */

/** Default demand group for unclassified items. */
export const DEFAULT_DEMAND_GROUP_CODE = "AK";

/** Demand group for promotional / Aktionsartikel items. */
export const AKTIONSARTIKEL_DEMAND_GROUP_CODE = "AK";

export function getDefaultDemandGroupCode(): string {
  return DEFAULT_DEMAND_GROUP_CODE;
}

export function getAktionsartikelDemandGroupCode(): string {
  return AKTIONSARTIKEL_DEMAND_GROUP_CODE;
}

