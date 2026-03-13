import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { LocalStore } from "@/lib/db";

const STORE_NEARBY: LocalStore = {
  store_id: "store-nearby",
  name: "ALDI Nahstadt",
  address: "Nahstr. 1",
  city: "Nahstadt",
  postal_code: "80331",
  country: "DE",
  latitude: 48.137,
  longitude: 11.576,
  has_sorting_data: false,
  sorting_data_quality: 0,
  retailer: "ALDI SÜD",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const STORE_FAR: LocalStore = {
  ...STORE_NEARBY,
  store_id: "store-far",
  name: "ALDI Fernstadt",
  latitude: 49.0,
  longitude: 12.0,
};

const DEFAULT_STORE: LocalStore = {
  ...STORE_NEARBY,
  store_id: "store-default",
  name: "ALDI Standard",
  latitude: 50.0,
  longitude: 10.0,
};

const STORE_AT_EDGE_150M: LocalStore = {
  ...STORE_NEARBY,
  store_id: "store-edge-150m",
  name: "Hofer Wien",
  // ~150m north of STORE_NEARBY (0.00135 deg lat ≈ 150m)
  latitude: 48.13835,
  longitude: 11.576,
};

const STORE_INVALID_COORDS: LocalStore = {
  ...STORE_NEARBY,
  store_id: "store-invalid",
  name: "Ghost Store",
  latitude: 0,
  longitude: 0,
};

let mockGeoResult: { latitude: number; longitude: number } | null = null;
let mockGeoError: GeolocationPositionError | Error | null = null;
let mockStoreList: LocalStore[] = [];
let mockDefaultStoreId: string | null = null;

const mockListPut = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    stores: {
      toArray: () => Promise.resolve(mockStoreList),
      where: (field: string) => ({
        equals: (val: string) => ({
          first: () => {
            if (field === "store_id") {
              return Promise.resolve(mockStoreList.find((s) => s.store_id === val) ?? undefined);
            }
            return Promise.resolve(undefined);
          },
        }),
      }),
    },
    lists: {
      where: () => ({
        equals: () => ({
          first: () =>
            Promise.resolve({ list_id: "list-1", store_id: null }),
        }),
      }),
      put: (...args: unknown[]) => mockListPut(...args),
    },
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => null,
}));

