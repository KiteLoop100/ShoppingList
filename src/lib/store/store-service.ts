/**
 * F04: Store detection (GPS + manual), store list, and list-store assignment.
 * Stores are loaded from Supabase when configured; otherwise from IndexedDB (seed).
 */

import { db } from "@/lib/db";
import type { LocalStore } from "@/lib/db";
import { createClientIfConfigured } from "@/lib/supabase/client";

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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Fetch stores from Supabase; returns [] on failure or when not configured. */
async function getStoresFromSupabase(): Promise<LocalStore[]> {
  const supabase = createClientIfConfigured();
  if (!supabase) return [];
  const { data, error } = await supabase.from("stores").select("*");
  if (error) return [];
  return (data ?? []).map(rowToStore);
}

/** Haversine distance in meters between two WGS84 points. */
function distanceMeters(
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

/** Try to detect store by GPS; if none, use default store from settings (F12). */
export async function detectAndSetStoreForList(listId: string): Promise<LocalStore | null> {
  try {
    const pos = await getCurrentPosition();
    const store = await findNearestStore(pos.latitude, pos.longitude);
    if (store) {
      await setListStore(listId, store.store_id);
      return store;
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
      return store;
    }
  }
  return null;
}
