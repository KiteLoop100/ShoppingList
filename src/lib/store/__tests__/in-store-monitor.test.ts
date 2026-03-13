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
const mockGetStoresSorted = vi.fn(async () => [...mockStores]);

vi.mock("@/lib/store/store-service", () => ({
  getCurrentPosition: vi.fn(async () => {
    if (mockPositionError) throw mockPositionError;
    return mockPosition;
  }),
  getStoresSorted: (...args: unknown[]) => mockGetStoresSorted(...args),
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
    mockGetStoresSorted.mockClear();
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
    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.objectContaining({ store_id: "store-1" }));
    monitor.stop();
  });

  test("stops after MAX_CONSECUTIVE_ERRORS (3) GPS errors", async () => {
    const onUpdate = vi.fn();
    mockPositionError = new Error("GPS denied");
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(90_000);
    await vi.advanceTimersByTimeAsync(90_000);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).not.toHaveBeenCalled();
    monitor.stop();
  });

  test("stop() cleans up interval", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    await vi.advanceTimersByTimeAsync(50);
    onUpdate.mockClear();

    monitor.stop();

    await vi.advanceTimersByTimeAsync(90_000);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  test("resets consecutive error count on success", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(90_000);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.anything());

    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(90_000);
    await vi.advanceTimersByTimeAsync(90_000);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  test("returns no-op monitor when gpsEnabled is false", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate, {
      gpsEnabled: false,
    });

    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).not.toHaveBeenCalled();
    monitor.stop();
  });

  test("caches stores and does not re-fetch on every poll", async () => {
    const onUpdate = vi.fn();
    const monitor = createInStoreMonitor("list-1", false, onUpdate);

    // 1st poll: fetches stores
    await vi.advanceTimersByTimeAsync(50);
    expect(mockGetStoresSorted).toHaveBeenCalledTimes(1);

    // 2nd–4th polls: uses cache (polls 1-3 after initial)
    await vi.advanceTimersByTimeAsync(90_000);
    await vi.advanceTimersByTimeAsync(90_000);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(mockGetStoresSorted).toHaveBeenCalledTimes(1);

    // 5th poll: refreshes cache (poll index 4, 4 % 5 === 4, still cached)
    await vi.advanceTimersByTimeAsync(90_000);
    // 6th poll: index 5, 5 % 5 === 0 => refreshes
    await vi.advanceTimersByTimeAsync(90_000);
    expect(mockGetStoresSorted).toHaveBeenCalledTimes(2);

    monitor.stop();
  });
});
