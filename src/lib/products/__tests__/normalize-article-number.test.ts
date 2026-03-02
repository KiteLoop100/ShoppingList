import { describe, it, expect } from "vitest";
import { normalizeArticleNumber } from "../normalize";

describe("normalizeArticleNumber", () => {
  it("returns null for null/undefined/empty", () => {
    expect(normalizeArticleNumber(null)).toBeNull();
    expect(normalizeArticleNumber(undefined)).toBeNull();
    expect(normalizeArticleNumber("")).toBeNull();
    expect(normalizeArticleNumber("   ")).toBeNull();
  });

  it("strips leading zeros", () => {
    expect(normalizeArticleNumber("000123456")).toBe("123456");
    expect(normalizeArticleNumber("012345")).toBe("12345");
    expect(normalizeArticleNumber("0001")).toBe("1");
  });

  it("removes non-digit characters", () => {
    expect(normalizeArticleNumber("12-345-6")).toBe("123456");
    expect(normalizeArticleNumber("ART.12345")).toBe("12345");
    expect(normalizeArticleNumber(" 123 456 ")).toBe("123456");
  });

  it("handles combined non-digits and leading zeros", () => {
    expect(normalizeArticleNumber("00-123-456")).toBe("123456");
    expect(normalizeArticleNumber("ART.007")).toBe("7");
  });

  it("passes through clean numbers unchanged", () => {
    expect(normalizeArticleNumber("123456")).toBe("123456");
    expect(normalizeArticleNumber("7890")).toBe("7890");
  });

  it("returns null for all-zero input", () => {
    expect(normalizeArticleNumber("0000")).toBeNull();
    expect(normalizeArticleNumber("000")).toBeNull();
  });

  it("returns null for input with only non-digit characters", () => {
    expect(normalizeArticleNumber("---")).toBeNull();
    expect(normalizeArticleNumber("abc")).toBeNull();
  });
});
