import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type MockRow = Record<string, unknown>;

function createMockSupabase(options?: {
  selectData?: MockRow | MockRow[] | null;
  insertData?: MockRow | null;
  updateData?: MockRow | null;
  error?: { message: string } | null;
}) {
  const { selectData = null, insertData = null, updateData = null, error = null } = options ?? {};

  const buildChain = (finalData: unknown, finalError: typeof error) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.upsert = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: finalData, error: finalError });

    const resolveAll = () => Promise.resolve({
      data: Array.isArray(finalData) ? finalData : finalData ? [finalData] : [],
      error: finalError,
    });

    chain.then = vi.fn((resolve) => resolveAll().then(resolve));
    (chain as Record<string, unknown>)[Symbol.toStringTag] = "Promise";

    Object.defineProperty(chain, "then", {
      value: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        resolveAll().then(resolve, reject),
    });

    return chain;
  };

  let callCount = 0;
  const mock = {
    from: vi.fn(() => {
      callCount++;
      if (callCount === 1 && selectData !== undefined) {
        return buildChain(selectData, error);
      }
      if (insertData !== undefined) {
        return buildChain(insertData, error);
      }
      return buildChain(updateData, error);
    }),
  };

  return mock;
}

function createSequentialMockSupabase(responses: Array<{
  data: unknown;
  error?: { message: string } | null;
}>) {
  let callIdx = 0;

  const buildChain = (data: unknown, error: { message: string } | null | undefined) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error: error ?? null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: error ?? null });

    Object.defineProperty(chain, "then", {
      value: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({
          data: Array.isArray(data) ? data : data ? [data] : [],
          error: error ?? null,
        }).then(resolve, reject),
    });

    return chain;
  };

  return {
    from: vi.fn(() => {
      const resp = responses[callIdx] ?? responses[responses.length - 1];
      callIdx++;
      return buildChain(resp.data, resp.error);
    }),
  };
}

import {
  loadInventory,
  upsertInventoryItem,
  consumeInventoryItem,
  openInventoryItem,
  updateQuantity,
  removeInventoryItem,
  isInventoryEnabledForUser,
  upsertInventoryFromReceipt,
} from "../inventory-service";

