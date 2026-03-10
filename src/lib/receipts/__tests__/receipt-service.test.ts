import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadReceiptWithItems,
  linkReceiptItemToProduct,
  getSignedPhotoUrls,
  groupReceiptItems,
  type ReceiptItem,
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
  it("sets product_id and clears competitor_product_id for aldi (default)", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ in: inFn });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await linkReceiptItemToProduct("item-1", "prod-new", supabase);

    expect(supabase.from).toHaveBeenCalledWith("receipt_items");
    expect(updateFn).toHaveBeenCalledWith({ product_id: "prod-new", competitor_product_id: null });
    expect(inFn).toHaveBeenCalledWith("receipt_item_id", ["item-1"]);
  });

  it("sets competitor_product_id and clears product_id for competitor", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ in: inFn });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await linkReceiptItemToProduct("item-1", "comp-new", supabase, "competitor");

    expect(updateFn).toHaveBeenCalledWith({ competitor_product_id: "comp-new", product_id: null });
    expect(inFn).toHaveBeenCalledWith("receipt_item_id", ["item-1"]);
  });

  it("updates multiple receipt items when given an array of IDs", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ in: inFn });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await linkReceiptItemToProduct(["item-1", "item-2", "item-3"], "prod-new", supabase);

    expect(updateFn).toHaveBeenCalledWith({ product_id: "prod-new", competitor_product_id: null });
    expect(inFn).toHaveBeenCalledWith("receipt_item_id", ["item-1", "item-2", "item-3"]);
  });

  it("throws and logs when update fails", async () => {
    const dbError = { code: "42501", message: "permission denied" };
    const inFn = vi.fn().mockResolvedValue({ error: dbError });
    const updateFn = vi.fn().mockReturnValue({ in: inFn });

    const supabase = {
      from: vi.fn(() => ({ update: updateFn })),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await expect(linkReceiptItemToProduct("item-1", "prod-x", supabase)).rejects.toEqual(dbError);
  });
});

describe("groupReceiptItems", () => {
  const ri = (pos: number, overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({
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

  it("returns items unchanged when there are no duplicates", () => {
    const items = [ri(1), ri(2, { receipt_name: "Brot" }), ri(3, { receipt_name: "Milch" })];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(3);
    expect(result[0].grouped_count).toBe(1);
    expect(result[0].original_item_ids).toEqual(["item-1"]);
  });

  it("groups items with the same product_id", () => {
    const items = [
      ri(1, { product_id: "prod-A", receipt_name: "Milch", unit_price: 1.29, total_price: 1.29 }),
      ri(2, { product_id: "prod-B", receipt_name: "Brot", unit_price: 2.49, total_price: 2.49 }),
      ri(3, { product_id: "prod-A", receipt_name: "Milch", unit_price: 1.29, total_price: 1.29 }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(2);

    const milch = result[0];
    expect(milch.product_id).toBe("prod-A");
    expect(milch.quantity).toBe(2);
    expect(milch.total_price).toBeCloseTo(2.58);
    expect(milch.grouped_count).toBe(2);
    expect(milch.original_positions).toEqual([1, 3]);
    expect(milch.original_item_ids).toEqual(["item-1", "item-3"]);
    expect(milch.position).toBe(1);

    expect(result[1].product_id).toBe("prod-B");
    expect(result[1].grouped_count).toBe(1);
  });

  it("groups items with the same competitor_product_id", () => {
    const items = [
      ri(1, { competitor_product_id: "comp-X", receipt_name: "REWE Joghurt", total_price: 0.99 }),
      ri(2, { competitor_product_id: "comp-X", receipt_name: "REWE Joghurt", total_price: 0.99 }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].total_price).toBeCloseTo(1.98);
    expect(result[0].grouped_count).toBe(2);
  });

  it("groups unlinked items by normalized receipt_name", () => {
    const items = [
      ri(1, { receipt_name: "  Bananen  ", total_price: 1.50 }),
      ri(2, { receipt_name: "bananen", total_price: 1.50 }),
      ri(3, { receipt_name: "BANANEN", total_price: 1.50 }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
    expect(result[0].total_price).toBeCloseTo(4.50);
    expect(result[0].grouped_count).toBe(3);
    expect(result[0].original_positions).toEqual([1, 2, 3]);
  });

  it("aggregates weight items by summing weight_kg", () => {
    const items = [
      ri(1, { product_id: "prod-W", is_weight_item: true, weight_kg: 0.5, total_price: 2.50 }),
      ri(2, { product_id: "prod-W", is_weight_item: true, weight_kg: 0.75, total_price: 3.75 }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].weight_kg).toBeCloseTo(1.25);
    expect(result[0].total_price).toBeCloseTo(6.25);
    expect(result[0].is_weight_item).toBe(true);
  });

  it("calculates average unit_price for grouped items", () => {
    const items = [
      ri(1, { product_id: "prod-D", quantity: 1, unit_price: 2.00, total_price: 2.00 }),
      ri(2, { product_id: "prod-D", quantity: 1, unit_price: 1.50, total_price: 1.50 }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].total_price).toBeCloseTo(3.50);
    expect(result[0].unit_price).toBeCloseTo(1.75);
  });

  it("uses thumbnail_url from the item that has one", () => {
    const items = [
      ri(1, { product_id: "prod-T", product_name: undefined, thumbnail_url: undefined }),
      ri(2, { product_id: "prod-T", product_name: "Eier", thumbnail_url: "https://thumb.jpg" }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].thumbnail_url).toBe("https://thumb.jpg");
    expect(result[0].product_name).toBe("Eier");
  });

  it("returns empty array for empty input", () => {
    expect(groupReceiptItems([])).toEqual([]);
  });

  it("preserves first-seen order of groups", () => {
    const items = [
      ri(1, { receipt_name: "Apfel" }),
      ri(2, { receipt_name: "Birne" }),
      ri(3, { receipt_name: "Apfel" }),
      ri(4, { receipt_name: "Cherry" }),
      ri(5, { receipt_name: "Birne" }),
    ];
    const result = groupReceiptItems(items);

    expect(result.map((r) => r.receipt_name)).toEqual(["Apfel", "Birne", "Cherry"]);
  });

  it("does not merge linked and unlinked items with same name", () => {
    const items = [
      ri(1, { product_id: "prod-M", receipt_name: "Milch" }),
      ri(2, { receipt_name: "Milch" }),
    ];
    const result = groupReceiptItems(items);

    expect(result).toHaveLength(2);
  });

  it("uses smallest position from the group", () => {
    const items = [
      ri(5, { product_id: "prod-A" }),
      ri(2, { product_id: "prod-A" }),
      ri(8, { product_id: "prod-A" }),
    ];
    const result = groupReceiptItems(items);

    expect(result[0].position).toBe(2);
  });
});
