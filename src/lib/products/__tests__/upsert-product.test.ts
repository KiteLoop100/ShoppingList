import { describe, test, expect, vi, beforeEach } from "vitest";
import { upsertProduct, type ProductData } from "../upsert-product";

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockSupabase(overrides: {
  selectResult?: { data: Record<string, unknown> | null; error: unknown };
  insertResult?: { data: { product_id: string } | null; error: unknown };
  updateResult?: { error: unknown };
} = {}) {
  const selectSingle = vi.fn().mockResolvedValue(
    overrides.selectResult ?? { data: null, error: null },
  );
  const insertSelectSingle = vi.fn().mockResolvedValue(
    overrides.insertResult ?? { data: { product_id: "new-id" }, error: null },
  );
  const updateEq = vi.fn().mockResolvedValue(
    overrides.updateResult ?? { error: null },
  );

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: insertSelectSingle }),
      }),
      update: vi.fn().mockReturnValue({
        eq: updateEq,
      }),
    }),
    _mocks: { selectSingle, insertSelectSingle, updateEq },
  };
}

const baseData: ProductData = {
  name: "Test Product",
  name_normalized: "test product",
  source: "crowdsourcing",
  assortment_type: "daily_range",
  demand_group_code: "AK",
  country: "DE",
};

describe("upsertProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  test("inserts new product and returns product_id", async () => {
    const sb = createMockSupabase({
      insertResult: { data: { product_id: "abc-123" }, error: null },
    });

    const result = await upsertProduct(sb as never, baseData);
    expect(result).toEqual({ product_id: "abc-123", created: true });
  });

  test("returns null and logs error when insert fails", async () => {
    const { log } = await import("@/lib/utils/logger");
    const sb = createMockSupabase({
      insertResult: { data: null, error: { message: "NOT NULL violation", code: "23502" } },
    });

    const result = await upsertProduct(sb as never, baseData);
    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalledWith(
      "[upsertProduct] insert failed:",
      "NOT NULL violation",
      { code: "23502" },
    );
  });

  test("updates existing product when existingProductId provided", async () => {
    const sb = createMockSupabase({
      selectResult: { data: { product_id: "existing-1", name: "Old" }, error: null },
      updateResult: { error: null },
    });

    const result = await upsertProduct(sb as never, { ...baseData, name: "New" }, "existing-1");
    expect(result).toEqual({ product_id: "existing-1", created: false });
  });

  test("returns null and logs error when update fails", async () => {
    const { log } = await import("@/lib/utils/logger");
    const sb = createMockSupabase({
      selectResult: { data: { product_id: "existing-1" }, error: null },
      updateResult: { error: { message: "RLS blocked", code: "42501" } },
    });

    const result = await upsertProduct(sb as never, baseData, "existing-1");
    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalledWith(
      "[upsertProduct] update failed:",
      "RLS blocked",
      { code: "42501", productId: "existing-1" },
    );
  });

  test("respects FILL_EMPTY_FIELDS — does not overwrite existing brand", async () => {
    const sb = createMockSupabase({
      selectResult: { data: { product_id: "p1", brand: "Existing Brand" }, error: null },
      updateResult: { error: null },
    });

    await upsertProduct(sb as never, { brand: "New Brand" }, "p1");

    const updateCall = sb.from("products").update;
    const passedUpdates = updateCall.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(passedUpdates?.brand).toBeUndefined();
  });

  test("fills empty brand when existing is null", async () => {
    const sb = createMockSupabase({
      selectResult: { data: { product_id: "p1", brand: null }, error: null },
      updateResult: { error: null },
    });

    await upsertProduct(sb as never, { brand: "New Brand" }, "p1");

    const updateCall = sb.from("products").update;
    const passedUpdates = updateCall.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(passedUpdates?.brand).toBe("New Brand");
  });
});
