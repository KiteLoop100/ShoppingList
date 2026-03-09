import { vi, describe, test, expect, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockNot = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    not: mockNot,
    in: mockIn,
    order: mockOrder,
  };
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
  return chain;
}

const chain = chainable();
const mockSupabase = { from: vi.fn(() => chain) };

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => mockSupabase,
}));

vi.mock("@/lib/auth/auth-context", () => ({
  getCurrentUserId: () => "user-1",
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  getRetailerReceiptSummary,
  getReceiptProductsByTrip,
  filterToShelfStable,
  type ReceiptProduct,
} from "../receipt-purchase-menu";

beforeEach(() => {
  vi.clearAllMocks();
  chainable();
});

describe("getRetailerReceiptSummary", () => {
  test("returns empty when no recent receipts", async () => {
    mockNot.mockReturnValue({ data: [], error: null });

    const result = await getRetailerReceiptSummary();
    expect(result).toEqual([]);
  });

  test("returns sorted summaries with home retailer first", async () => {
    const recentReceipts = [
      { retailer: "REWE" },
      { retailer: "ALDI" },
      { retailer: "REWE" },
    ];
    const yearReceipts = [
      { retailer: "REWE", total_amount: 150 },
      { retailer: "REWE", total_amount: 80 },
      { retailer: "ALDI", total_amount: 50 },
    ];

    let callCount = 0;
    mockNot.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: recentReceipts, error: null };
      return { data: yearReceipts, error: null };
    });

    const result = await getRetailerReceiptSummary();

    expect(result).toHaveLength(2);
    expect(result[0].retailer).toBe("ALDI");
    expect(result[0].isHomeRetailer).toBe(true);
    expect(result[0].displayName).toBe("ALDI SÜD");
    expect(result[1].retailer).toBe("REWE");
    expect(result[1].receiptCount).toBe(2);
    expect(result[1].totalSpent).toBe(230);
  });

  test("returns empty when supabase not configured", async () => {
    vi.doMock("@/lib/supabase/client", () => ({
      createClientIfConfigured: () => null,
    }));
    const mod = await import("../receipt-purchase-menu");
    const result = await mod.getRetailerReceiptSummary();
    expect(result).toEqual([]);
    vi.doUnmock("@/lib/supabase/client");
  });
});

describe("getReceiptProductsByTrip", () => {
  test("returns products for single trip mode", async () => {
    const receipts = [
      { receipt_id: "r1", purchase_date: "2026-03-08" },
      { receipt_id: "r2", purchase_date: "2026-03-01" },
    ];
    const items = [
      { product_id: "p1", receipt_name: "Milch", quantity: 2 },
      { product_id: "p2", receipt_name: "Butter", quantity: 1 },
    ];

    mockOrder.mockReturnValue({ data: receipts, error: null });
    mockIn.mockReturnValue({ data: items, error: null });

    const result = await getReceiptProductsByTrip("ALDI", "single", 0);

    expect(result).toHaveLength(2);
    expect(result[0].product_id).toBe("p1");
    expect(result[0].frequency).toBe(2);
    expect(result[1].product_id).toBe("p2");
  });

  test("returns products for combined mode", async () => {
    const receipts = [
      { receipt_id: "r1", purchase_date: "2026-03-08" },
      { receipt_id: "r2", purchase_date: "2026-03-01" },
      { receipt_id: "r3", purchase_date: "2026-02-20" },
    ];
    const items = [
      { product_id: "p1", receipt_name: "Milch", quantity: 1 },
      { product_id: "p1", receipt_name: "Milch", quantity: 1 },
      { product_id: "p2", receipt_name: "Brot", quantity: 1 },
    ];

    mockOrder.mockReturnValue({ data: receipts, error: null });
    mockIn.mockReturnValue({ data: items, error: null });

    const result = await getReceiptProductsByTrip("ALDI", "combined", 2);

    expect(result).toHaveLength(2);
    expect(result[0].product_id).toBe("p1");
    expect(result[0].frequency).toBe(2);
  });

  test("returns empty for out-of-range single index", async () => {
    const receipts = [
      { receipt_id: "r1", purchase_date: "2026-03-08" },
    ];

    mockOrder.mockReturnValue({ data: receipts, error: null });

    const result = await getReceiptProductsByTrip("ALDI", "single", 5);
    expect(result).toEqual([]);
  });

  test("returns empty when no receipts", async () => {
    mockOrder.mockReturnValue({ data: [], error: null });

    const result = await getReceiptProductsByTrip("REWE", "single", 0);
    expect(result).toEqual([]);
  });
});

describe("filterToShelfStable", () => {
  const items: ReceiptProduct[] = [
    { product_id: "p1", receipt_name: "TK Pizza", frequency: 3 },
    { product_id: "p2", receipt_name: "Pasta", frequency: 2 },
    { product_id: "p3", receipt_name: "Milch", frequency: 5 },
    { product_id: "p4", receipt_name: "Äpfel", frequency: 1 },
  ];

  const productMap = new Map([
    ["p1", { demand_group_code: "78" }],
    ["p2", { demand_group_code: "45" }],
    ["p3", { demand_group_code: "83" }],
    ["p4", { demand_group_code: "38" }],
  ]);

  test("keeps frozen and dry items, filters out chilled and produce", () => {
    const result = filterToShelfStable(items, productMap);

    const ids = result.map((r) => r.product_id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
    expect(ids).not.toContain("p3");
    expect(ids).not.toContain("p4");
  });

  test("keeps items without product_id", () => {
    const itemsWithNoId: ReceiptProduct[] = [
      { product_id: "", receipt_name: "Unknown", frequency: 1 },
    ];
    const result = filterToShelfStable(itemsWithNoId, productMap);
    expect(result).toHaveLength(1);
  });
});
