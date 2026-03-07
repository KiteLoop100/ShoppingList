import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadReceiptWithItems,
  linkReceiptItemToProduct,
  getSignedPhotoUrls,
} from "../receipt-service";

const RECEIPT_ID = "aaa-111";

const baseReceipt = {
  receipt_id: RECEIPT_ID,
  store_name: "ALDI SÜD",
  store_address: "Teststraße 1",
  retailer: "ALDI",
  purchase_date: "2026-03-01",
  purchase_time: "14:30:00",
  total_amount: 25.5,
  payment_method: "VISA",
  items_count: 2,
  photo_urls: [],
};

const makeItem = (
  pos: number,
  overrides: Record<string, unknown> = {}
) => ({
  receipt_item_id: `item-${pos}`,
  position: pos,
  article_number: null,
  receipt_name: `Item ${pos}`,
  product_id: null,
  competitor_product_id: null,
  quantity: 1,
  unit_price: 1.99,
  total_price: 1.99,
  is_weight_item: false,
  weight_kg: null,
  ...overrides,
});

type QueryChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

function createQueryChain(result: { data: unknown; error: unknown }): QueryChain {
  const chain: QueryChain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  chain.order.mockResolvedValue(result);
  chain.in.mockResolvedValue(result);
  return chain;
}

function createMockSupabase(
  receiptResult: { data: unknown; error: unknown },
  itemsResult: { data: unknown; error: unknown },
  productsResult: { data: unknown; error: unknown } = { data: [], error: null },
  competitorResult: { data: unknown; error: unknown } = { data: [], error: null }
) {
  const receiptChain = createQueryChain(receiptResult);
  const itemsChain = createQueryChain(itemsResult);
  const productsChain = createQueryChain(productsResult);
  const competitorChain = createQueryChain(competitorResult);

  const fromFn = vi.fn((table: string) => {
    if (table === "receipts") return receiptChain;
    if (table === "receipt_items") return itemsChain;
    if (table === "products") return productsChain;
    if (table === "competitor_products") return competitorChain;
    return createQueryChain({ data: null, error: null });
  });

  return {
    from: fromFn,
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: vi.fn().mockResolvedValue({ data: [] }),
      })),
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadReceiptWithItems", () => {
  it("returns receipt with items and resolves ALDI product names", async () => {
    const items = [
      makeItem(1, { product_id: "prod-1" }),
      makeItem(2, { product_id: "prod-2" }),
    ];

    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: items, error: null },
      { data: [
        { product_id: "prod-1", name: "Milch", thumbnail_url: null },
        { product_id: "prod-2", name: "Brot", thumbnail_url: null },
      ], error: null }
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result).not.toBeNull();
    expect(result!.receipt.receipt_id).toBe(RECEIPT_ID);
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].product_name).toBe("Milch");
    expect(result!.items[1].product_name).toBe("Brot");
  });

  it("resolves competitor product names", async () => {
    const items = [makeItem(1, { competitor_product_id: "comp-1" })];

    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: items, error: null },
      { data: [], error: null },
      { data: [{ product_id: "comp-1", name: "LIDL Milch", thumbnail_url: null }], error: null }
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result).not.toBeNull();
    expect(result!.items[0].product_name).toBe("LIDL Milch");
  });

  it("returns null and logs warning when receipt query fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dbError = { code: "42703", message: "column does not exist" };

    const supabase = createMockSupabase(
      { data: null, error: dbError },
      { data: [], error: null }
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[receipts] Failed to load receipt:",
      dbError
    );
  });

  it("returns empty items when receipt exists but has no items", async () => {
    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: [], error: null }
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result).not.toBeNull();
    expect(result!.receipt.store_name).toBe("ALDI SÜD");
    expect(result!.items).toEqual([]);
  });
});

describe("getSignedPhotoUrls", () => {
  it("returns empty array for no photos", async () => {
    const supabase = createMockSupabase(
      { data: null, error: null },
      { data: null, error: null }
    );
    const result = await getSignedPhotoUrls([], supabase);
    expect(result).toEqual([]);
  });

  it("passes through HTTP URLs without signing", async () => {
    const supabase = createMockSupabase(
      { data: null, error: null },
      { data: null, error: null }
    );
    const urls = ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"];
    const result = await getSignedPhotoUrls(urls, supabase);
    expect(result).toEqual(urls);
  });

  it("converts storage paths to signed URLs", async () => {
    const storagePaths = ["user1/photo1.jpg", "user1/photo2.jpg"];
    const signedData = [
      { path: "user1/photo1.jpg", signedUrl: "https://signed/photo1" },
      { path: "user1/photo2.jpg", signedUrl: "https://signed/photo2" },
    ];

    const supabase = {
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: vi.fn().mockResolvedValue({ data: signedData }),
        })),
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    const result = await getSignedPhotoUrls(storagePaths, supabase);

    expect(result).toEqual(["https://signed/photo1", "https://signed/photo2"]);
    expect(supabase.storage.from).toHaveBeenCalledWith("receipt-photos");
  });
});

describe("loadReceiptWithItems – thumbnail_url", () => {
  it("resolves thumbnail_url from ALDI products", async () => {
    const items = [makeItem(1, { product_id: "prod-1" })];
    const thumbUrl = "https://storage.example.com/product-thumbnails/abc.webp";

    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: items, error: null },
      { data: [{ product_id: "prod-1", name: "Bio Eier", thumbnail_url: thumbUrl }], error: null },
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result!.items[0].thumbnail_url).toBe(thumbUrl);
    expect(result!.items[0].product_name).toBe("Bio Eier");
  });

  it("resolves thumbnail_url from competitor products", async () => {
    const items = [makeItem(1, { competitor_product_id: "comp-1" })];
    const thumbUrl = "https://storage.example.com/competitor/thumb.jpg";

    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: items, error: null },
      { data: [], error: null },
      { data: [{ product_id: "comp-1", name: "REWE Milch", thumbnail_url: thumbUrl }], error: null },
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result!.items[0].thumbnail_url).toBe(thumbUrl);
  });

  it("returns null thumbnail_url for unlinked items", async () => {
    const items = [makeItem(1)];

    const supabase = createMockSupabase(
      { data: { ...baseReceipt }, error: null },
      { data: items, error: null },
    );

    const result = await loadReceiptWithItems(RECEIPT_ID, supabase);

    expect(result!.items[0].thumbnail_url).toBeNull();
    expect(result!.items[0].product_name).toBeNull();
  });
});

describe("linkReceiptItemToProduct", () => {
  it("updates the receipt item with product_id", async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await linkReceiptItemToProduct("item-1", "prod-new", supabase);

    expect(supabase.from).toHaveBeenCalledWith("receipt_items");
    expect(updateFn).toHaveBeenCalledWith({ product_id: "prod-new" });
  });

  it("throws and logs when update fails", async () => {
    const dbError = { code: "42501", message: "permission denied" };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: dbError }),
    });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await expect(linkReceiptItemToProduct("item-1", "prod-x", supabase)).rejects.toEqual(dbError);
    expect(warnSpy).toHaveBeenCalledWith(
      "[receipts] Failed to link receipt item to product:",
      dbError,
    );
  });
});
