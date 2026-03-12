import { describe, test, expect } from "vitest";
import { getExpiryColor, formatBestBefore } from "../expiry-color";

describe("getExpiryColor", () => {
  const ref = new Date(2026, 2, 12); // 2026-03-12

  test("returns default when bestBefore is null", () => {
    expect(getExpiryColor(null, null, ref)).toBe("default");
  });

  test("returns default when bestBefore is in the future", () => {
    expect(getExpiryColor("2026-03-20", null, ref)).toBe("default");
  });

  test("returns default when bestBefore is tomorrow", () => {
    expect(getExpiryColor("2026-03-13", null, ref)).toBe("default");
  });

  test("returns warning when bestBefore is today", () => {
    expect(getExpiryColor("2026-03-12", null, ref)).toBe("warning");
  });

  test("returns warning when bestBefore is in the past without purchaseDate", () => {
    expect(getExpiryColor("2026-03-10", null, ref)).toBe("warning");
  });

  test("returns warning when expired but within 30% threshold", () => {
    // Purchased 2026-03-02, best_before 2026-03-12 → 10 day shelf life
    // Expired 0 days ago → 0 / (10 * 0.3) = 0 < 3 → warning
    expect(getExpiryColor("2026-03-12", "2026-03-02", ref)).toBe("warning");
  });

  test("returns warning when expired by 2 days with 10-day shelf life (within 30%)", () => {
    // 10 day shelf life, 30% = 3 days. 2 days overdue → warning
    expect(getExpiryColor("2026-03-10", "2026-02-28", ref)).toBe("warning");
  });

  test("returns danger when expired by 4 days with 10-day shelf life (>30%)", () => {
    // 10 day shelf life, 30% = 3 days. 4 days overdue → danger
    expect(getExpiryColor("2026-03-08", "2026-02-26", ref)).toBe("danger");
  });

  test("returns warning when purchaseDate equals bestBefore (0-day shelf life)", () => {
    expect(getExpiryColor("2026-03-10", "2026-03-10", ref)).toBe("warning");
  });

  test("returns warning when purchaseDate is after bestBefore (data entry error)", () => {
    expect(getExpiryColor("2026-03-05", "2026-03-10", ref)).toBe("warning");
  });

  test("returns default for invalid date format", () => {
    expect(getExpiryColor("not-a-date", null, ref)).toBe("default");
  });

  test("returns default for very far future bestBefore", () => {
    expect(getExpiryColor("2030-12-31", null, ref)).toBe("default");
  });

  test("returns danger when significantly expired with known purchase date", () => {
    // Purchased 2026-02-12, best_before 2026-02-22 → 10 day shelf life
    // Now 2026-03-12 → 18 days overdue → 18 > 3 → danger
    expect(getExpiryColor("2026-02-22", "2026-02-12", ref)).toBe("danger");
  });
});

describe("formatBestBefore", () => {
  test("returns null for null input", () => {
    expect(formatBestBefore(null)).toBeNull();
  });

  test("returns null for invalid date", () => {
    expect(formatBestBefore("invalid")).toBeNull();
  });

  test("formats date in German locale", () => {
    const result = formatBestBefore("2026-03-15", "de");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/26/);
  });
});
