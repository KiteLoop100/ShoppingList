/**
 * F04: Store detection (GPS + manual), store list, and list-store assignment.
 * Stores are loaded from Supabase when configured; otherwise from IndexedDB (seed).
 */

import { db } from "@/lib/db";
import type { LocalStore } from "@/lib/db";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/generate-id";
import { log } from "@/lib/utils/logger";
import {
  distanceMeters,
  geoBoundingBox,
} from "@/lib/geo/haversine";

export { distanceMeters } from "@/lib/geo/haversine";

/** Accommodates indoor GPS inaccuracy (20-65m) + OSM coordinate offsets (30-80m). */
const GPS_RADIUS_METERS = 200;

/** Bounding-box search radius for geo-bounded Supabase queries (~10 km). */
const NEARBY_SEARCH_RADIUS_M = 10_000;

interface StoreRow {
  store_id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  has_sorting_data: boolean;
  sorting_data_quality: number;
  retailer?: string | null;
  created_at: string;
  updated_at: string;
}

function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    !(lat === 0 && lon === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function rowToStore(row: StoreRow): LocalStore | null {
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  if (!isValidCoordinate(lat, lon)) {
    log.warn(`[rowToStore] skipping store "${row.name}" (${row.store_id}): invalid coords (${lat}, ${lon})`);
    return null;
  }
  return {
    store_id: String(row.store_id),
    name: row.name,
    address: row.address,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    latitude: lat,
    longitude: lon,
    has_sorting_data: Boolean(row.has_sorting_data),
    sorting_data_quality: Number(row.sorting_data_quality),
    retailer: row.retailer ?? "ALDI SÜD",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface GeoBounds {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/**
 * Fetch stores from Supabase (paginated).
 * When `bounds` is provided, only fetches stores within the bounding box.
 * Returns partial results on pagination error instead of discarding everything.
 */
async function getStoresFromSupabase(bounds?: GeoBounds): Promise<LocalStore[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];
  const PAGE_SIZE = 1000;
  const allRows: LocalStore[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query = supabase.from("stores").select("*");
    if (bounds) {
      query = query
        .gte("latitude", bounds.latMin)
        .lte("latitude", bounds.latMax)
        .gte("longitude", bounds.lonMin)
        .lte("longitude", bounds.lonMax);
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      log.warn("[getStoresFromSupabase] page error, returning partial results:", error.message);
      break;
    }
    const rows = (data ?? [])
      .map((r: StoreRow) => rowToStore(r))
      .filter((s): s is LocalStore => s !== null);
    allRows.push(...rows);
    hasMore = (data ?? []).length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allRows;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export interface GetPositionOptions {
  /** Max age of a cached position in ms. 0 = force fresh. Default: 60_000. */
  maximumAge?: number;
  /** Timeout in ms for the GPS hardware to respond. Default: 20_000. */
  timeout?: number;
}

/** Get current device position (asks for permission if needed). */
export function getCurrentPosition(opts?: GetPositionOptions): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: opts?.timeout ?? 20_000,
        maximumAge: opts?.maximumAge ?? 60_000,
      }
    );
  });
}

/**
 * Find nearest store within radius using a geo-bounded Supabase query.
 * Falls back to IndexedDB when Supabase returns no results.
 * Logs diagnostics when no store matches.
 */
