/**
 * Haversine distance calculation between two WGS84 coordinates.
 * Shared across store detection, import scripts, and monitor.
 */

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Compute a lat/lon bounding box for a given center + radius.
 * Uses a rough approximation (1 degree latitude ~ 111km) that is
 * more than accurate enough for filtering stores within a few km.
 */
export function geoBoundingBox(
  lat: number,
  lon: number,
  radiusMeters: number
): { latMin: number; latMax: number; lonMin: number; lonMax: number } {
  const latDelta = radiusMeters / 111_320;
  const lonDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lonMin: lon - lonDelta,
    lonMax: lon + lonDelta,
  };
}
