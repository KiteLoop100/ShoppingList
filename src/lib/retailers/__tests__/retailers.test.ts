import { describe, test, expect } from "vitest";
import {
  getRetailersForCountry,
  getRetailerById,
  getRetailerByName,
  isHomeRetailer,
  normalizeRetailerName,
  RETAILERS,
} from "../retailers";

describe("retailers", () => {
  describe("getRetailersForCountry", () => {
    test("returns NZ retailers for country NZ", () => {
      const nz = getRetailersForCountry("NZ");
      const names = nz.map((r) => r.name);
      expect(names).toContain("Woolworths");
      expect(names).toContain("New World");
      expect(names).toContain("PAK'nSAVE");
      expect(names).toContain("Four Square");
      expect(names).toContain("The Warehouse");
      expect(nz).toHaveLength(5);
    });

    test("returns DE retailers for country DE", () => {
      const de = getRetailersForCountry("DE");
      expect(de.length).toBeGreaterThanOrEqual(8);
      expect(de.map((r) => r.name)).toContain("ALDI");
      expect(de.map((r) => r.name)).toContain("LIDL");
    });

    test("NZ and DE retailers do not overlap", () => {
      const nzIds = new Set(getRetailersForCountry("NZ").map((r) => r.id));
      const deIds = new Set(getRetailersForCountry("DE").map((r) => r.id));
      const overlap = [...nzIds].filter((id) => deIds.has(id));
      expect(overlap).toEqual([]);
    });

    test("returns empty array for unknown country", () => {
      expect(getRetailersForCountry("XX")).toEqual([]);
    });
  });

  describe("isHomeRetailer", () => {
    test("returns false for NZ retailer names", () => {
      expect(isHomeRetailer("Woolworths")).toBe(false);
      expect(isHomeRetailer("New World")).toBe(false);
      expect(isHomeRetailer("PAK'nSAVE")).toBe(false);
      expect(isHomeRetailer("Four Square")).toBe(false);
      expect(isHomeRetailer("The Warehouse")).toBe(false);
    });

    test("returns true for ALDI variants", () => {
      expect(isHomeRetailer("ALDI")).toBe(true);
      expect(isHomeRetailer("aldi süd")).toBe(true);
      expect(isHomeRetailer("Hofer")).toBe(true);
    });
  });

  describe("getRetailerById", () => {
    test("finds NZ retailers by id", () => {
      expect(getRetailerById("woolworths")?.name).toBe("Woolworths");
      expect(getRetailerById("paknsave")?.name).toBe("PAK'nSAVE");
      expect(getRetailerById("newworld")?.name).toBe("New World");
      expect(getRetailerById("foursquare")?.name).toBe("Four Square");
      expect(getRetailerById("thewarehouse")?.name).toBe("The Warehouse");
    });
  });

  describe("getRetailerByName", () => {
    test("finds NZ retailers by name (case-insensitive)", () => {
      expect(getRetailerByName("woolworths")?.id).toBe("woolworths");
      expect(getRetailerByName("PAK'nSAVE")?.id).toBe("paknsave");
      expect(getRetailerByName("new world")?.id).toBe("newworld");
    });
  });

  describe("normalizeRetailerName", () => {
    test("returns canonical name for known NZ retailers", () => {
      expect(normalizeRetailerName("Woolworths")).toBe("Woolworths");
      expect(normalizeRetailerName("New World")).toBe("New World");
    });

    test("returns null for unknown names", () => {
      expect(normalizeRetailerName("UnknownShop")).toBeNull();
    });
  });

  describe("RETAILERS array", () => {
    test("all entries have unique ids", () => {
      const ids = RETAILERS.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("all NZ entries have country NZ", () => {
      const nzRetailers = RETAILERS.filter((r) => r.countries.includes("NZ"));
      for (const r of nzRetailers) {
        expect(r.countries).toEqual(["NZ"]);
      }
    });
  });
});
