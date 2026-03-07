import { describe, test, expect } from "vitest";
import { storeMatchRelevance, filterAndSortStores } from "../store-filter";
import type { LocalStore } from "@/lib/db";

function makeStore(overrides: Partial<LocalStore> = {}): LocalStore {
  return {
    store_id: "s1",
    name: "ALDI SÜD Musterstraße",
    address: "Musterstraße 12",
    city: "München",
    postal_code: "80333",
    country: "DE",
    latitude: 48.14,
    longitude: 11.58,
    has_sorting_data: false,
    sorting_data_quality: 0,
    retailer: "ALDI SÜD",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("storeMatchRelevance", () => {
  test("returns 4 for retailer match", () => {
    const store = makeStore({ retailer: "REWE" });
    expect(storeMatchRelevance(store, "rewe")).toBe(4);
  });

  test("returns 3 for city match", () => {
    const store = makeStore({ city: "Berlin" });
    expect(storeMatchRelevance(store, "berlin")).toBe(3);
  });

  test("returns 2 for name match", () => {
    const store = makeStore({ name: "EDEKA Leopoldstraße" });
    expect(storeMatchRelevance(store, "edeka")).toBe(2);
  });

  test("returns 1 for address match only", () => {
    const store = makeStore({
      retailer: "ALDI SÜD",
      name: "ALDI SÜD Filiale",
      city: "München",
      address: "Sendlinger Straße 42",
    });
    expect(storeMatchRelevance(store, "sendlinger")).toBe(1);
  });

  test("returns 0 for no match", () => {
    const store = makeStore();
    expect(storeMatchRelevance(store, "hamburg")).toBe(0);
  });
});

describe("filterAndSortStores", () => {
  test("filters by retailer and returns matches first", () => {
    const stores = [
      makeStore({ store_id: "s1", retailer: "ALDI SÜD", city: "München" }),
      makeStore({ store_id: "s2", retailer: "REWE", city: "München" }),
      makeStore({ store_id: "s3", retailer: "REWE", city: "Berlin" }),
      makeStore({ store_id: "s4", retailer: "Lidl", city: "Hamburg" }),
    ];
    const result = filterAndSortStores(stores, "rewe");
    expect(result.map((s) => s.store_id)).toEqual(["s2", "s3"]);
  });

  test("returns empty for no matches", () => {
    const stores = [makeStore({ retailer: "ALDI SÜD" })];
    expect(filterAndSortStores(stores, "netto")).toEqual([]);
  });
});