vi.mock("@/lib/settings/default-store", () => ({
  getDefaultStoreId: () => mockDefaultStoreId,
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function setupNavigatorMock() {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      geolocation: {
        getCurrentPosition: (
          success: PositionCallback,
          error: PositionErrorCallback
        ) => {
          if (mockGeoError) {
            error(mockGeoError as GeolocationPositionError);
          } else if (mockGeoResult) {
            success({
              coords: {
                latitude: mockGeoResult.latitude,
                longitude: mockGeoResult.longitude,
                accuracy: 10,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            } as GeolocationPosition);
          } else {
            error(new Error("No position") as unknown as GeolocationPositionError);
          }
        },
      },
    },
    writable: true,
    configurable: true,
  });
}

import {
  findNearestStore,
  detectStoreOrPosition,
  distanceMeters,
} from "@/lib/store/store-service";

describe("distanceMeters", () => {
  test("returns 0 for identical points", () => {
    expect(distanceMeters(48.137, 11.576, 48.137, 11.576)).toBeCloseTo(0, 1);
  });

  test("returns roughly correct distance for known points", () => {
    const d = distanceMeters(48.137, 11.576, 48.138, 11.576);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe("findNearestStore", () => {
  beforeEach(() => {
    mockStoreList = [STORE_NEARBY, STORE_FAR];
  });

  test("finds store within default 200m radius", async () => {
    const result = await findNearestStore(48.137, 11.576);
    expect(result).not.toBeNull();
    expect(result!.store_id).toBe("store-nearby");
  });

  test("returns null when no store within radius", async () => {
    mockStoreList = [STORE_FAR];
    const result = await findNearestStore(48.137, 11.576);
    expect(result).toBeNull();
  });

  test("respects custom radius", async () => {
    mockStoreList = [STORE_FAR];
    const result = await findNearestStore(48.137, 11.576, 200_000);
    expect(result).not.toBeNull();
    expect(result!.store_id).toBe("store-far");
  });

  test("finds store at ~150m (within new 200m radius)", async () => {
    mockStoreList = [STORE_AT_EDGE_150M];
    const result = await findNearestStore(48.137, 11.576);
    expect(result).not.toBeNull();
    expect(result!.store_id).toBe("store-edge-150m");
  });

  test("returns null for empty store list (simulates Supabase error)", async () => {
    mockStoreList = [];
    const result = await findNearestStore(48.137, 11.576);
    expect(result).toBeNull();
  });

  test("skips stores with invalid (0,0) coordinates", async () => {
    mockStoreList = [STORE_INVALID_COORDS];
    const result = await findNearestStore(48.137, 11.576);
    expect(result).toBeNull();
  });

  test("returns valid store when list mixes valid and invalid coords", async () => {
    mockStoreList = [STORE_INVALID_COORDS, STORE_NEARBY];
    const result = await findNearestStore(48.137, 11.576);
    expect(result).not.toBeNull();
    expect(result!.store_id).toBe("store-nearby");
  });
});

describe("detectStoreOrPosition", () => {
  beforeEach(() => {
    mockGeoResult = null;
    mockGeoError = null;
    mockStoreList = [];
    mockDefaultStoreId = null;
    mockListPut.mockReset();
    setupNavigatorMock();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).navigator;
  });

  test("GPS finds nearby store — returns detectedByGps: true", async () => {
    mockGeoResult = { latitude: 48.137, longitude: 11.576 };
    mockStoreList = [STORE_NEARBY];

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).not.toBeNull();
    expect(result!.detectedByGps).toBe(true);
    expect(result!.store.store_id).toBe("store-nearby");
    expect(gpsPosition).toEqual({ latitude: 48.137, longitude: 11.576 });
  });

  test("GPS OK but no store nearby — returns gpsPosition without result", async () => {
    mockGeoResult = { latitude: 48.137, longitude: 11.576 };
    mockStoreList = [STORE_FAR];
    mockDefaultStoreId = null;

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).toBeNull();
    expect(gpsPosition).toEqual({ latitude: 48.137, longitude: 11.576 });
  });

  test("GPS fails — falls back to default store", async () => {
    mockGeoError = new Error("Permission denied");
    mockStoreList = [DEFAULT_STORE];
    mockDefaultStoreId = "store-default";

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).not.toBeNull();
    expect(result!.detectedByGps).toBe(false);
    expect(result!.store.store_id).toBe("store-default");
    expect(gpsPosition).toBeNull();
  });

  test("GPS fails, no default store — returns null result", async () => {
    mockGeoError = new Error("Permission denied");
    mockDefaultStoreId = null;

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).toBeNull();
    expect(gpsPosition).toBeNull();
  });

  test("GPS OK, no store nearby, has default — uses default store", async () => {
    mockGeoResult = { latitude: 48.137, longitude: 11.576 };
    mockStoreList = [STORE_FAR, DEFAULT_STORE];
    mockDefaultStoreId = "store-default";

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).not.toBeNull();
    expect(result!.detectedByGps).toBe(false);
    expect(result!.store.store_id).toBe("store-default");
    expect(gpsPosition).toEqual({ latitude: 48.137, longitude: 11.576 });
  });

  test("GPS OK, store at 150m (within 200m radius) — detects store", async () => {
    mockGeoResult = { latitude: 48.137, longitude: 11.576 };
    mockStoreList = [STORE_AT_EDGE_150M];

    const { result } = await detectStoreOrPosition("list-1");

    expect(result).not.toBeNull();
    expect(result!.detectedByGps).toBe(true);
    expect(result!.store.store_id).toBe("store-edge-150m");
  });

  test("GPS OK, empty store list (Supabase error) — returns gpsPosition", async () => {
    mockGeoResult = { latitude: 48.137, longitude: 11.576 };
    mockStoreList = [];
    mockDefaultStoreId = null;

    const { result, gpsPosition } = await detectStoreOrPosition("list-1");

    expect(result).toBeNull();
    expect(gpsPosition).toEqual({ latitude: 48.137, longitude: 11.576 });
  });
});
