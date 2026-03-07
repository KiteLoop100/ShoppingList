/**
 * F04: Store detection (GPS + manual), store list, and list-store assignment.
 * Stores are loaded from Supabase when configured; otherwise from IndexedDB (seed).
 */

import { db } from "@/lib/db";
import type { LocalStore } from "@/lib/db";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/generate-id";
import { log } from "@/lib/utils/logger";

const GPS_RADIUS_METERS = 100;

function rowToStore(row: {
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
}): LocalStore {
  return {
    store_id: String(row.store_id),
    name: row.name,
    address: row.address,
    city: row.city,
    postal_code: row.postal_code,
    country: row.country,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    has_sorting_data: Boolean(row.has_sorting_data),
    sorting_data_quality: Number(row.sorting_data_quality),
    retailer: row.retailer ?? "ALDI SÜD",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Fetch stores from Supabase (paginated); returns [] on failure or when not configured. */
async function getStoresFromSupabase(): Promise<LocalStore[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];
  const PAGE_SIZE = 1000;
  const allRows: LocalStore[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return [];
    const rows = (data ?? []).map(rowToStore);
    allRows.push(...rows);
    hasMore = (data ?? []).length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allRows;
}

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

/** Get current device position (asks for permission if needed). */
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Find nearest store within radius, or null. Uses same store source as getStoresSorted. */
export async function findNearestStore(
  lat: number,
  lon: number,
  radiusMeters: number = GPS_RADIUS_METERS
): Promise<LocalStore | null> {
  const stores = await getStoresSorted({ latitude: lat, longitude: lon });
  let nearest: LocalStore | null = null;
  let minDist = radiusMeters;
  for (const s of stores) {
    const d = distanceMeters(lat, lon, s.latitude, s.longitude);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }
  return nearest;
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
    stores = await db.stores.toArray();
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

/** Try to detect store by GPS; if none, use default store from settings (F12). */
export async function detectAndSetStoreForList(
  listId: string
): Promise<StoreDetectionResult | null> {
  let gpsPosition: GeoPosition | undefined;
  try {
    const pos = await getCurrentPosition();
    gpsPosition = pos;
    const store = await findNearestStore(pos.latitude, pos.longitude);
    if (store) {
      await setListStore(listId, store.store_id);
      return { store, detectedByGps: true, gpsPosition };
    }
  } catch {
    // Permission denied or error – ignore
  }
  const { getDefaultStoreId } = await import("@/lib/settings/default-store");
  const defaultId = getDefaultStoreId();
  if (defaultId) {
    const all = await getStoresSorted();
    const store = all.find((s) => s.store_id === defaultId);
    if (store) {
      await setListStore(listId, store.store_id);
      return { store, detectedByGps: false, gpsPosition };
    }
  }
  return null;
}

/** Variant: returns the GPS position even if no store was found (for create-store flow). */
export async function detectStoreOrPosition(
  listId: string
): Promise<{ result: StoreDetectionResult | null; gpsPosition: GeoPosition | null }> {
  let gpsPosition: GeoPosition | null = null;
  try {
    gpsPosition = await getCurrentPosition();
    const store = await findNearestStore(gpsPosition.latitude, gpsPosition.longitude);
    if (store) {
      await setListStore(listId, store.store_id);
      return { result: { store, detectedByGps: true, gpsPosition }, gpsPosition };
    }
  } catch {
    // Permission denied or error – ignore
  }
  const { getDefaultStoreId } = await import("@/lib/settings/default-store");
  const defaultId = getDefaultStoreId();
  if (defaultId) {
    const all = await getStoresSorted();
    const store = all.find((s) => s.store_id === defaultId);
    if (store) {
      await setListStore(listId, store.store_id);
      return { result: { store, detectedByGps: false, gpsPosition }, gpsPosition };
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
  latitude: number;
  longitude: number;
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
  if (!address || !city) {
    const geo = await reverseGeocode(input.latitude, input.longitude);
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
    latitude: input.latitude,
    longitude: input.longitude,
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
