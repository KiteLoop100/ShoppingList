import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/products/find-existing", () => ({
  findProductByArticleNumber: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { updateReceiptItemArticleNumber } from "../receipt-service";
import { findProductByArticleNumber } from "@/lib/products/find-existing";

const mockFind = vi.mocked(findProductByArticleNumber);

function createMockSupabase(
  updateResult: { error: unknown } = { error: null },
) {
  const receiptItemsChain = {
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(updateResult),
  };

  const productsChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };

  const fromFn = vi.fn((table: string) => {
    if (table === "receipt_items") return receiptItemsChain;
    if (table === "products") return productsChain;
    return receiptItemsChain;
  });

  return {
    from: fromFn,
    _receiptItems: receiptItemsChain,
    _products: productsChain,
  } as unknown as import("@supabase/supabase-js").SupabaseClient & {
    _receiptItems: typeof receiptItemsChain;
    _products: typeof productsChain;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateReceiptItemArticleNumber", () => {
  it("updates article number and links product when match found", async () => {
    mockFind.mockResolvedValueOnce({
      product_id: "prod-1",
      name: "MILCH 3,5%",
      matched_by: "article_number",
    });
    const supabase = createMockSupabase();

    const result = await updateReceiptItemArticleNumber(
      ["item-1"], "123456", supabase, null,
    );

    expect(result.matched).toBe(true);
    expect(result.productName).toBe("MILCH 3,5%");
    expect(supabase._receiptItems.update).toHaveBeenCalledWith({
      article_number: "123456",
      product_id: "prod-1",
    });
    expect(supabase._receiptItems.in).toHaveBeenCalledWith("receipt_item_id", ["item-1"]);
  });

  it("clears product_id when no match found", async () => {
    mockFind.mockResolvedValueOnce(null);
    const supabase = createMockSupabase();

    const result = await updateReceiptItemArticleNumber(
      ["item-1"], "999999", supabase,
    );

    expect(result.matched).toBe(false);
    expect(result.productName).toBeUndefined();
    expect(supabase._receiptItems.update).toHaveBeenCalledWith({
      article_number: "999999",
      product_id: null,
    });
  });

  it("updates all items in a grouped set", async () => {
    mockFind.mockResolvedValueOnce(null);
    const supabase = createMockSupabase();
    const ids = ["item-1", "item-2", "item-3"];

    await updateReceiptItemArticleNumber(ids, "654321", supabase);

    expect(supabase._receiptItems.in).toHaveBeenCalledWith("receipt_item_id", ids);
  });

  it("handles empty/non-digit input by setting null", async () => {
    mockFind.mockResolvedValueOnce(null);
    const supabase = createMockSupabase();

    const result = await updateReceiptItemArticleNumber(
      ["item-1"], "abc", supabase,
    );

    expect(result.matched).toBe(false);
    expect(supabase._receiptItems.update).toHaveBeenCalledWith({
      article_number: null,
      product_id: null,
    });
  });

  it("throws on DB error", async () => {
    mockFind.mockResolvedValueOnce(null);
    const supabase = createMockSupabase({ error: { message: "DB fail" } });

    await expect(
      updateReceiptItemArticleNumber(["item-1"], "123456", supabase),
    ).rejects.toThrow();
  });

  it("updates product price when receipt is newer", async () => {
    mockFind.mockReset();
    mockFind.mockResolvedValue({
      product_id: "prod-1",
      name: "BUTTER",
      price: 1.49,
      price_updated_at: "2026-01-01",
      matched_by: "article_number",
    });
    const supabase = createMockSupabase();

    const result = await updateReceiptItemArticleNumber(
      ["item-1"], "123456", supabase, "2026-03-15", 1.79,
    );

    expect(result.matched).toBe(true);
    expect(result.priceUpdated).toBe(true);
    const fromCalls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls;
    const productsCalls = fromCalls.filter(([t]: [string]) => t === "products");
    expect(productsCalls.length).toBeGreaterThan(0);
  });

  it("does not update product price when receipt is older", async () => {
    mockFind.mockReset();
    mockFind.mockResolvedValue({
      product_id: "prod-1",
      name: "BUTTER",
      price: 1.49,
      price_updated_at: "2026-06-01",
      matched_by: "article_number",
    });
    const supabase = createMockSupabase();

    const result = await updateReceiptItemArticleNumber(
      ["item-1"], "123456", supabase, "2026-03-15", 1.79,
    );

    expect(result.matched).toBe(true);
    expect(result.priceUpdated).toBe(false);
  });
});
