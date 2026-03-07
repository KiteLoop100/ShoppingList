import { describe, test, expect } from "vitest";
import { extractDemandGroupCode } from "../categorize-competitor-product";

describe("extractDemandGroupCode", () => {
  test("extracts code from '##-Name' format", () => {
    expect(extractDemandGroupCode("83-Milch/Sahne/Butter")).toBe("83");
    expect(extractDemandGroupCode("06-Wasch-/Putz-/Reinigungsmittel")).toBe("06");
    expect(extractDemandGroupCode("01-Spirituosen")).toBe("01");
  });

  test("extracts bare numeric codes", () => {
    expect(extractDemandGroupCode("83")).toBe("83");
    expect(extractDemandGroupCode("06")).toBe("06");
    expect(extractDemandGroupCode("01")).toBe("01");
  });

  test("handles whitespace around input", () => {
    expect(extractDemandGroupCode("  83-Milch  ")).toBe("83");
    expect(extractDemandGroupCode(" 06 ")).toBe("06");
  });

  test("returns null for empty/null/undefined", () => {
    expect(extractDemandGroupCode(null)).toBeNull();
    expect(extractDemandGroupCode(undefined)).toBeNull();
    expect(extractDemandGroupCode("")).toBeNull();
    expect(extractDemandGroupCode("   ")).toBeNull();
  });

  test("returns null for non-numeric strings", () => {
    expect(extractDemandGroupCode("Milch")).toBeNull();
    expect(extractDemandGroupCode("abc")).toBeNull();
  });

  test("handles sub-group format (returns the leading digits)", () => {
    expect(extractDemandGroupCode("83-02")).toBe("83");
    expect(extractDemandGroupCode("56-06-Brötchen")).toBe("56");
  });
});
