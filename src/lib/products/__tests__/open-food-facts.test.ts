import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchOpenFoodFacts } from "../open-food-facts";

describe("fetchOpenFoodFacts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  test("returns product data on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        product: {
          product_name: "Milch",
          brands: "Milbona",
        },
      }),
    });

    const result = await fetchOpenFoodFacts("4001234567890");

    expect(result).toEqual(expect.objectContaining({
      name: "Milch",
      brand: "Milbona",
    }));
  });

  test("returns null when API responds with non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await fetchOpenFoodFacts("0000000000000");

    expect(result).toBeNull();
  });

  test("returns null when fetch is aborted by timeout", async () => {
    let rejectFetch: (reason: unknown) => void;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((resolve, reject) => {
        rejectFetch = reject;
        opts.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    const promise = fetchOpenFoodFacts("9999999999999");

    vi.advanceTimersByTime(4_000);

    const result = await promise;
    expect(result).toBeNull();
    // Ensure fetch was actually called
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    void rejectFetch;
  });

  test("returns null when fetch throws a network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchOpenFoodFacts("1111111111111");

    expect(result).toBeNull();
  });
});
