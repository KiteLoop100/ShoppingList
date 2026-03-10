import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => null,
}));

vi.mock("@/lib/auth/auth-context", () => ({
  getCurrentUserId: () => "anonymous",
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const hadWindow = typeof globalThis.window !== "undefined";
if (!hadWindow) {
  (globalThis as Record<string, unknown>).window = {};
}

const mockStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  },
  writable: true,
  configurable: true,
});

import { loadSettings, saveSettings, type UserSettings } from "../settings-sync";

describe("settings-sync", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  test("loadSettings returns defaults including gps_enabled: true", async () => {
    const settings = await loadSettings();
    expect(settings.gps_enabled).toBe(true);
    expect(settings.preferred_language).toBe("de");
    expect(settings.default_store_id).toBeNull();
  });

  test("saveSettings persists gps_enabled to localStorage cache", async () => {
    await saveSettings({ gps_enabled: false });
    const reloaded = await loadSettings();
    expect(reloaded.gps_enabled).toBe(false);
  });

  test("gps_enabled roundtrip: save then load preserves value", async () => {
    await saveSettings({ gps_enabled: false });
    const afterDisable = await loadSettings();
    expect(afterDisable.gps_enabled).toBe(false);

    await saveSettings({ gps_enabled: true });
    const afterEnable = await loadSettings();
    expect(afterEnable.gps_enabled).toBe(true);
  });

  test("saveSettings merges partial settings without losing gps_enabled", async () => {
    await saveSettings({ gps_enabled: false });
    await saveSettings({ prefer_bio: true });
    const settings = await loadSettings();
    expect(settings.gps_enabled).toBe(false);
    expect(settings.prefer_bio).toBe(true);
  });

  test("UserSettings interface includes gps_enabled field", () => {
    const settings: UserSettings = {
      preferred_language: "de",
      default_store_id: null,
      gps_enabled: true,
      exclude_gluten: false,
      exclude_lactose: false,
      exclude_nuts: false,
      prefer_cheapest: false,
      prefer_brand: false,
      prefer_bio: false,
      prefer_vegan: false,
      prefer_animal_welfare: false,
    };
    expect(settings.gps_enabled).toBe(true);
  });
});
