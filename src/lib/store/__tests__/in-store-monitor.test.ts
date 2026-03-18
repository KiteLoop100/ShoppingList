import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { LocalStore } from "@/lib/db";

let mockPosition = { latitude: 48.137, longitude: 11.576 };
let mockPositionError: Error | null = null;

const mockStores: LocalStore[] = [
  {
    store_id: "store-1",
    name: "ALDI Musterstadt",
    address: "Hauptstr. 1",
    city: "Musterstadt",
    postal_code: "80331",
    country: "DE",
    latitude: 48.137,
    longitude: 11.576,
    has_sorting_data: false,
    sorting_data_quality: 0,
    retailer: "ALDI SÜD",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

const mockSetListGpsConfirmed = vi.fn();
const mockGetStoresNearby = vi.fn(async () => [...mockStores]);

vi.mock("@/lib/store/store-service", () => ({
  getCurrentPosition: vi.fn(async () => {
    if (mockPositionError) throw mockPositionError;
    return mockPosition;
  }),
  getStoresNearby: (...args: unknown[]) => mockGetStoresNearby(...args),
  setListGpsConfirmed: (...args: unknown[]) =>
    mockSetListGpsConfirmed(...args),
}));

vi.mock("@/lib/geo/haversine", () => ({
  distanceMeters: vi.fn(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      return Math.sqrt(dLat ** 2 + dLon ** 2) * 111_320;
    }
  ),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  createInStoreMonitor,
  findNearest,
  ENTER_RADIUS_M,
  LEAVE_RADIUS_M,
  POLL_INTERVAL_MS,
  INITIAL_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from "@/lib/store/in-store-monitor";

describe("findNearest", () => {
  test("returns closest store with distance", () => {
    const result = findNearest(48.137, 11.576, mockStores);
    expect(result).not.toBeNull();
    expect(result!.store.store_id).toBe("store-1");
    expect(result!.distance).toBeCloseTo(0, 0);
  });

  test("returns null for empty store list", () => {
    expect(findNearest(48.137, 11.576, [])).toBeNull();
  });
});

describe("radius constants", () => {
  test("ENTER_RADIUS_M is 200", () => {
    expect(ENTER_RADIUS_M).toBe(200);
  });

  test("LEAVE_RADIUS_M is 350", () => {
    expect(LEAVE_RADIUS_M).toBe(350);
  });

  test("hysteresis gap exists (leave > enter)", () => {
    expect(LEAVE_RADIUS_M).toBeGreaterThan(ENTER_RADIUS_M);
  });
});

describe("InStoreMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    mockPositionError = null;
    mockSetListGpsConfirmed.mockReset();
    mockGetStoresNearby.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("calls poll immediately on start (no 90s delay)", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.objectContaining({ store_id: "store-1" }));
    monitor.stop();
  });

  test("hysteresis: enters at <= ENTER_RADIUS_M", async () => {
    mockPosition = { latitude: 48.1378, longitude: 11.576 };
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);

    const distApprox = Math.sqrt((48.1378 - 48.137) ** 2) * 111_320;
    if (distApprox <= ENTER_RADIUS_M) {
      expect(onUpdate).toHaveBeenCalledWith(true, expect.anything());
    }
    monitor.stop();
  });

  test("hysteresis: does not leave until > LEAVE_RADIUS_M", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", true, onUpdate);

    mockPosition = { latitude: 48.1385, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(50);

    const dist = Math.sqrt((48.1385 - 48.137) ** 2) * 111_320;
    if (dist <= LEAVE_RADIUS_M) {
      expect(onUpdate).not.toHaveBeenCalledWith(false, null);
    }
    monitor.stop();
  });

  test("does not stop after a single GPS error", async () => {
    const onUpdate = vi.fn();

    mockPositionError = new Error("GPS timeout");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.objectContaining({ store_id: "store-1" }));
    monitor.stop();
  });

  test("enters backoff after 3 consecutive GPS errors and recovers", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 3 errors: initial poll + 2 interval polls
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(onUpdate).not.toHaveBeenCalled();

    // Now in backoff. Fix GPS and wait for backoff timer to fire.
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ store_id: "store-1" })
    );
    monitor.stop();
  });

  test("stop() cleans up interval", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    monitor.stop();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  test("resets consecutive error count on success", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.anything());

    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(onUpdate).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  test("returns no-op monitor when gpsEnabled is false", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate, {
      gpsEnabled: false,
    });

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(onUpdate).not.toHaveBeenCalled();
    monitor.stop();
  });

  test("caches stores and does not re-fetch on every poll", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    expect(mockGetStoresNearby).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(mockGetStoresNearby).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(mockGetStoresNearby).toHaveBeenCalledTimes(2);

    monitor.stop();
  });
});

