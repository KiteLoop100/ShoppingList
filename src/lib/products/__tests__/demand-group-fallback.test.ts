import { describe, test, expect } from "vitest";
import { getDemandGroupFallback } from "../demand-group-fallback";

describe("getDemandGroupFallback", () => {
  test("matches dairy products", () => {
    expect(getDemandGroupFallback("Vollmilch 3,5%")?.demand_group).toBe("83");
    expect(getDemandGroupFallback("Bio Joghurt Natur")?.demand_group).toBe("83");
    expect(getDemandGroupFallback("Frische Sahne")?.demand_group).toBe("83");
  });

  test("matches butter with sub-group", () => {
    const result = getDemandGroupFallback("Butter 250g");
    expect(result?.demand_group).toBe("83");
    expect(result?.demand_sub_group).toBe("83-04");
  });

  test("compound words like 'Markenbutter' need standalone 'butter' (word boundary)", () => {
    expect(getDemandGroupFallback("Deutsche Markenbutter")).toBeNull();
  });

  test("matches cheese", () => {
    expect(getDemandGroupFallback("Gouda jung")?.demand_group).toBe("84");
    expect(getDemandGroupFallback("Mozzarella 125g")?.demand_group).toBe("84");
  });

  test("matches bread/bakery", () => {
    expect(getDemandGroupFallback("Toast 500g")?.demand_group).toBe("57");
    expect(getDemandGroupFallback("Croissant 4er")?.demand_group).toBe("57");
    expect(getDemandGroupFallback("Brötchen 6er")?.demand_group).toBe("57");
  });

  test("matches cleaning products", () => {
    expect(getDemandGroupFallback("Spülmittel Classic")?.demand_group).toBe("06");
  });

  test("matches plant-based milk with sub-group", () => {
    const result = getDemandGroupFallback("Bio Haferdrink Barista");
    expect(result?.demand_group).toBe("50");
    expect(result?.demand_sub_group).toBe("50-04");
  });

  test("matches pasta with sub-group", () => {
    const result = getDemandGroupFallback("Spaghetti No.5");
    expect(result?.demand_group).toBe("54");
    expect(result?.demand_sub_group).toBe("54-02");
  });

  test("matches fruits", () => {
    expect(getDemandGroupFallback("Bananen")?.demand_group).toBe("58");
  });

  test("matches vegetables", () => {
    expect(getDemandGroupFallback("Tomaten 500g")?.demand_group).toBe("38");
  });

  test("returns null for unknown products", () => {
    expect(getDemandGroupFallback("ABCXYZ")).toBeNull();
    expect(getDemandGroupFallback("")).toBeNull();
  });

  test("returns null for invalid inputs", () => {
    expect(getDemandGroupFallback(null as unknown as string)).toBeNull();
    expect(getDemandGroupFallback(undefined as unknown as string)).toBeNull();
  });

  test("matches case-insensitively", () => {
    expect(getDemandGroupFallback("MILCH")?.demand_group).toBe("83");
    expect(getDemandGroupFallback("milch")?.demand_group).toBe("83");
    expect(getDemandGroupFallback("Milch")?.demand_group).toBe("83");
  });

  test("matches pet food", () => {
    expect(getDemandGroupFallback("Katzenfutter Gelee")?.demand_group).toBe("85");
  });

  test("matches beer", () => {
    expect(getDemandGroupFallback("Pils 0,5l")?.demand_group).toBe("04");
  });
});
