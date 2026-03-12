import { describe, test, expect } from "vitest";
import { getThawShelfLifeDays } from "../thaw-shelf-life";

describe("getThawShelfLifeDays", () => {
  test("returns 2 days for fresh meat (62)", () => {
    expect(getThawShelfLifeDays("62")).toBe(2);
  });

  test("returns 2 days for poultry (67)", () => {
    expect(getThawShelfLifeDays("67")).toBe(2);
  });

  test("returns 1 day for fresh fish (64)", () => {
    expect(getThawShelfLifeDays("64")).toBe(1);
  });

  test("returns 1 day for ready-to-eat fish (71)", () => {
    expect(getThawShelfLifeDays("71")).toBe(1);
  });

  test("returns 3 days for cold cuts (69)", () => {
    expect(getThawShelfLifeDays("69")).toBe(3);
  });

  test("returns 2 days for frozen meat/fish (75, natively frozen)", () => {
    expect(getThawShelfLifeDays("75")).toBe(2);
  });

  test("returns 1 day for frozen ready meals (78, natively frozen)", () => {
    expect(getThawShelfLifeDays("78")).toBe(1);
  });

  test("returns 2 days for produce (38)", () => {
    expect(getThawShelfLifeDays("38")).toBe(2);
  });

  test("returns default 3 days for unknown codes", () => {
    expect(getThawShelfLifeDays("99")).toBe(3);
  });

  test("returns default 3 days for null", () => {
    expect(getThawShelfLifeDays(null)).toBe(3);
  });
});
