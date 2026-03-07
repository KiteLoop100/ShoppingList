/**
 * Import NZ grocery stores (Nelson region, 50 km radius) from OpenStreetMap
 * (Overpass API) into Supabase.
 *
 * Retailers: Woolworths / Countdown, New World, PAK'nSAVE, Four Square,
 *            The Warehouse.
 *
 * Usage: npx tsx scripts/import-stores-NZ.ts
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and
 *           NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const NELSON_LAT = -41.2706;
const NELSON_LON = 173.284;
const RADIUS_METERS = 50_000;

const DUPLICATE_METERS = 30;
const OVERPASS_TIMEOUT = 120;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES = 2;

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

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function elementToStore(el: OverpassElement, lat: number, lon: number): StoreRow {
  const tags = el.tags ?? {};
  const ts = new Date().toISOString();
  const name = tags["name"] ?? tags["brand"] ?? tags["operator"] ?? `Store ${el.type}-${el.id}`;
  const city = tags["addr:city"] ?? "";
  const postal_code = tags["addr:postcode"] ?? "";
  const address = buildAddress(tags);

  const osmKey = `store-osm-${el.type}-${el.id}`;
  const hash = crypto.createHash("sha1").update(osmKey).digest("hex");
  const store_id = [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");

  return {
    store_id,
    name,
    address,
    city,
    postal_code,
    country: "NZ",
    latitude: lat,
    longitude: lon,
    has_sorting_data: false,
    sorting_data_quality: 0,
    created_at: ts,
    updated_at: ts,
  };
}

const RETAILER_NAMES = [
  "Woolworths",
  "Countdown",
  "New World",
  "PAK'nSAVE",
  "PAK'n SAVE",
  "PaknSave",
  "Four Square",
  "FreshChoice",
  "The Warehouse",
];

function buildOverpassQuery(): string {
  const around = `around:${RADIUS_METERS},${NELSON_LAT},${NELSON_LON}`;
  const lines: string[] = [];
  for (const retailer of RETAILER_NAMES) {
    lines.push(`  node(${around})["name"="${retailer}"];`);
    lines.push(`  way(${around})["name"="${retailer}"];`);
    lines.push(`  node(${around})["brand"="${retailer}"];`);
    lines.push(`  way(${around})["brand"="${retailer}"];`);
  }
  return `[out:json][timeout:${OVERPASS_TIMEOUT}];\n(\n${lines.join("\n")}\n);\nout center;\n`;
}

async function fetchOverpass(): Promise<OverpassElement[]> {
  const query = buildOverpassQuery();
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
          body: query,
          headers: { "Content-Type": "text/plain" },
        });
        if (!res.ok) {
          const msg = `${res.status} ${res.statusText}`;
          if ([504, 429, 503].includes(res.status) && attempt < MAX_RETRIES) {
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key. Set in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`Fetching NZ stores within ${RADIUS_METERS / 1000} km of Nelson from OpenStreetMap…`);
  let elements: OverpassElement[];
  try {
    elements = await fetchOverpass();
  } catch (e) {
    console.error("Overpass request failed:", e);
    process.exit(1);
  }

  const seen = new Set<string>();
  const uniqueElements = elements.filter((el) => {
    const k = `${el.type}-${el.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const withCoords = uniqueElements.filter((el) => getLatLon(el) != null);
  console.log(`Found ${withCoords.length} unique store elements with coordinates (${elements.length} raw).`);

  console.log("Loading existing stores from Supabase…");
  const { data: existing, error: fetchError } = await supabase
    .from("stores")
    .select("store_id, latitude, longitude");

  if (fetchError) {
    console.error("Failed to fetch existing stores:", fetchError.message);
    process.exit(1);
  }

  const existingList = existing ?? [];
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const el of withCoords) {
    const coords = getLatLon(el)!;
    const isDuplicate = existingList.some(
      (s) => haversineMeters(s.latitude, s.longitude, coords.lat, coords.lon) < DUPLICATE_METERS
    );
    if (isDuplicate) {
      skipped++;
      continue;
    }

    const row = elementToStore(el, coords.lat, coords.lon);
    const { error } = await supabase.from("stores").insert(row);

    if (error) {
      console.error(`Insert failed for ${row.name} (${row.store_id}):`, error.message);
      errors++;
    } else {
      imported++;
      existingList.push({ store_id: row.store_id, latitude: row.latitude, longitude: row.longitude });
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Imported:  ${imported}`);
  console.log(`Skipped (duplicate): ${skipped}`);
  console.log(`Errors:    ${errors}`);
}

main();
