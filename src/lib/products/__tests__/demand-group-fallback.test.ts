import { describe, test, expect } from "vitest";
import { getDemandGroupFallback } from "../demand-group-fallback";

describe("getDemandGroupFallback", () => {
  test("matches dairy products", () => {
    expect(getDemandGroupFallback("Vollmilch 3,5%")?.demand_group).toBe("83-Milch/Sahne/Butter");
    expect(getDemandGroupFallback("Bio Joghurt Natur")?.demand_group).toBe("83-Milch/Sahne/Butter");
    expect(getDemandGroupFallback("Frische Sahne")?.demand_group).toBe("83-Milch/Sahne/Butter");
  });

  test("matches butter with sub-group", () => {
    const result = getDemandGroupFallback("Butter 250g");
    expect(result?.demand_group).toBe("83-Milch/Sahne/Butter");
    expect(result?.demand_sub_group).toBe("04-Butter/tierische Fette");
  });

  test("compound words like 'Markenbutter' need standalone 'butter' (word boundary)", () => {
    expect(getDemandGroupFallback("Deutsche Markenbutter")).toBeNull();
  });

  test("matches cheese", () => {
    expect(getDemandGroupFallback("Gouda jung")?.demand_group).toBe("84-Käse/Käseersatzprodukte");
    expect(getDemandGroupFallback("Mozzarella 125g")?.demand_group).toBe("84-Käse/Käseersatzprodukte");
  });

  test("matches bread/bakery", () => {
    expect(getDemandGroupFallback("Toast 500g")?.demand_group).toBe("57-Brot/Kuchen");
    expect(getDemandGroupFallback("Croissant 4er")?.demand_group).toBe("57-Brot/Kuchen");
    expect(getDemandGroupFallback("Brötchen 6er")?.demand_group).toBe("57-Brot/Kuchen");
  });

  test("matches cleaning products", () => {
    expect(getDemandGroupFallback("Spülmittel Classic")?.demand_group).toBe("06-Wasch-/Putz-/Reinigungsmittel");
  });

  test("matches plant-based milk with sub-group", () => {
    const result = getDemandGroupFallback("Bio Haferdrink Barista");
    expect(result?.demand_group).toBe("50-H-Milchprodukte/Milchersatzprodukte");
    expect(result?.demand_sub_group).toBe("04-Milchersatzprodukte");
  });

  test("matches pasta with sub-group", () => {
    const result = getDemandGroupFallback("Spaghetti No.5");
    expect(result?.demand_group).toBe("54-Nährmittel");
    expect(result?.demand_sub_group).toBe("02-Teigwaren");
  });

  test("matches fruits", () => {
    expect(getDemandGroupFallback("Bananen")?.demand_group).toBe("58-Obst");
  });

  test("matches vegetables", () => {
    expect(getDemandGroupFallback("Tomaten 500g")?.demand_group).toBe("38-Gemüse");
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
    expect(getDemandGroupFallback("MILCH")?.demand_group).toBe("83-Milch/Sahne/Butter");
    expect(getDemandGroupFallback("milch")?.demand_group).toBe("83-Milch/Sahne/Butter");
    expect(getDemandGroupFallback("Milch")?.demand_group).toBe("83-Milch/Sahne/Butter");
  });

  test("matches pet food", () => {
    expect(getDemandGroupFallback("Katzenfutter Gelee")?.demand_group).toBe("85-Tiernahrung");
  });

  test("matches beer", () => {
    expect(getDemandGroupFallback("Pils 0,5l")?.demand_group).toBe("04-Bier");
  });
});
