/**
 * Periodic GPS monitor that confirms whether the user is physically near a store.
 * Uses hysteresis (200 m enter / 350 m leave) to avoid flickering at boundaries.
 *
 * Encapsulated in a class to avoid module-level singletons and support clean
 * teardown on component remounts.
 */

import {
  getCurrentPosition,
  getStoresSorted,
  setListGpsConfirmed,
} from "./store-service";
import { distanceMeters } from "@/lib/geo/haversine";
import type { LocalStore } from "@/lib/db";
import { log } from "@/lib/utils/logger";

export const POLL_INTERVAL_MS = 90_000;
export const ENTER_RADIUS_M = 200;
export const LEAVE_RADIUS_M = 350;
const MAX_CONSECUTIVE_ERRORS = 3;

/** Refresh the cached store list every N polls (~7.5 min at 90s interval). */
const STORE_REFRESH_INTERVAL = 5;

export type InStoreCallback = (
  isInStore: boolean,
  nearestStore: LocalStore | null
) => void;

export interface InStoreMonitorHandle {
  stop(): void;
}

export function findNearest(
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

class InStoreMonitor implements InStoreMonitorHandle {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentlyInStore: boolean;
  private consecutiveErrors = 0;
  private pollCount = 0;
  private cachedStores: LocalStore[] | null = null;
  private readonly listId: string;
  private readonly onUpdate: InStoreCallback;

  constructor(
    listId: string,
    initiallyInStore: boolean,
    onUpdate: InStoreCallback
  ) {
    this.listId = listId;
    this.currentlyInStore = initiallyInStore;
    this.onUpdate = onUpdate;
  }

  start(): void {
    void this.poll();
    this.intervalId = setInterval(
      () => void this.poll(),
      POLL_INTERVAL_MS
    );
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.cachedStores = null;
  }

  private async poll(): Promise<void> {
    try {
      const pos = await getCurrentPosition();
      this.consecutiveErrors = 0;

      const shouldRefreshStores =
        !this.cachedStores || this.pollCount % STORE_REFRESH_INTERVAL === 0;
      if (shouldRefreshStores) {
        this.cachedStores = await getStoresSorted(pos);
      }
      this.pollCount += 1;

      const nearest = findNearest(pos.latitude, pos.longitude, this.cachedStores!);

      if (!nearest) {
        if (this.currentlyInStore) {
          this.currentlyInStore = false;
          await setListGpsConfirmed(this.listId, false);
          this.onUpdate(false, null);
        }
        return;
      }

      const threshold = this.currentlyInStore
        ? LEAVE_RADIUS_M
        : ENTER_RADIUS_M;
      const nowInStore = nearest.distance <= threshold;

      if (nowInStore !== this.currentlyInStore) {
        this.currentlyInStore = nowInStore;
        await setListGpsConfirmed(this.listId, nowInStore);
        this.onUpdate(nowInStore, nowInStore ? nearest.store : null);
      }
    } catch (e) {
      this.consecutiveErrors += 1;
      log.warn(
        `[InStoreMonitor] GPS poll failed (${this.consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
        e
      );
      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log.warn("[InStoreMonitor] Too many consecutive GPS errors, stopping monitor");
        this.stop();
      }
    }
  }
}

export interface CreateInStoreMonitorOptions {
  gpsEnabled?: boolean;
}

export function createInStoreMonitor(
  listId: string,
  initiallyInStore: boolean,
  onUpdate: InStoreCallback,
  options?: CreateInStoreMonitorOptions
): InStoreMonitorHandle {
  if (options?.gpsEnabled === false) {
    return { stop() {} };
  }
  const monitor = new InStoreMonitor(listId, initiallyInStore, onUpdate);
  monitor.start();
  return monitor;
}
