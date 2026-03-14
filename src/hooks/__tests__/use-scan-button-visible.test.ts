import { describe, test, expect } from "vitest";
import { useScanButtonVisible } from "../use-scan-button-visible";

describe("useScanButtonVisible", () => {
  // --- hasCartItems = true (highest priority: always visible) ---

  test("returns true when cart has items, regardless of all other flags", () => {
    expect(useScanButtonVisible(true, false, false, true, false)).toBe(true);
    expect(useScanButtonVisible(true, true, false, true, false)).toBe(true);
    expect(useScanButtonVisible(false, false, false, true, false)).toBe(true);
    expect(useScanButtonVisible(true, false, true, true, false)).toBe(true);
  });

  // --- GPS disabled ---

  test("returns true when GPS is disabled and no cart items", () => {
    expect(useScanButtonVisible(false, false, false, false, false)).toBe(true);
  });

  test("returns true when GPS is disabled even if gpsError is also set", () => {
    expect(useScanButtonVisible(false, false, true, false, false)).toBe(true);
  });

  // --- GPS error fallback ---

  test("returns true when GPS is enabled but has an error", () => {
    expect(useScanButtonVisible(true, false, true, false, false)).toBe(true);
  });

  // --- In store ---

  test("returns true when GPS is enabled, no error, and user is in store", () => {
    expect(useScanButtonVisible(true, true, false, false, false)).toBe(true);
  });

  // --- Default store selected ---

  test("returns true when a default store is selected even if GPS says not in store", () => {
    expect(useScanButtonVisible(true, false, false, false, true)).toBe(true);
  });

  test("returns true with default store and GPS disabled", () => {
    expect(useScanButtonVisible(false, false, false, false, true)).toBe(true);
  });

  // --- At home (all conditions false except gpsEnabled) ---

  test("returns false when GPS is enabled, no error, not in store, no cart items, no default store", () => {
    expect(useScanButtonVisible(true, false, false, false, false)).toBe(false);
  });

  // --- Option A: leave store with items ---

  test("stays true when user leaves store but has cart items", () => {
    expect(useScanButtonVisible(true, false, false, true, false)).toBe(true);
  });

  // --- Exhaustive: only one combination hides the button ---

  test("returns false only when GPS enabled, not in store, no error, no cart, no default store", () => {
    const allCombinations: Array<[boolean, boolean, boolean, boolean, boolean]> = [];
    for (const gps of [true, false]) {
      for (const store of [true, false]) {
        for (const err of [true, false]) {
          for (const cart of [true, false]) {
            for (const def of [true, false]) {
              allCombinations.push([gps, store, err, cart, def]);
            }
          }
        }
      }
    }

    const hiddenCases = allCombinations.filter(
      (args) => !useScanButtonVisible(...args),
    );

    expect(hiddenCases).toEqual([[true, false, false, false, false]]);
  });
});
