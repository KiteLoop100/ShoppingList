import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

let mockGpsEnabled = true;
const mockSaveSettings = vi.fn();

vi.mock("@/lib/settings/settings-sync", () => ({
  loadSettings: vi.fn(async () => ({
    preferred_language: "de",
    default_store_id: null,
    gps_enabled: mockGpsEnabled,
    exclude_gluten: false,
    exclude_lactose: false,
    exclude_nuts: false,
    prefer_cheapest: false,
    prefer_brand: false,
    prefer_bio: false,
    prefer_vegan: false,
    prefer_animal_welfare: false,
  })),
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { checkGpsAllowed, queryGeolocationPermission } from "../gps-permission";

describe("queryGeolocationPermission", () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).navigator;
  });

  test("returns 'unknown' when permissions API is not available", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
    const result = await queryGeolocationPermission();
    expect(result).toBe("unknown");
  });

  test("returns browser permission state", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
      },
      writable: true,
      configurable: true,
    });
    const result = await queryGeolocationPermission();
    expect(result).toBe("granted");
  });

  test("returns 'denied' when browser reports denied", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "denied" }),
        },
      },
      writable: true,
      configurable: true,
    });
    const result = await queryGeolocationPermission();
    expect(result).toBe("denied");
  });
});

describe("checkGpsAllowed", () => {
  beforeEach(() => {
    mockGpsEnabled = true;
    mockSaveSettings.mockReset();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).navigator;
  });

  test("returns not-allowed when gps_enabled setting is false", async () => {
    mockGpsEnabled = false;
    const result = await checkGpsAllowed();
    expect(result).toEqual({ allowed: false, reason: "setting-disabled" });
  });

  test("returns allowed when setting is true and browser permits", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "granted" }),
        },
      },
      writable: true,
      configurable: true,
    });
    const result = await checkGpsAllowed();
    expect(result).toEqual({ allowed: true });
  });

  test("returns allowed when setting is true and permission is prompt", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "prompt" }),
        },
      },
      writable: true,
      configurable: true,
    });
    const result = await checkGpsAllowed();
    expect(result).toEqual({ allowed: true });
  });

  test("auto-disables gps_enabled when browser permission is denied", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        permissions: {
          query: vi.fn().mockResolvedValue({ state: "denied" }),
        },
      },
      writable: true,
      configurable: true,
    });

    const result = await checkGpsAllowed();
    expect(result).toEqual({ allowed: false, reason: "browser-denied" });
    expect(mockSaveSettings).toHaveBeenCalledWith({ gps_enabled: false });
  });

  test("returns allowed when permissions API is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
    const result = await checkGpsAllowed();
    expect(result).toEqual({ allowed: true });
  });
});