export async function findNearestStore(
  lat: number,
  lon: number,
  radiusMeters: number = GPS_RADIUS_METERS
): Promise<LocalStore | null> {
  const bounds = geoBoundingBox(lat, lon, NEARBY_SEARCH_RADIUS_M);
  let stores = await getStoresFromSupabase(bounds);
  if (stores.length === 0) {
    stores = await db.stores.toArray();
    stores = stores.filter((s) => isValidCoordinate(s.latitude, s.longitude));
  }

  let nearest: LocalStore | null = null;
  let minDist = Infinity;
  for (const s of stores) {
    const d = distanceMeters(lat, lon, s.latitude, s.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }

  if (!nearest || minDist >= radiusMeters) {
    log.info(
      `[findNearestStore] no match within ${radiusMeters}m at (${lat.toFixed(5)}, ${lon.toFixed(5)}). ` +
      `${stores.length} stores loaded` +
      (nearest ? `, nearest "${nearest.name}" at ${Math.round(minDist)}m` : "")
    );
    return null;
  }

  return nearest;
}

/**
 * Fetch stores within 10 km of `pos` using a geo-bounded Supabase query.
 * Falls back to a filtered IndexedDB scan when Supabase returns nothing.
 * Used by InStoreMonitor so the cache refresh doesn't pull every store globally.
 */
export async function getStoresNearby(pos: GeoPosition): Promise<LocalStore[]> {
  const bounds = geoBoundingBox(pos.latitude, pos.longitude, NEARBY_SEARCH_RADIUS_M);
  let stores = await getStoresFromSupabase(bounds);
  if (stores.length === 0) {
    const all = await db.stores.toArray();
    stores = all.filter((s) => isValidCoordinate(s.latitude, s.longitude));
  }
  return stores;
}

/** Get one store by id (from same source as getStoresSorted). */
export async function getStoreById(storeId: string): Promise<LocalStore | null> {
  const supabase = createClientIfConfigured();
  if (supabase) {
    const { data, error } = await supabase.from("stores").select("*").eq("store_id", storeId).maybeSingle();
    if (!error && data) return rowToStore(data);
  }
  const local = await db.stores.where("store_id").equals(storeId).first();
  return local ?? null;
}

/** All stores from Supabase (or IndexedDB fallback), optionally sorted by distance from (lat, lon). */
export async function getStoresSorted(
  coords?: GeoPosition | null
): Promise<LocalStore[]> {
  let stores = await getStoresFromSupabase();
  if (stores.length === 0) {
    const idbStores = await db.stores.toArray();
    stores = idbStores.filter((s) => isValidCoordinate(s.latitude, s.longitude));
  }
  if (coords) {
    return [...stores].sort(
      (a, b) =>
        distanceMeters(coords.latitude, coords.longitude, a.latitude, a.longitude) -
        distanceMeters(coords.latitude, coords.longitude, b.latitude, b.longitude)
    );
  }
  return [...stores].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Set the store for a list. */
export async function setListStore(
  listId: string,
  storeId: string | null
): Promise<void> {
  const list = await db.lists.where("list_id").equals(listId).first();
  if (!list) return;
  (list as { store_id: string | null }).store_id = storeId;
  await db.lists.put(list as never);
}

export interface StoreDetectionResult {
  store: LocalStore;
  detectedByGps: boolean;
  /** GPS position at time of detection (always set when detectedByGps=true). */
  gpsPosition?: GeoPosition;
}

/** Returns the GPS position even if no store was found (for create-store flow). */
export async function detectStoreOrPosition(
  listId: string
): Promise<{ result: StoreDetectionResult | null; gpsPosition: GeoPosition | null }> {
  let gpsPosition: GeoPosition | null = null;
  try {
    gpsPosition = await getCurrentPosition({ maximumAge: 0 });
    const store = await findNearestStore(gpsPosition.latitude, gpsPosition.longitude);
    if (store) {
      await setListStore(listId, store.store_id);
      return { result: { store, detectedByGps: true, gpsPosition }, gpsPosition };
    }
  } catch (e) {
    log.warn("[detectStoreOrPosition] GPS failed:", e);
  }
  const { getDefaultStoreId } = await import("@/lib/settings/default-store");
  const defaultId = getDefaultStoreId();
  if (defaultId) {
    const store = await getStoreById(defaultId);
    if (store) {
      await setListStore(listId, store.store_id);
      return { result: { store, detectedByGps: false, gpsPosition: gpsPosition ?? undefined }, gpsPosition };
    }
  }
  return { result: null, gpsPosition };
}

/** Update the gps_confirmed_in_store flag on a list. */
export async function setListGpsConfirmed(
  listId: string,
  confirmed: boolean
): Promise<void> {
  const list = await db.lists.where("list_id").equals(listId).first();
  if (!list) return;
  (list as { gps_confirmed_in_store?: boolean }).gps_confirmed_in_store = confirmed;
  await db.lists.put(list as never);
}

/** Reverse-geocode coordinates to a rough address via OpenStreetMap Nominatim. */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ address: string; city: string; postalCode: string; country: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=de`,
      { headers: { "User-Agent": "ALDI-Einkaufsliste/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const road = a.road ?? a.pedestrian ?? a.footway ?? "";
    const houseNumber = a.house_number ?? "";
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
    const postalCode = a.postcode ?? "";
    const country = a.country_code?.toUpperCase() ?? "DE";
    const address = [road, houseNumber].filter(Boolean).join(" ");
    return { address, city, postalCode, country };
  } catch (e) {
    log.warn("[reverseGeocode] failed:", e);
    return null;
  }
}

export interface CreateStoreInput {
  retailer: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/** Create a new user-defined store in Supabase + IndexedDB. */
export async function createStore(input: CreateStoreInput): Promise<LocalStore> {
  const now = new Date().toISOString();
  const storeId = generateId("store");

  let { address, city, postalCode, country } = input;
  const lat = input.latitude ?? null;
  const lng = input.longitude ?? null;
  if (!address || !city) {
    const geo = lat != null && lng != null ? await reverseGeocode(lat, lng) : null;
    if (geo) {
      address = address || geo.address;
      city = city || geo.city;
      postalCode = postalCode || geo.postalCode;
      country = country || geo.country;
    }
  }

  const storeName = input.name || `${input.retailer} ${city || ""}`.trim();

  const store: LocalStore = {
    store_id: storeId,
    name: storeName,
    address: address || "",
    city: city || "",
    postal_code: postalCode || "",
    country: country || "DE",
    // (0, 0) = "null island" sentinel for stores created without a GPS fix.
    // isValidCoordinate() rejects (0, 0), so these stores are excluded from
    // GPS-based detection but remain accessible via the default-store fallback.
    latitude: lat ?? 0,
    longitude: lng ?? 0,
    has_sorting_data: false,
    sorting_data_quality: 0,
    retailer: input.retailer,
    created_at: now,
    updated_at: now,
  };

  const supabase = createClientIfConfigured();
  if (supabase) {
    const { error } = await supabase.from("stores").insert({
      store_id: store.store_id,
      name: store.name,
      address: store.address,
      city: store.city,
      postal_code: store.postal_code,
      country: store.country,
      latitude: store.latitude,
      longitude: store.longitude,
      has_sorting_data: false,
      sorting_data_quality: 0,
      retailer: store.retailer,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      log.error("[createStore] Supabase insert failed:", error);
    }
  }

  await db.stores.add(store as never);
  return store;
}

/** Get the retailer for a store by id (for cross-chain aggregation). */
export async function getStoreRetailer(storeId: string): Promise<string | null> {
  const store = await getStoreById(storeId);
  return store?.retailer ?? null;
}
