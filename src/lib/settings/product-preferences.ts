/**
 * User product preferences (dietary exclusions & quality preferences).
 * Synchronous getter reads from localStorage cache (fast, for search ranking).
 * Writes go to both localStorage and Supabase via settings-sync.
 */

const STORAGE_KEY = "product-preferences";

export interface ProductPreferences {
  exclude_gluten: boolean;
  exclude_lactose: boolean;
  exclude_nuts: boolean;
  prefer_cheapest: boolean;
  prefer_brand: boolean;
  prefer_bio: boolean;
  prefer_vegan: boolean;
  prefer_animal_welfare: boolean;
}

const DEFAULT_PREFERENCES: ProductPreferences = {
  exclude_gluten: false,
  exclude_lactose: false,
  exclude_nuts: false,
  prefer_cheapest: false,
  prefer_brand: false,
  prefer_bio: false,
  prefer_vegan: false,
  prefer_animal_welfare: false,
};

/** Synchronous read from localStorage (used by search ranking). */
export function getProductPreferences(): ProductPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Write to localStorage + async sync to Supabase. */
export function setProductPreferences(prefs: Partial<ProductPreferences>): void {
  if (typeof window === "undefined") return;
  const current = getProductPreferences();
  const merged = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}
