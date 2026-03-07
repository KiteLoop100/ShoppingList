import { describe, test, expect } from "vitest";
import { KNOWN_RETAILERS } from "../known-retailers";

describe("KNOWN_RETAILERS", () => {
  test("contains major German retailers", () => {
    expect(KNOWN_RETAILERS).toContain("ALDI SÜD");
    expect(KNOWN_RETAILERS).toContain("REWE");
    expect(KNOWN_RETAILERS).toContain("EDEKA");
    expect(KNOWN_RETAILERS).toContain("Lidl");
    expect(KNOWN_RETAILERS).toContain("Penny");
  });

  test("contains Austrian retailers", () => {
    expect(KNOWN_RETAILERS).toContain("Hofer");
    expect(KNOWN_RETAILERS).toContain("SPAR");
    expect(KNOWN_RETAILERS).toContain("Billa");
  });

  test("contains NZ retailers", () => {
    expect(KNOWN_RETAILERS).toContain("PAK'nSAVE");
    expect(KNOWN_RETAILERS).toContain("New World");
    expect(KNOWN_RETAILERS).toContain("Woolworths");
  });

  test("has no duplicates", () => {
    const unique = new Set(KNOWN_RETAILERS);
    expect(unique.size).toBe(KNOWN_RETAILERS.length);
  });
});
