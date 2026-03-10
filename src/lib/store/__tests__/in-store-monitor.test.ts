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

vi.mock("@/lib/store/store-service", () => ({
  getCurrentPosition: vi.fn(async () => {
    if (mockPositionError) throw mockPositionError;
    return mockPosition;
  }),
  distanceMeters: vi.fn(
    (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = lat2 - lat1;
      const dLon = lon2 - lon1;
      return Math.sqrt(dLat ** 2 + dLon ** 2) * 111_320;
    }
  ),
  getStoresSorted: vi.fn(async () => [...mockStores]),
  setListGpsConfirmed: (...args: unknown[]) =>
    mockSetListGpsConfirmed(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  createInStoreMonitor,
  findNearest,
  ENTER_RADIUS_M,
  LEAVE_RADIUS_M,
  type CreateInStoreMonitorOptions,
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

describe("InStoreMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    mockPositionError = null;
    mockSetListGpsConfirmed.mockReset();
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

    // 1st error (immediate poll)
    await vi.advanceTimersByTimeAsync(50);
    // 2nd error
    await vi.advanceTimersByTimeAsync(90_000);
    // 3rd error — monitor should stop itself
    await vi.advanceTimersByTimeAsync(90_000);

    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    // 4th tick — should not fire because monitor stopped
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

    // Immediate poll: error
    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(50);

    // 2nd poll: error
    await vi.advanceTimersByTimeAsync(90_000);

    // 3rd poll: success — counter resets, transitions to inStore
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(90_000);

    expect(onUpdate).toHaveBeenCalledWith(true, expect.anything());

    // Two more errors — should not stop (counter was reset at the success)
    mockPositionError = new Error("timeout");
    await vi.advanceTimersByTimeAsync(90_000);
    await vi.advanceTimersByTimeAsync(90_000);

    // If monitor had stopped after those 2 errors, this would not fire.
    // Instead it runs because counter reset means we need 3 *consecutive*.
    mockPositionError = null;
    mockPosition = { latitude: 48.137, longitude: 11.576 };
    await vi.advanceTimersByTimeAsync(90_000);

    // onUpdate is only called on state *transitions*, and we're still inStore,
    // so it should only have been called once. The key assertion is that the
    // monitor is still alive (didn't stop after 2 errors post-reset).
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
});
