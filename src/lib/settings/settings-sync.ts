/**
 * Syncs user settings (language, default store, product preferences)
 * to Supabase `user_settings` table for cross-device persistence.
 * Falls back to localStorage when Supabase is unavailable or user is not authenticated.
 */

import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { log } from "@/lib/utils/logger";

export interface UserSettings {
  preferred_language: "de" | "en";
  default_store_id: string | null;
  gps_enabled: boolean;
  exclude_gluten: boolean;
  exclude_lactose: boolean;
  exclude_nuts: boolean;
  prefer_cheapest: boolean;
  prefer_brand: boolean;
  prefer_bio: boolean;
  prefer_vegan: boolean;
  prefer_animal_welfare: boolean;
}

const LOCAL_CACHE_KEY = "user-settings-cache";

const DEFAULTS: UserSettings = {
  preferred_language: "de",
  default_store_id: null,
  gps_enabled: true,
  exclude_gluten: false,
  exclude_lactose: false,
  exclude_nuts: false,
  prefer_cheapest: false,
  prefer_brand: false,
  prefer_bio: false,
  prefer_vegan: false,
  prefer_animal_welfare: false,
};

function getLocalCache(): UserSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function setLocalCache(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(settings));
}

/**
 * Load settings from Supabase (with localStorage fallback).
 * On first load after migration, pushes existing localStorage values to Supabase.
 */
export async function loadSettings(forceUserId?: string): Promise<UserSettings> {
  const userId = forceUserId ?? getCurrentUserId();
  if (userId === "anonymous") return getLocalCache();

  const supabase = createClientIfConfigured();
  if (!supabase) return getLocalCache();

  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log.warn("[SettingsSync] load error:", error.message);
      return getLocalCache();
    }

    if (data) {
      const settings: UserSettings = {
        preferred_language: (data.preferred_language as UserSettings["preferred_language"]) ?? DEFAULTS.preferred_language,
        default_store_id: data.default_store_id ?? DEFAULTS.default_store_id,
        gps_enabled: data.gps_enabled ?? DEFAULTS.gps_enabled,
        exclude_gluten: data.exclude_gluten ?? DEFAULTS.exclude_gluten,
        exclude_lactose: data.exclude_lactose ?? DEFAULTS.exclude_lactose,
        exclude_nuts: data.exclude_nuts ?? DEFAULTS.exclude_nuts,
        prefer_cheapest: data.prefer_cheapest ?? DEFAULTS.prefer_cheapest,
        prefer_brand: data.prefer_brand ?? DEFAULTS.prefer_brand,
        prefer_bio: data.prefer_bio ?? DEFAULTS.prefer_bio,
        prefer_vegan: data.prefer_vegan ?? DEFAULTS.prefer_vegan,
        prefer_animal_welfare: data.prefer_animal_welfare ?? DEFAULTS.prefer_animal_welfare,
      };
      setLocalCache(settings);
      return settings;
    }

    // No row yet — seed from existing localStorage values (one-time migration)
    const localSettings = buildFromLegacyLocalStorage();
    await saveSettings(localSettings, userId);
    return localSettings;
  } catch (err) {
    log.warn("[SettingsSync] load failed, using cache:", err);
    return getLocalCache();
  }
}

/**
 * Save settings to Supabase (upsert) and update localStorage cache.
 */
export async function saveSettings(
  settings: Partial<UserSettings>,
  forceUserId?: string
): Promise<void> {
  const current = getLocalCache();
  const merged: UserSettings = { ...current, ...settings };
  setLocalCache(merged);

  const userId = forceUserId ?? getCurrentUserId();
  if (userId === "anonymous") return;

  const supabase = createClientIfConfigured();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        preferred_language: merged.preferred_language,
        default_store_id: merged.default_store_id,
        gps_enabled: merged.gps_enabled,
        exclude_gluten: merged.exclude_gluten,
        exclude_lactose: merged.exclude_lactose,
        exclude_nuts: merged.exclude_nuts,
        prefer_cheapest: merged.prefer_cheapest,
        prefer_brand: merged.prefer_brand,
        prefer_bio: merged.prefer_bio,
        prefer_vegan: merged.prefer_vegan,
        prefer_animal_welfare: merged.prefer_animal_welfare,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      log.warn("[SettingsSync] save error:", error.message);
    }
  } catch (err) {
    log.warn("[SettingsSync] save failed:", err);
  }
}

/**
 * Build initial settings from legacy localStorage keys
 * (product-preferences + default-store-id) for one-time migration.
 */
function buildFromLegacyLocalStorage(): UserSettings {
  const settings: UserSettings = { ...DEFAULTS };

  if (typeof window === "undefined") return settings;

  try {
    const prefsRaw = localStorage.getItem("product-preferences");
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw);
      if (typeof prefs.exclude_gluten === "boolean") settings.exclude_gluten = prefs.exclude_gluten;
      if (typeof prefs.exclude_lactose === "boolean") settings.exclude_lactose = prefs.exclude_lactose;
      if (typeof prefs.exclude_nuts === "boolean") settings.exclude_nuts = prefs.exclude_nuts;
      if (typeof prefs.prefer_cheapest === "boolean") settings.prefer_cheapest = prefs.prefer_cheapest;
      if (typeof prefs.prefer_brand === "boolean") settings.prefer_brand = prefs.prefer_brand;
      if (typeof prefs.prefer_bio === "boolean") settings.prefer_bio = prefs.prefer_bio;
      if (typeof prefs.prefer_vegan === "boolean") settings.prefer_vegan = prefs.prefer_vegan;
      if (typeof prefs.prefer_animal_welfare === "boolean") settings.prefer_animal_welfare = prefs.prefer_animal_welfare;
    }
  } catch { /* ignore */ }

  try {
    const storeId = localStorage.getItem("digital-shopping-list-default-store-id");
    if (storeId) settings.default_store_id = storeId;
  } catch { /* ignore */ }

  return settings;
}
