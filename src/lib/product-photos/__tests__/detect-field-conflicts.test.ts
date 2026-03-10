import { describe, test, expect } from "vitest";
import { detectFieldConflicts } from "../detect-field-conflicts";

describe("detectFieldConflicts", () => {
  test("detects differing values", () => {
    const current = { name: "Milka Schokolade", price: "2,49" };
    const ai = { name: "Alpenmilch Schokolade", price: "1,29" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].field).toBe("name");
    expect(conflicts[0].currentValue).toBe("Milka Schokolade");
    expect(conflicts[0].aiValue).toBe("Alpenmilch Schokolade");
  });

  test("skips empty current values", () => {
    const current = { name: "", brand: "" };
    const ai = { name: "Product Name", brand: "Brand X" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });

  test("skips locked fields", () => {
    const current = { name: "My Name", price: "3,00" };
    const ai = { name: "AI Name", price: "2,50" };
    const conflicts = detectFieldConflicts(current, ai, new Set(["name"]));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].field).toBe("price");
  });

  test("treats identical values as non-conflicting", () => {
    const current = { name: "Same Name" };
    const ai = { name: "Same Name" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });

  test("normalizes comma vs dot in price comparison", () => {
    const current = { price: "1,29" };
    const ai = { price: "1.29" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });

  test("normalizes whitespace differences", () => {
    const current = { name: "Alpenmilch  Schokolade" };
    const ai = { name: "Alpenmilch Schokolade" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });

  test("is case-insensitive", () => {
    const current = { brand: "ALDI" };
    const ai = { brand: "aldi" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });

  test("skips empty AI values", () => {
    const current = { name: "My Product" };
    const ai = { name: "" };
    const conflicts = detectFieldConflicts(current, ai, new Set());
    expect(conflicts).toHaveLength(0);
  });
});
