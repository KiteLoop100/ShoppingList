import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Product } from "@/types";
import { refreshAldiProductInDexie } from "../refresh-aldi-product-in-dexie";

const mockFetch = vi.fn();
const mockPut = vi.fn();

vi.mock("@/lib/products/fetch-aldi-product", () => ({
  fetchAldiProductByIdFromSupabase: (...args: unknown[]) => mockFetch(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    products: {
      put: (...args: unknown[]) => mockPut(...args),
    },
  },
}));

describe("refreshAldiProductInDexie", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockPut.mockReset();
  });

  test("returns null and does not write when fetch returns null", async () => {
    mockFetch.mockResolvedValueOnce(null);
    const r = await refreshAldiProductInDexie("x");
    expect(r).toBeNull();
    expect(mockPut).not.toHaveBeenCalled();
  });

  test("persists product and returns it when fetch succeeds", async () => {
    const p = { product_id: "p1", name: "N" } as Product;
    mockFetch.mockResolvedValueOnce(p);
    mockPut.mockResolvedValueOnce(undefined);
    const r = await refreshAldiProductInDexie("p1");
    expect(r).toBe(p);
    expect(mockPut).toHaveBeenCalledWith(p);
  });
});
