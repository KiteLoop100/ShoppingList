import { describe, test, expect, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/retailers/retailers", () => ({
  isHomeRetailer: vi.fn((name: string) => {
    const lower = name.toLowerCase().trim();
    return ["aldi", "aldi süd", "hofer"].includes(lower);
  }),
}));

import { checkForDuplicate, assertNoDuplicate, DuplicateProductError } from "../duplicate-check";

describe("checkForDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null });
  });

  test("returns not-found when no EAN or article_number provided", async () => {
    const result = await checkForDuplicate({
      targetRetailer: "ALDI",
    });
    expect(result.found).toBe(false);
    expect(result.table).toBeNull();
  });

  test("finds ALDI product by EAN, same retailer context", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { product_id: "p1", name: "Milch" } });

    const result = await checkForDuplicate({
      ean_barcode: "4001234567890",
      targetRetailer: "ALDI",
    });

    expect(result.found).toBe(true);
    expect(result.table).toBe("products");
    expect(result.product_id).toBe("p1");
    expect(result.sameRetailerContext).toBe(true);
    expect(result.matched_by).toBe("ean_barcode");
  });

  test("finds ALDI product by EAN, different retailer context", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { product_id: "p1", name: "Milch" } });

    const result = await checkForDuplicate({
      ean_barcode: "4001234567890",
      targetRetailer: "EDEKA",
    });

    expect(result.found).toBe(true);
    expect(result.table).toBe("products");
    expect(result.sameRetailerContext).toBe(false);
  });

  test("finds competitor product by EAN, same retailer", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { product_id: "c1", name: "Butter", retailer: "LIDL" } });

    const result = await checkForDuplicate({
      ean_barcode: "4001234567890",
      targetRetailer: "LIDL",
    });

    expect(result.found).toBe(true);
    expect(result.table).toBe("competitor_products");
    expect(result.sameRetailerContext).toBe(true);
  });

  test("finds competitor product by EAN, different retailer", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { product_id: "c1", name: "Butter", retailer: "LIDL" } });

    const result = await checkForDuplicate({
      ean_barcode: "4001234567890",
      targetRetailer: "REWE",
    });

    expect(result.found).toBe(true);
    expect(result.table).toBe("competitor_products");
    expect(result.sameRetailerContext).toBe(false);
  });

  test("skips excluded product_id", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { product_id: "p1", name: "Milch" } });

    const result = await checkForDuplicate({
      ean_barcode: "4001234567890",
      targetRetailer: "ALDI",
      excludeProductId: "p1",
    });

    expect(result.found).toBe(false);
  });

  test("finds ALDI product by article_number for home retailer", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { product_id: "p2", name: "Brot" } });

    const result = await checkForDuplicate({
      ean_barcode: "9999999999999",
      article_number: "123456",
      targetRetailer: "ALDI",
    });

    expect(result.found).toBe(true);
    expect(result.matched_by).toBe("article_number");
    expect(result.sameRetailerContext).toBe(true);
  });

  test("does not check article_number for non-home retailer", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    const result = await checkForDuplicate({
      ean_barcode: "9999999999999",
      article_number: "123456",
      targetRetailer: "EDEKA",
    });

    expect(result.found).toBe(false);
  });
});

describe("assertNoDuplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null });
  });

  test("does not throw when no duplicate found", async () => {
    await expect(
      assertNoDuplicate({ ean_barcode: "123", targetRetailer: "ALDI" }),
    ).resolves.toBeUndefined();
  });

  test("throws DuplicateProductError for same-retailer duplicate", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { product_id: "p1", name: "Milch" } });

    await expect(
      assertNoDuplicate({ ean_barcode: "4001234567890", targetRetailer: "ALDI" }),
    ).rejects.toThrow(DuplicateProductError);
  });

  test("does not throw for different-retailer duplicate", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { product_id: "p1", name: "Milch" } });

    await expect(
      assertNoDuplicate({ ean_barcode: "4001234567890", targetRetailer: "EDEKA" }),
    ).resolves.toBeUndefined();
  });
});
