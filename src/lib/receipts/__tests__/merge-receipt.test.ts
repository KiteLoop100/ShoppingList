import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeIntoExistingReceipt } from "../merge-receipt";
import type { ReceiptOcrResult } from "../parse-receipt";

vi.mock("@/lib/products/find-existing", () => ({
  findProductByArticleNumber: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/receipts/parse-receipt", async (importOriginal) => {
  const original = await importOriginal<typeof import("../parse-receipt")>();
  return {
    ...original,
    findOrCreateCompetitorProductServer: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@/lib/competitor-products/categorize-competitor-product", () => ({
  categorizeCompetitorProductServer: vi.fn().mockResolvedValue(undefined),
}));

const EXISTING_RECEIPT_ID = "existing-receipt-123";
const USER_ID = "user-abc";

function makeOcrResult(overrides: Partial<ReceiptOcrResult> = {}): ReceiptOcrResult {
  return {
    status: "valid",
    retailer: "ALDI",
    store_name: "ALDI SÜD Teststadt",
    purchase_date: "2026-03-05",
    purchase_time: "14:30:00",
    total_amount: 25.5,
    products: [],
    ...overrides,
  };
}

function createMockSupabase(existingItems: { receipt_name: string; article_number: string | null }[]) {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const upsertFn = vi.fn().mockReturnValue({
    then: vi.fn((cb) => { cb({ error: null }); }),
  });

  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  // First eq() returns the chain, second resolves with data (since we chain .eq().eq())
  let eqCallCount = 0;
  selectChain.eq = vi.fn(() => {
    eqCallCount++;
    if (eqCallCount >= 1) {
      return Promise.resolve({ data: existingItems, error: null });
    }
    return selectChain;
  });
  selectChain.select.mockReturnValue(selectChain);

  const fromFn = vi.fn((table: string) => {
    if (table === "receipt_items") {
      return {
        select: selectChain.select,
        insert: insertFn,
      };
    }
    if (table === "receipts") {
      return { update: updateFn };
    }
    if (table === "competitor_product_stats") {
      return { upsert: upsertFn };
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    };
  });

  return {
    supabase: { from: fromFn } as unknown as import("@supabase/supabase-js").SupabaseClient,
    insertFn,
    updateFn,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("mergeIntoExistingReceipt", () => {
  it("returns merged=true with items_added=0 when all items already exist", async () => {
    const existingItems = [
      { receipt_name: "Milch 3,5%", article_number: "12345" },
      { receipt_name: "Vollkornbrot", article_number: null },
    ];
    const { supabase, insertFn } = createMockSupabase(existingItems);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "Milch 3,5%", article_number: "12345", total_price: 1.29 },
        { position: 2, receipt_name: "Vollkornbrot", total_price: 2.49 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.merged).toBe(true);
    expect(result.items_added).toBe(0);
    expect(result.receipt_id).toBe(EXISTING_RECEIPT_ID);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("adds genuinely new items and returns items_added count", async () => {
    const existingItems = [
      { receipt_name: "Milch 3,5%", article_number: "12345" },
    ];
    const { supabase, insertFn, updateFn } = createMockSupabase(existingItems);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "Milch 3,5%", article_number: "12345", total_price: 1.29 },
        { position: 2, receipt_name: "Butter", total_price: 1.99 },
        { position: 3, receipt_name: "Eier 10er", total_price: 2.39 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.merged).toBe(true);
    expect(result.items_added).toBe(2);
    expect(result.items_count).toBe(3);
    expect(insertFn).toHaveBeenCalledTimes(1);
    const insertedItems = insertFn.mock.calls[0][0];
    expect(insertedItems).toHaveLength(2);
    expect(insertedItems[0].receipt_name).toBe("Butter");
    expect(insertedItems[1].receipt_name).toBe("Eier 10er");
    expect(updateFn).toHaveBeenCalled();
  });

  it("matches existing items by normalized name (case-insensitive)", async () => {
    const existingItems = [
      { receipt_name: "  MILCH 3,5%  ", article_number: null },
    ];
    const { supabase, insertFn } = createMockSupabase(existingItems);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "milch 3,5%", total_price: 1.29 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.merged).toBe(true);
    expect(result.items_added).toBe(0);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("matches existing items by article number", async () => {
    const existingItems = [
      { receipt_name: "ALT NAME", article_number: "12345" },
    ];
    const { supabase, insertFn } = createMockSupabase(existingItems);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "Neuer Produktname", article_number: "12345", total_price: 1.29 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.merged).toBe(true);
    expect(result.items_added).toBe(0);
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("assigns correct positions to new items (after existing ones)", async () => {
    const existingItems = [
      { receipt_name: "Milch", article_number: null },
      { receipt_name: "Brot", article_number: null },
      { receipt_name: "Käse", article_number: null },
    ];
    const { supabase, insertFn } = createMockSupabase(existingItems);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "Milch", total_price: 1.29 },
        { position: 2, receipt_name: "Neues Produkt", total_price: 3.49 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.items_added).toBe(1);
    const insertedItems = insertFn.mock.calls[0][0];
    expect(insertedItems[0].position).toBe(4);
  });

  it("preserves receipt metadata from OCR result", async () => {
    const { supabase } = createMockSupabase([]);

    const ocrResult = makeOcrResult({
      retailer: "LIDL",
      store_name: "LIDL Teststadt",
      purchase_date: "2026-03-01",
      total_amount: 42.50,
      products: [],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "LIDL", false,
    );

    expect(result.receipt_id).toBe(EXISTING_RECEIPT_ID);
    expect(result.retailer).toBe("LIDL");
    expect(result.store_name).toBe("LIDL Teststadt");
    expect(result.purchase_date).toBe("2026-03-01");
    expect(result.total_amount).toBe(42.50);
    expect(result.merged).toBe(true);
  });

  it("stores non-product items (PFAND, LEERGUT) without linking to products", async () => {
    const { supabase, insertFn } = createMockSupabase([]);

    const ocrResult = makeOcrResult({
      products: [
        { position: 1, receipt_name: "PFAND Einweg 0,25", total_price: 0.25 },
        { position: 2, receipt_name: "LEERGUT", total_price: -0.25 },
        { position: 3, receipt_name: "Echter Käse", total_price: 2.99 },
      ],
    });

    const result = await mergeIntoExistingReceipt(
      supabase, USER_ID, EXISTING_RECEIPT_ID, ocrResult, "ALDI", true,
    );

    expect(result.items_added).toBe(3);
    const insertedItems = insertFn.mock.calls[0][0];
    expect(insertedItems[0].product_id).toBeNull();
    expect(insertedItems[1].product_id).toBeNull();
    expect(insertedItems[2].receipt_name).toBe("Echter Käse");
  });
});
