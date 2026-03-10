import { describe, it, expect } from "vitest";
import { titleCase } from "../image-utils";

describe("titleCase", () => {
  it("capitalizes simple words", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  it("handles German characters", () => {
    expect(titleCase("über alles")).toBe("Über Alles");
  });

  it("lowercases already-capitalized words", () => {
    expect(titleCase("ALL CAPS TEXT")).toBe("All Caps Text");
  });

  it("handles empty string", () => {
    expect(titleCase("")).toBe("");
  });

  it("handles mixed case with numbers", () => {
    expect(titleCase("product 2kg ORGANIC")).toBe("Product 2Kg Organic");
  });
});
