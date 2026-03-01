/**
 * Determine country from device location when no store is selected.
 * Uses geolocation + Nominatim reverse geocode; fallback timezone then 'DE'.
 */

import { getCurrentPosition } from "@/lib/store/store-service";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "DigitalShoppingList/1.0 (contact optional)";

/** Returns country code (e.g. 'AT', 'DE'). Fallback: 'DE'. */
export async function getCountryFromDevice(): Promise<string> {
  if (typeof window === "undefined") return "DE";

  try {
    const pos = await getCurrentPosition();
    const params = new URLSearchParams({
      lat: String(pos.latitude),
      lon: String(pos.longitude),
      format: "json",
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return fallbackCountryFromTimezone();
    const data = (await res.json()) as { address?: { country_code?: string } };
    const code = data?.address?.country_code;
    if (typeof code === "string" && code.length === 2) {
      return code.toUpperCase();
    }
  } catch {
    // permission denied, timeout, or network
  }
  return fallbackCountryFromTimezone();
}

function fallbackCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Vienna") || tz.includes("Austria")) return "AT";
  } catch {
    // ignore
  }
  return "DE";
}