describe("pollNow()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    mockPositionError = null;
    mockSetListGpsConfirmed.mockReset();
    mockGetStoresNearby.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("triggers immediate poll", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    // Move position far away so next poll detects "left store"
    mockPosition = { latitude: 49.0, longitude: 12.0 };
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(false, null);
    monitor.stop();
  });

  test("is a no-op after stop()", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    monitor.stop();
    mockPosition = { latitude: 49.0, longitude: 12.0 };
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test("is a no-op on the no-op monitor (gpsEnabled=false)", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate, {
      gpsEnabled: false,
    });

    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).not.toHaveBeenCalled();
    monitor.stop();
  });

  test("resets backoff timer and triggers immediate poll during backoff", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // Trigger 3 errors to enter backoff
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // Now in backoff. Fix GPS and call pollNow.
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ store_id: "store-1" })
    );
    monitor.stop();
  });
});

describe("backoff behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    mockPositionError = null;
    mockSetListGpsConfirmed.mockReset();
    mockGetStoresNearby.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("backoff doubles on each consecutive failure up to MAX_BACKOFF_MS", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 3 errors -> enter backoff at INITIAL_BACKOFF_MS
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // 1st backoff (INITIAL_BACKOFF_MS = 30s): error -> backoff doubles to 60s
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    await vi.advanceTimersByTimeAsync(50);

    // 2nd backoff (60s): error -> backoff doubles to 120s
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 2);
    await vi.advanceTimersByTimeAsync(50);

    // 3rd backoff (120s): error -> backoff doubles to 240s
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 4);
    await vi.advanceTimersByTimeAsync(50);

    // 4th backoff (240s): error -> would be 480s but capped at MAX_BACKOFF_MS (300s)
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 8);
    await vi.advanceTimersByTimeAsync(50);

    // Now recover at MAX_BACKOFF_MS
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ store_id: "store-1" })
    );
    monitor.stop();
  });

  test("normal polling resumes after backoff recovery", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 3 errors -> backoff
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // Recover on backoff timer
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    // Normal polling should be active again. Move position to trigger a change.
    mockPosition = { latitude: 49.0, longitude: 12.0 };
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(false, null);
    monitor.stop();
  });

  test("stop() clears both interval and backoff timer", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 3 errors -> backoff
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // Stop while in backoff
    monitor.stop();

    // Backoff timer should be cleared; no poll happens
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).not.toHaveBeenCalled();

    // pollNow should also be a no-op
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  test("backoff resets to INITIAL_BACKOFF_MS after recovery", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 3 errors -> enter backoff at INITIAL_BACKOFF_MS
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    // Recover immediately via pollNow (avoids backoff escalation)
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);
    expect(onUpdate).toHaveBeenCalled();
    onUpdate.mockClear();

    // Polling is restarted. Cause 3 more errors to re-enter backoff.
    // Use pollNow to trigger each error without triggering backoff timers.
    mockPositionError = new Error("GPS denied again");

    // Error 1 (from interval)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(50);
    // Error 2
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(50);
    // Error 3 -> enters backoff again. Interval is cleared.
    // The backoff timer is at INITIAL_BACKOFF_MS (30s).
    // IMPORTANT: do NOT advance more than INITIAL_BACKOFF_MS here to
    // avoid firing the backoff timer with the error still active.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(50);

    // Recover with a position far from store to trigger a state change
    // (the monitor thinks we're in-store from the first recovery).
    mockPositionError = null;
    mockPosition = { latitude: 49.0, longitude: 12.0 };
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    expect(onUpdate).toHaveBeenCalledWith(false, null);
    monitor.stop();
  });
});

describe("concurrency guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    mockPositionError = null;
    mockSetListGpsConfirmed.mockReset();
    mockGetStoresNearby.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("pollNow is safe to call multiple times rapidly", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    mockPosition = { latitude: 49.0, longitude: 12.0 };
    monitor.pollNow();
    monitor.pollNow();
    monitor.pollNow();
    await vi.advanceTimersByTimeAsync(50);

    // onUpdate should be called exactly once (left store)
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(false, null);
    monitor.stop();
  });
});
