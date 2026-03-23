import { describe, expect, test } from "vitest";
import { formatRelativeTimePast } from "@/lib/utils/format-relative-time";

describe("formatRelativeTimePast", () => {
  test("returns a non-empty string for a date in the past", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const out = formatRelativeTimePast(past, "de");
    expect(out.length).toBeGreaterThan(0);
  });

  test("returns empty string for invalid iso", () => {
    expect(formatRelativeTimePast("not-a-date", "de")).toBe("");
  });
});
