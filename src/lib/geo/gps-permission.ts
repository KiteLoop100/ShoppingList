/**
 * Utilities for checking and managing the GPS permission preference.
 * Combines the app-level `gps_enabled` setting with the browser's
 * geolocation permission state to avoid unnecessary prompts.
 */

import { loadSettings, saveSettings } from "@/lib/settings/settings-sync";
import { log } from "@/lib/utils/logger";

export type GpsCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "setting-disabled" | "browser-denied" };

/**
 * Check whether GPS should be used by reading the user setting and
 * querying the browser permission state.
 *
 * When the browser permission is `denied`, automatically persists
 * `gps_enabled: false` so future checks skip the API call.
 */
export async function checkGpsAllowed(): Promise<GpsCheckResult> {
  const settings = await loadSettings();
  if (!settings.gps_enabled) {
    return { allowed: false, reason: "setting-disabled" };
  }

  const browserState = await queryGeolocationPermission();
  if (browserState === "denied") {
    log.info("[GpsPermission] Browser permission denied — auto-disabling gps_enabled");
    await saveSettings({ gps_enabled: false });
    return { allowed: false, reason: "browser-denied" };
  }

  return { allowed: true };
}

/**
 * Query the browser's geolocation permission without triggering a prompt.
 * Returns 'granted', 'denied', 'prompt', or 'unknown' when the API isn't available.
 */
export async function queryGeolocationPermission(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  if (typeof navigator === "undefined" || !navigator.permissions) {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}
