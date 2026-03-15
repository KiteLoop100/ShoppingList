import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateTranspositionVariants,
  tryAutoCorrectArticleNumber,
} from "../article-number-correction";

vi.mock("@/lib/products/find-existing", () => ({
  findProductByArticleNumber: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { findProductByArticleNumber } from "@/lib/products/find-existing";

const mockFind = vi.mocked(findProductByArticleNumber);
const fakeSupabase = {} as never;

describe("generateTranspositionVariants", () => {
  it("produces 5 variants for a 6-digit number", () => {
    const result = generateTranspositionVariants("123456");
    expect(result).toHaveLength(5);
    expect(result).toEqual([
      "213456",
      "132456",
      "124356",
      "123546",
      "123465",
    ]);
  });

  it("produces 1 variant for a 2-digit number", () => {
    expect(generateTranspositionVariants("12")).toEqual(["21"]);
  });

  it("produces 0 variants for a 1-digit number", () => {
    expect(generateTranspositionVariants("5")).toEqual([]);
  });

  it("skips identical-neighbour swaps (e.g. '1123')", () => {
    const result = generateTranspositionVariants("1123");
    expect(result).not.toContain("1123");
    expect(result).toHaveLength(2);
    expect(result).toEqual(["1213", "1132"]);
  });

  it("handles all-same digits", () => {
    expect(generateTranspositionVariants("111")).toEqual([]);
  });
});

describe("tryAutoCorrectArticleNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for numbers shorter than 5 digits", async () => {
    const result = await tryAutoCorrectArticleNumber(fakeSupabase, "1234");
    expect(result).toBeNull();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("returns corrected number when a variant matches", async () => {
    mockFind
      .mockResolvedValueOnce(null) // first variant: no match
      .mockResolvedValueOnce({
        product_id: "prod-1",
        matched_by: "article_number",
      });

    const result = await tryAutoCorrectArticleNumber(
      fakeSupabase,
      "123456",
      "product_id",
    );

    expect(result).not.toBeNull();
    expect(result!.correctedNumber).toBe("132456");
    expect(result!.product.product_id).toBe("prod-1");
    expect(mockFind).toHaveBeenCalledTimes(2);
  });

  it("returns null when no variant matches", async () => {
    mockFind.mockResolvedValue(null);

    const result = await tryAutoCorrectArticleNumber(
      fakeSupabase,
      "123456",
      "product_id",
    );

    expect(result).toBeNull();
    expect(mockFind).toHaveBeenCalledTimes(5);
  });

  it("returns the first matching variant, not all", async () => {
    mockFind
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        product_id: "prod-A",
        matched_by: "article_number",
      });

    const result = await tryAutoCorrectArticleNumber(
      fakeSupabase,
      "567890",
      "product_id",
    );

    expect(result!.product.product_id).toBe("prod-A");
    expect(mockFind).toHaveBeenCalledTimes(2);
  });

  it("passes the select parameter through", async () => {
    mockFind.mockResolvedValueOnce({
      product_id: "prod-1",
      matched_by: "article_number",
    });

    await tryAutoCorrectArticleNumber(
      fakeSupabase,
      "12345",
      "product_id, price",
    );

    expect(mockFind).toHaveBeenCalledWith(
      fakeSupabase,
      expect.any(String),
      "product_id, price",
    );
  });
});