describe("inventory-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadInventory", () => {
    test("returns items on success", async () => {
      const mockItems = [
        { id: "1", display_name: "Milk", quantity: 2, status: "sealed" },
        { id: "2", display_name: "Butter", quantity: 1, status: "opened" },
      ];
      const sb = createMockSupabase({ selectData: mockItems });
      const result = await loadInventory(sb as never, "user-1");
      expect(result).toHaveLength(2);
      expect(result[0].display_name).toBe("Milk");
    });

    test("returns empty array on error", async () => {
      const sb = createMockSupabase({
        selectData: null,
        error: { message: "db error" },
      });
      const result = await loadInventory(sb as never, "user-1");
      expect(result).toEqual([]);
    });
  });

  describe("upsertInventoryItem", () => {
    test("inserts new item when none exists", async () => {
      const newItem = {
        id: "new-1",
        display_name: "Bread",
        quantity: 1,
        status: "sealed",
      };
      const sb = createSequentialMockSupabase([
        { data: null },
        { data: newItem },
      ]);

      const result = await upsertInventoryItem(sb as never, "user-1", {
        product_id: "prod-1",
        competitor_product_id: null,
        display_name: "Bread",
        demand_group_code: "BG",
        quantity: 1,
        source: "receipt",
      });

      expect(result).toBeTruthy();
      expect(result!.display_name).toBe("Bread");
    });

    test("increments quantity when item exists", async () => {
      const existing = { id: "existing-1", quantity: 2 };
      const updated = {
        id: "existing-1",
        display_name: "Milk",
        quantity: 3,
        status: "sealed",
      };
      const sb = createSequentialMockSupabase([
        { data: existing },
        { data: updated },
      ]);

      const result = await upsertInventoryItem(sb as never, "user-1", {
        product_id: "prod-1",
        competitor_product_id: null,
        display_name: "Milk",
        demand_group_code: "MP",
        quantity: 1,
        source: "receipt",
      });

      expect(result).toBeTruthy();
      expect(result!.quantity).toBe(3);
    });

    test("returns null when no product_id or competitor_product_id", async () => {
      const sb = createMockSupabase();
      const result = await upsertInventoryItem(sb as never, "user-1", {
        product_id: null,
        competitor_product_id: null,
        display_name: "Unknown",
        demand_group_code: null,
        quantity: 1,
        source: "manual",
      });
      expect(result).toBeNull();
    });
  });

  describe("consumeInventoryItem", () => {
    test("returns true on success", async () => {
      const sb = createMockSupabase({ updateData: {} });
      const result = await consumeInventoryItem(sb as never, "item-1");
      expect(result).toBe(true);
    });

    test("returns false on error", async () => {
      const sb = createMockSupabase({
        updateData: null,
        error: { message: "fail" },
      });
      const result = await consumeInventoryItem(sb as never, "item-1");
      expect(result).toBe(false);
    });
  });

  describe("openInventoryItem", () => {
    test("returns true on success", async () => {
      const sb = createMockSupabase({ updateData: {} });
      const result = await openInventoryItem(sb as never, "item-1");
      expect(result).toBe(true);
    });

    test("returns false on error", async () => {
      const sb = createMockSupabase({
        updateData: null,
        error: { message: "fail" },
      });
      const result = await openInventoryItem(sb as never, "item-1");
      expect(result).toBe(false);
    });
  });

  describe("updateQuantity", () => {
    test("returns true for valid quantity", async () => {
      const sb = createMockSupabase({ updateData: {} });
      const result = await updateQuantity(sb as never, "item-1", 5);
      expect(result).toBe(true);
    });

    test("returns false for quantity < 1", async () => {
      const sb = createMockSupabase();
      const result = await updateQuantity(sb as never, "item-1", 0);
      expect(result).toBe(false);
    });
  });

  describe("removeInventoryItem", () => {
    test("returns true on success", async () => {
      const sb = createMockSupabase({ updateData: {} });
      const result = await removeInventoryItem(sb as never, "item-1");
      expect(result).toBe(true);
    });

    test("returns false on error", async () => {
      const sb = createMockSupabase({
        updateData: null,
        error: { message: "fail" },
      });
      const result = await removeInventoryItem(sb as never, "item-1");
      expect(result).toBe(false);
    });
  });

  describe("isInventoryEnabledForUser", () => {
    test("returns true when enabled", async () => {
      const sb = createMockSupabase({
        selectData: { enable_inventory: true },
      });
      const result = await isInventoryEnabledForUser(sb as never, "user-1");
      expect(result).toBe(true);
    });

    test("returns false when disabled", async () => {
      const sb = createMockSupabase({
        selectData: { enable_inventory: false },
      });
      const result = await isInventoryEnabledForUser(sb as never, "user-1");
      expect(result).toBe(false);
    });

    test("returns false when no settings row", async () => {
      const sb = createMockSupabase({ selectData: null });
      const result = await isInventoryEnabledForUser(sb as never, "user-1");
      expect(result).toBe(false);
    });
  });

  describe("upsertInventoryFromReceipt", () => {
    test("does nothing when feature is disabled", async () => {
      const sb = createSequentialMockSupabase([
        { data: { enable_inventory: false } },
      ]);

      await upsertInventoryFromReceipt(sb as never, "user-1", "receipt-1", [
        {
          product_id: "prod-1",
          competitor_product_id: null,
          receipt_name: "Milk",
          quantity: 1,
        },
      ]);

      expect(sb.from).toHaveBeenCalledTimes(1);
    });

    test("skips items without product references", async () => {
      const sb = createSequentialMockSupabase([
        { data: { enable_inventory: true } },
      ]);

      await upsertInventoryFromReceipt(sb as never, "user-1", "receipt-1", [
        {
          product_id: null,
          competitor_product_id: null,
          receipt_name: "PFAND",
          quantity: 1,
        },
      ]);

      expect(sb.from).toHaveBeenCalledTimes(1);
    });
  });
});
