/**
 * Import Hofer stores (Austria) from OpenStreetMap (Overpass API) into Supabase.
 *
 * Usage: npm run import-stores-AT   or   npx tsx scripts/import-stores-AT.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *           (optional: SUPABASE_SERVICE_ROLE_KEY if RLS blocks anon)
 * Supabase: Table "stores" with columns store_id, name, address, city, postal_code,
 *           country, latitude, longitude, has_sorting_data, sorting_data_quality, created_at, updated_at
 */

import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/** Try these in order if one returns 504/429/503 */
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** Austria in OSM area id */
const AREA_AT = 3600016239;

/** Skip if existing store within this many meters */
const DUPLICATE_METERS = 30;

/** Node = point; Way = building outline, we use its center from Overpass "out center" */
type OverpassElement =
  | { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> }
  | { type: "way"; id: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

interface OverpassResult {
  elements: OverpassElement[];
}

function getLatLon(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.type === "node" && el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.type === "way" && el.center) return el.center;
  return null;
}

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
  created_at: string;
  updated_at: string;
}

function haversineMeters(
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

function buildAddress(tags: Record<string, string>): string {
  const street = tags["addr:street"] ?? "";
  const housenumber = tags["addr:housenumber"] ?? "";
  const postcode = tags["addr:postcode"] ?? "";
  const city = tags["addr:city"] ?? "";
  const parts: string[] = [];
  if (street) parts.push(housenumber ? `${street} ${housenumber}` : street);
  if (postcode && city) parts.push(`${postcode} ${city}`);
  else if (city) parts.push(city);
  return parts.join(", ") || "—";
}

/** Deterministic UUID from seed (stores table expects UUID). */
function toStoreId(type: "node" | "way", osmId: number): string {
  const seed = `store-osm-hofer-${type}-${osmId}`;
  const hash = crypto.createHash("sha1").update(seed).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

function elementToStore(el: OverpassElement, lat: number, lon: number): StoreRow {
  const tags = el.tags ?? {};
  const now = new Date().toISOString();
  const name = tags["name"] ?? tags["brand"] ?? tags["operator"] ?? `Hofer ${el.type}-${el.id}`;
  const city = tags["addr:city"] ?? "";
  const postal_code = tags["addr:postcode"] ?? "";
  const address = buildAddress(tags);

  return {
    store_id: toStoreId(el.type, el.id),
    name,
    address,
    city,
    postal_code,
    country: "AT",
    latitude: lat,
    longitude: lon,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: now,
    updated_at: now,
  };
}

/** Server timeout in seconds; lower than 180 to reduce gateway timeouts */
const OVERPASS_TIMEOUT = 90;

const overpassQuery = `
[out:json][timeout:${OVERPASS_TIMEOUT}];
area(${AREA_AT})->.at;
(
  node(area.at)["brand"="Hofer"];
  node(area.at)["name"="Hofer"];
  node(area.at)["operator"="Hofer"];
  way(area.at)["brand"="Hofer"];
  way(area.at)["name"="Hofer"];
  way(area.at)["operator"="Hofer"];
);
out center;
`;

const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 2;

async function fetchOverpass(): Promise<OverpassElement[]> {
  let lastError: Error | null = null;
  for (const baseUrl of OVERPASS_URLS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`  Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s…`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
        const res = await fetch(baseUrl, {
          method: "POST",
          body: overpassQuery,
          headers: { "Content-Type": "text/plain" },
        });
        if (!res.ok) {
          const msg = `${res.status} ${res.statusText}`;
          if ((res.status === 504 || res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
            lastError = new Error(`Overpass API (${baseUrl}): ${msg}`);
            continue;
          }
          throw new Error(`Overpass API error: ${msg}`);
        }
        const data: OverpassResult = await res.json();
        return data.elements ?? [];
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < MAX_RETRIES) continue;
        if (baseUrl !== OVERPASS_URLS[OVERPASS_URLS.length - 1]) {
          console.warn(`  ${baseUrl} failed, trying next endpoint…`);
        }
      }
    }
  }
  throw lastError ?? new Error("Overpass request failed");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key. Set in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log("Fetching Hofer stores from OpenStreetMap (Overpass API, AT)…");
  let elements: OverpassElement[];
  try {
    elements = await fetchOverpass();
  } catch (e) {
    console.error("Overpass request failed:", e);
    process.exit(1);
  }

  const seen = new Set<string>();
  const uniqueElements = elements.filter((el) => {
    const key = `${el.type}-${el.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const withCoords = uniqueElements.filter((el) => getLatLon(el) != null);
  console.log(`Found ${withCoords.length} unique Hofer elements with coordinates (${elements.length} raw).`);

  console.log("Loading existing stores from Supabase…");
  const { data: existing, error: fetchError } = await supabase
    .from("stores")
    .select("store_id, latitude, longitude");

  if (fetchError) {
    console.error(
      "Failed to fetch existing stores. Ensure table 'stores' exists and RLS allows read:",
      fetchError.message
    );
    process.exit(1);
  }

  const existingList = existing ?? [];

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const el of withCoords) {
    const coords = getLatLon(el)!;
    const { lat, lon } = coords;

    const isDuplicate = existingList.some(
      (s) => haversineMeters(s.latitude, s.longitude, lat, lon) < DUPLICATE_METERS
    );

    if (isDuplicate) {
      skipped++;
      continue;
    }

    const row = elementToStore(el, lat, lon);

    const { error } = await supabase.from("stores").insert(row);

    if (error) {
      console.error(`Insert failed for ${row.name} (${row.store_id}):`, error.message);
      errors++;
    } else {
      imported++;
      existingList.push({
        store_id: row.store_id,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }

  console.log("\n--- Zusammenfassung ---");
  console.log(`Importiert:              ${imported}`);
  console.log(`Übersprungen (Duplikat): ${skipped}`);
  console.log(`Fehler:                  ${errors}`);
}

main();
