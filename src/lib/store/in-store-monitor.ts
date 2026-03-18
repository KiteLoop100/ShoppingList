/**
 * Periodic GPS monitor that confirms whether the user is physically near a store.
 * Uses hysteresis (200 m enter / 350 m leave) to avoid flickering at boundaries.
 *
 * On consecutive GPS errors the monitor enters exponential backoff (30 s – 5 min)
 * instead of stopping permanently, and recovers automatically when GPS becomes
 * available again. A `pollNow()` method allows callers (e.g. visibilitychange
 * handler) to trigger an immediate position check.
 *
 * Encapsulated in a class to avoid module-level singletons and support clean
 * teardown on component remounts.
 */

import {
  getCurrentPosition,
  getStoresNearby,
  setListGpsConfirmed,
} from "./store-service";
import { distanceMeters } from "@/lib/geo/haversine";
import type { LocalStore } from "@/lib/db";
import { log } from "@/lib/utils/logger";

export const POLL_INTERVAL_MS = 90_000;
export const ENTER_RADIUS_M = 200;
export const LEAVE_RADIUS_M = 350;
const MAX_CONSECUTIVE_ERRORS = 3;

export const INITIAL_BACKOFF_MS = 30_000;
export const MAX_BACKOFF_MS = 300_000;

/** Refresh the cached store list every N polls (~7.5 min at 90s interval). */
const STORE_REFRESH_INTERVAL = 5;

export type InStoreCallback = (
  isInStore: boolean,
  nearestStore: LocalStore | null
) => void;

export interface InStoreMonitorHandle {
  stop(): void;
  /** Trigger an immediate GPS poll (e.g. on app resume). No-op if stopped. */
  pollNow(): void;
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
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private inBackoff = false;
  private stopped = false;
  private isPolling = false;
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
    this.stopped = true;
    this.inBackoff = false;
    this.clearPolling();
    if (this.backoffTimer !== null) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    this.cachedStores = null;
  }

  pollNow(): void {
    if (this.stopped) return;
    if (this.backoffTimer !== null) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
    void this.poll();
  }

  private clearPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private restartPolling(): void {
    this.clearPolling();
    this.intervalId = setInterval(
      () => void this.poll(),
      POLL_INTERVAL_MS
    );
  }

  private async poll(): Promise<void> {
    if (this.isPolling || this.stopped) return;
    this.isPolling = true;
    try {
      const pos = await getCurrentPosition({
        maximumAge: POLL_INTERVAL_MS,
        timeout: 25_000,
      });
      this.consecutiveErrors = 0;
      const wasInBackoff = this.inBackoff;
      this.inBackoff = false;
      this.backoffMs = INITIAL_BACKOFF_MS;
      if (!this.stopped && (wasInBackoff || !this.intervalId)) {
        this.restartPolling();
      }

      const shouldRefreshStores =
        !this.cachedStores || this.pollCount % STORE_REFRESH_INTERVAL === 0;
      if (shouldRefreshStores) {
        this.cachedStores = await getStoresNearby(pos);
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
        log.warn(
          `[InStoreMonitor] ${MAX_CONSECUTIVE_ERRORS} consecutive errors, ` +
          `backing off ${this.backoffMs / 1000}s`
        );
        this.inBackoff = true;
        this.clearPolling();
        this.backoffTimer = setTimeout(() => void this.poll(), this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      }
    } finally {
      this.isPolling = false;
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
    return { stop() {}, pollNow() {} };
  }
  const monitor = new InStoreMonitor(listId, initiallyInStore, onUpdate);
  monitor.start();
  return monitor;
}
