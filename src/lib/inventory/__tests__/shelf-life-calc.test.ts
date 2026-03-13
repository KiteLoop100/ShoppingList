import { describe, test, expect } from "vitest";
import { calculateBestBefore } from "../shelf-life-calc";

describe("calculateBestBefore", () => {
  test("computes correct date for valid inputs", () => {
    expect(calculateBestBefore("2026-03-01", 14)).toBe("2026-03-15");
  });

  test("handles month boundary", () => {
    expect(calculateBestBefore("2026-01-25", 10)).toBe("2026-02-04");
  });

  test("handles year boundary", () => {
    expect(calculateBestBefore("2025-12-28", 7)).toBe("2026-01-04");
  });

  test("returns null when purchaseDate is null", () => {
    expect(calculateBestBefore(null, 14)).toBeNull();
  });

  test("returns null when purchaseDate is undefined", () => {
    expect(calculateBestBefore(undefined, 14)).toBeNull();
  });

  test("returns null when shelfLifeDays is null", () => {
    expect(calculateBestBefore("2026-03-01", null)).toBeNull();
  });

  test("returns null when shelfLifeDays is undefined", () => {
    expect(calculateBestBefore("2026-03-01", undefined)).toBeNull();
  });

  test("returns null when shelfLifeDays is zero", () => {
    expect(calculateBestBefore("2026-03-01", 0)).toBeNull();
  });

  test("returns null when shelfLifeDays is negative", () => {
    expect(calculateBestBefore("2026-03-01", -5)).toBeNull();
  });

  test("returns null for invalid date string", () => {
    expect(calculateBestBefore("not-a-date", 14)).toBeNull();
  });

  test("returns null for empty string purchase date", () => {
    expect(calculateBestBefore("", 14)).toBeNull();
  });

  test("handles single day shelf life", () => {
    expect(calculateBestBefore("2026-03-13", 1)).toBe("2026-03-14");
  });

  test("handles large shelf life (1 year)", () => {
    expect(calculateBestBefore("2026-01-01", 365)).toBe("2027-01-01");
  });
});
