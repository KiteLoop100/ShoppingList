import { describe, test, expect, beforeEach } from "vitest";

const mockStorage = new Map<string, string>();
const hadWindow = typeof globalThis.window !== "undefined";
if (!hadWindow) {
  (globalThis as Record<string, unknown>).window = {};
}
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  },
  writable: true,
  configurable: true,
});

import {
  productKey,
  getRetailerForProduct,
  setRetailerForProduct,
} from "../retailer-memory";

describe("retailer-memory", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe("productKey", () => {
    test("uses pid prefix for products with productId", () => {
      expect(productKey("abc123", "Milch")).toBe("pid:abc123");
    });

    test("uses name prefix for generic products (no productId)", () => {
      expect(productKey(null, "Hafermilch")).toBe("name:hafermilch");
    });

    test("normalizes name to lowercase and trims whitespace", () => {
      expect(productKey(null, "  Bio Butter  ")).toBe("name:bio butter");
    });

    test("pid takes precedence even when displayName is provided", () => {
      expect(productKey("x1", "Butter")).toBe("pid:x1");
    });
  });

  describe("getRetailerForProduct", () => {
    test("returns null when no memory exists", () => {
      expect(getRetailerForProduct("prod-1", "Milch")).toBeNull();
    });

    test("returns stored retailer", () => {
      setRetailerForProduct("prod-1", "Milch", "REWE");
      expect(getRetailerForProduct("prod-1", "Milch")).toBe("REWE");
    });

    test("returns null for unknown product", () => {
      setRetailerForProduct("prod-1", "Milch", "REWE");
      expect(getRetailerForProduct("prod-2", "Butter")).toBeNull();
    });

    test("works with generic products (null productId)", () => {
      setRetailerForProduct(null, "Hafermilch", "EDEKA");
      expect(getRetailerForProduct(null, "Hafermilch")).toBe("EDEKA");
    });

    test("handles corrupted localStorage gracefully", () => {
      mockStorage.set("retailer-memory", "not-valid-json{{{");
      expect(getRetailerForProduct("prod-1", "Milch")).toBeNull();
    });
  });

  describe("setRetailerForProduct", () => {
    test("stores and retrieves retailer", () => {
      setRetailerForProduct("prod-1", "Milch", "Lidl");
      expect(getRetailerForProduct("prod-1", "Milch")).toBe("Lidl");
    });

    test("overwrites previous retailer for same product", () => {
      setRetailerForProduct("prod-1", "Milch", "REWE");
      setRetailerForProduct("prod-1", "Milch", "EDEKA");
      expect(getRetailerForProduct("prod-1", "Milch")).toBe("EDEKA");
    });

    test("supports multiple products", () => {
      setRetailerForProduct("prod-1", "Milch", "REWE");
      setRetailerForProduct("prod-2", "Butter", "Lidl");
      expect(getRetailerForProduct("prod-1", "Milch")).toBe("REWE");
      expect(getRetailerForProduct("prod-2", "Butter")).toBe("Lidl");
    });
  });

  describe("eviction", () => {
    test("evicts oldest entries when exceeding MAX_ENTRIES (500)", () => {
      for (let i = 0; i < 505; i++) {
        setRetailerForProduct(`prod-${i}`, `Product ${i}`, "REWE");
      }

      expect(getRetailerForProduct("prod-0", "Product 0")).toBeNull();
      expect(getRetailerForProduct("prod-4", "Product 4")).toBeNull();

      expect(getRetailerForProduct("prod-5", "Product 5")).toBe("REWE");
      expect(getRetailerForProduct("prod-504", "Product 504")).toBe("REWE");
    });

    test("reinserted key moves to end of order (not evicted early)", () => {
      for (let i = 0; i < 500; i++) {
        setRetailerForProduct(`prod-${i}`, `Product ${i}`, "REWE");
      }

      // Re-insert prod-0 — moves it from position 0 to the end
      setRetailerForProduct("prod-0", "Product 0", "EDEKA");
      // Now order: [prod-1..prod-499, prod-0], still 500 entries

      // Add one more — triggers eviction of oldest (prod-1)
      setRetailerForProduct("prod-new1", "New1", "Lidl");

      // prod-0 was moved to end, so it survives eviction
      expect(getRetailerForProduct("prod-0", "Product 0")).toBe("EDEKA");
      // prod-1 was oldest after prod-0 was reinserted, so it gets evicted
      expect(getRetailerForProduct("prod-1", "Product 1")).toBeNull();
      // prod-2 survives (not yet evicted)
      expect(getRetailerForProduct("prod-2", "Product 2")).toBe("REWE");
    });
  });
});
