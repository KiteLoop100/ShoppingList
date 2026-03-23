import { describe, test, expect } from "vitest";
import {
  getSpecialActivationCalendarDate,
  computeActivationTime,
} from "../special-activation";

describe("getSpecialActivationCalendarDate", () => {
  test("Monday sale start -> Friday activation date", () => {
    expect(getSpecialActivationCalendarDate("2026-03-23")).toBe("2026-03-20");
  });

  test("Wednesday sale start -> Monday activation date", () => {
    expect(getSpecialActivationCalendarDate("2026-03-25")).toBe("2026-03-23");
  });

  test("skips Sundays when counting Werktage", () => {
    expect(getSpecialActivationCalendarDate("2026-03-09")).toBe("2026-03-06");
  });

  test("invalid input returns null", () => {
    expect(getSpecialActivationCalendarDate("")).toBeNull();
    expect(getSpecialActivationCalendarDate("not-a-date")).toBeNull();
    expect(getSpecialActivationCalendarDate("2026-13-40")).toBeNull();
  });
});

describe("computeActivationTime", () => {
  test("returns 0 for invalid calendar input", () => {
    expect(computeActivationTime("", "DE")).toBe(0);
  });

  test("local hour is 12 in Europe/Berlin for DE", () => {
    const ts = computeActivationTime("2026-03-23", "DE");
    expect(ts).toBeGreaterThan(0);
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hour12: false,
    }).format(new Date(ts));
    expect(parseInt(hourStr, 10)).toBe(12);
  });

  test("local hour is 12 in Pacific/Auckland for NZ", () => {
    const ts = computeActivationTime("2026-03-23", "NZ");
    expect(ts).toBeGreaterThan(0);
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Pacific/Auckland",
      hour: "numeric",
      hour12: false,
    }).format(new Date(ts));
    expect(parseInt(hourStr, 10)).toBe(12);
  });

  test("NZ activation instant differs from DE for same sale start", () => {
    const tsDE = computeActivationTime("2026-03-23", "DE");
    const tsNZ = computeActivationTime("2026-03-23", "NZ");
    expect(tsNZ).not.toBe(tsDE);
  });

  test("unknown country falls back to Europe/Berlin", () => {
    const tsDE = computeActivationTime("2026-03-23", "DE");
    const tsX = computeActivationTime("2026-03-23", "XX");
    expect(tsX).toBe(tsDE);
  });
});
