import { describe, test, expect } from "vitest";
import { computeActivationTime } from "../list-data-helpers";

describe("computeActivationTime", () => {
  test("returns activation timestamp for DE (Europe/Berlin)", () => {
    const ts = computeActivationTime("2026-03-09", "DE");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("returns activation timestamp for AT (Europe/Vienna)", () => {
    const ts = computeActivationTime("2026-03-09", "AT");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("returns activation timestamp for NZ (Pacific/Auckland)", () => {
    const ts = computeActivationTime("2026-03-09", "NZ");
    expect(ts).toBeTypeOf("number");
    expect(ts).toBeGreaterThan(0);
  });

  test("NZ activation differs from DE due to timezone offset", () => {
    const tsDE = computeActivationTime("2026-03-09", "DE");
    const tsNZ = computeActivationTime("2026-03-09", "NZ");
    expect(tsNZ).not.toBe(tsDE);
  });

  test("unknown country falls back to Europe/Berlin (same as DE)", () => {
    const tsDE = computeActivationTime("2026-03-09", "DE");
    const tsUnknown = computeActivationTime("2026-03-09", "XX");
    expect(tsUnknown).toBe(tsDE);
  });
});
