import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/store/store-service", () => ({
  getCurrentPosition: vi.fn().mockRejectedValue(new Error("no GPS")),
}));

// getCountryFromDevice bails early when window is undefined (SSR guard).
// Define a minimal window so the function reaches the timezone fallback.
const hadWindow = typeof globalThis.window !== "undefined";
if (!hadWindow) {
  (globalThis as Record<string, unknown>).window = {};
}

afterAll(() => {
  if (!hadWindow) {
    delete (globalThis as Record<string, unknown>).window;
  }
});

describe("fallbackCountryFromTimezone (via getCountryFromDevice)", () => {
  const originalDateTimeFormat = Intl.DateTimeFormat;

  beforeEach(() => {
    Intl.DateTimeFormat = originalDateTimeFormat;
    vi.resetModules();
  });

  function mockTimezone(tz: string) {
    Intl.DateTimeFormat = vi.fn(() => ({
      resolvedOptions: () => ({ timeZone: tz }),
    })) as unknown as typeof Intl.DateTimeFormat;
  }

  test("returns NZ for Pacific/Auckland timezone", async () => {
    mockTimezone("Pacific/Auckland");
    const { getCountryFromDevice } = await import("../country-from-device");
    const country = await getCountryFromDevice();
    expect(country).toBe("NZ");
  });

  test("returns NZ for Pacific/Chatham timezone", async () => {
    mockTimezone("Pacific/Chatham");
    const { getCountryFromDevice } = await import("../country-from-device");
    const country = await getCountryFromDevice();
    expect(country).toBe("NZ");
  });

  test("returns AT for Europe/Vienna timezone", async () => {
    mockTimezone("Europe/Vienna");
    const { getCountryFromDevice } = await import("../country-from-device");
    const country = await getCountryFromDevice();
    expect(country).toBe("AT");
  });

  test("returns DE for Europe/Berlin timezone (default fallback)", async () => {
    mockTimezone("Europe/Berlin");
    const { getCountryFromDevice } = await import("../country-from-device");
    const country = await getCountryFromDevice();
    expect(country).toBe("DE");
  });
});
