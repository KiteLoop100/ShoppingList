/**
 * Periodic GPS monitor that confirms whether the user is physically near a store.
 * Uses hysteresis (100 m enter / 200 m leave) to avoid flickering at boundaries.
 */

import {
  getCurrentPosition,
  distanceMeters,
  getStoresSorted,
  setListGpsConfirmed,
} from "./store-service";
import type { LocalStore } from "@/lib/db";

const POLL_INTERVAL_MS = 90_000;
const ENTER_RADIUS_M = 100;
const LEAVE_RADIUS_M = 200;

export type InStoreCallback = (
  isInStore: boolean,
  nearestStore: LocalStore | null
) => void;

let intervalId: ReturnType<typeof setInterval> | null = null;
let currentlyInStore = false;

function findNearest(
  lat: number,
  lon: number,
  stores: LocalStore[]
): { store: LocalStore; distance: number } | null {
  let best: { store: LocalStore; distance: number } | null = null;
  for (const s of stores) {
    const d = distanceMeters(lat, lon, s.latitude, s.longitude);
    if (!best || d < best.distance) {
      best = { store: s, distance: d };
    }
  }
  return best;
}

async function poll(
  listId: string,
  onUpdate: InStoreCallback
): Promise<void> {
  try {
    const pos = await getCurrentPosition();
    const stores = await getStoresSorted(pos);
    const nearest = findNearest(pos.latitude, pos.longitude, stores);

    if (!nearest) {
      if (currentlyInStore) {
        currentlyInStore = false;
        await setListGpsConfirmed(listId, false);
        onUpdate(false, null);
      }
      return;
    }

    const threshold = currentlyInStore ? LEAVE_RADIUS_M : ENTER_RADIUS_M;
    const nowInStore = nearest.distance <= threshold;

    if (nowInStore !== currentlyInStore) {
      currentlyInStore = nowInStore;
      await setListGpsConfirmed(listId, nowInStore);
      onUpdate(nowInStore, nowInStore ? nearest.store : null);
    }
  } catch {
    // Geolocation denied or timed out — stop polling silently
    stopInStoreMonitor();
  }
}

export function startInStoreMonitor(
  listId: string,
  initiallyInStore: boolean,
  onUpdate: InStoreCallback
): void {
  stopInStoreMonitor();
  currentlyInStore = initiallyInStore;
  intervalId = setInterval(() => poll(listId, onUpdate), POLL_INTERVAL_MS);
}

export function stopInStoreMonitor(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
