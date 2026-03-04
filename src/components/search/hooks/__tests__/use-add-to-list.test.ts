import { vi, describe, test, expect, beforeEach } from "vitest";

vi.mock("react", () => ({
  useState: (init: unknown) => {
    let val = init;
    const set = (v: unknown) => {
      val = typeof v === "function" ? (v as (prev: unknown) => unknown)(val) : v;
    };
    return [val, set];
  },
  useCallback: (fn: Function) => fn,
  useRef: (val: unknown) => ({ current: val }),
}));

const mockGetOrCreateActiveList = vi
  .fn()
  .mockResolvedValue({ list_id: "list-1" });
const mockAddListItem = vi.fn().mockResolvedValue({ item_id: "item-1" });
const mockAddListItemsBatch = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/list", () => ({
  getOrCreateActiveList: (...args: unknown[]) =>
    mockGetOrCreateActiveList(...args),
  addListItem: (...args: unknown[]) => mockAddListItem(...args),
  addListItemsBatch: (...args: unknown[]) => mockAddListItemsBatch(...args),
}));

const mockAssignDemandGroup = vi
  .fn()
  .mockResolvedValue({ demand_group_code: "01" });

vi.mock("@/lib/category/assign-category", () => ({
  assignDemandGroup: (...args: unknown[]) => mockAssignDemandGroup(...args),
  CategoryAssignmentError: class CategoryAssignmentError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "CategoryAssignmentError";
    }
  },
}));

vi.mock("@/lib/search", () => ({
  detectRetailerPrefix: () => null,
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useAddToList } from "../use-add-to-list";

function createHook(overrides: Partial<Parameters<typeof useAddToList>[0]> = {}) {
  return useAddToList({
    query: "",
    country: "DE",
    retailerPrefix: null,
    products: [],
    onAdded: vi.fn(),
    resetSearch: vi.fn(),
    focusInput: vi.fn(),
    t: (key: string) => key,
    ...overrides,
  });
}

describe("useAddToList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrCreateActiveList.mockResolvedValue({ list_id: "list-1" });
    mockAddListItem.mockResolvedValue({ item_id: "item-1" });
    mockAddListItemsBatch.mockResolvedValue(undefined);
    mockAssignDemandGroup.mockResolvedValue({ demand_group_code: "01" });
  });

  describe("addGeneric", () => {
    test("creates list and adds custom product", async () => {
      const onAdded = vi.fn();
      const resetSearch = vi.fn();
      const focusInput = vi.fn();
      const hook = createHook({
        query: "Bananen",
        onAdded,
        resetSearch,
        focusInput,
      });

      await hook.addGeneric();

      expect(mockGetOrCreateActiveList).toHaveBeenCalled();
      expect(mockAssignDemandGroup).toHaveBeenCalledWith("Bananen");
      expect(mockAddListItem).toHaveBeenCalledWith(
        expect.objectContaining({
          list_id: "list-1",
          product_id: null,
          custom_name: "Bananen",
          display_name: "Bananen",
          demand_group_code: "01",
          quantity: 1,
        }),
      );
      expect(resetSearch).toHaveBeenCalled();
      expect(onAdded).toHaveBeenCalled();
      expect(focusInput).toHaveBeenCalled();
    });

    test("does nothing when query is empty", async () => {
      const hook = createHook({ query: "  " });
      await hook.addGeneric();
      expect(mockGetOrCreateActiveList).not.toHaveBeenCalled();
    });

    test("creates list when none exists", async () => {
      mockGetOrCreateActiveList.mockResolvedValue({ list_id: "new-list" });
      const hook = createHook({ query: "Milch" });

      await hook.addGeneric();

      expect(mockGetOrCreateActiveList).toHaveBeenCalled();
      expect(mockAddListItem).toHaveBeenCalledWith(
        expect.objectContaining({ list_id: "new-list" }),
      );
    });
  });

  describe("addSpecific", () => {
    test("adds product with product_id", async () => {
      const resetSearch = vi.fn();
      const onAdded = vi.fn();
      const hook = createHook({ resetSearch, onAdded });

      await hook.addSpecific({
        product_id: "prod-42",
        name: "ALDI Vollmilch",
        demand_group_code: "02",
        demand_group_name: "Milch",
        price: 1.19,
        score: 0.9,
        source: "local",
      });

      expect(mockAddListItem).toHaveBeenCalledWith(
        expect.objectContaining({
          list_id: "list-1",
          product_id: "prod-42",
          custom_name: null,
          display_name: "ALDI Vollmilch",
          demand_group_code: "02",
          quantity: 1,
        }),
      );
      expect(resetSearch).toHaveBeenCalled();
      expect(onAdded).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    test("logs error and resets state on addListItem failure", async () => {
      const error = new Error("Network error");
      mockAddListItem.mockRejectedValue(error);
      const resetSearch = vi.fn();
      const hook = createHook({ query: "Brot", resetSearch });

      await hook.addGeneric();

      expect(resetSearch).not.toHaveBeenCalled();
    });

    test("logs error on addSpecific failure", async () => {
      mockAddListItem.mockRejectedValue(new Error("DB error"));
      const resetSearch = vi.fn();
      const hook = createHook({ resetSearch });

      await hook.addSpecific({
        product_id: "prod-1",
        name: "Test",
        demand_group_code: "01",
        demand_group_name: "",
        price: null,
        score: 1,
        source: "local",
      });

      expect(resetSearch).not.toHaveBeenCalled();
    });
  });

  describe("addFromBarcode", () => {
    test("adds product from barcode scan", async () => {
      const onAdded = vi.fn();
      const hook = createHook({ onAdded });

      await hook.addFromBarcode({
        product_id: "prod-99",
        name: "Barcode Product",
        demand_group_code: "05",
        demand_group_name: "Snacks",
        price: 2.49,
        status: "active",
      });

      expect(mockAddListItem).toHaveBeenCalledWith(
        expect.objectContaining({
          list_id: "list-1",
          product_id: "prod-99",
          display_name: "Barcode Product",
          demand_group_code: "05",
        }),
      );
      expect(onAdded).toHaveBeenCalled();
    });
  });

  describe("confirmBatchAdd", () => {
    test("adds multiple products in batch", async () => {
      const products = [
        {
          product_id: "p1",
          name: "Apple",
          demand_group_code: "03",
          demand_group_name: "Obst",
          price: 0.5,
          status: "active",
        },
        {
          product_id: "p2",
          name: "Banana",
          demand_group_code: "03",
          demand_group_name: "Obst",
          price: 0.3,
          status: "active",
        },
      ];
      const hook = createHook({ products });

      const result = await hook.confirmBatchAdd([
        { product_id: "p1", quantity: 2 },
        { product_id: "p2", quantity: 1 },
      ]);

      expect(result).toBe(true);
      expect(mockAddListItemsBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          list_id: "list-1",
          product_id: "p1",
          display_name: "Apple",
          quantity: 2,
        }),
        expect.objectContaining({
          list_id: "list-1",
          product_id: "p2",
          display_name: "Banana",
          quantity: 1,
        }),
      ]);
    });

    test("returns false on batch add failure", async () => {
      mockAddListItemsBatch.mockRejectedValue(new Error("Batch failed"));
      const hook = createHook({
        products: [
          {
            product_id: "p1",
            name: "Apple",
            demand_group_code: "03",
            demand_group_name: "Obst",
            price: 0.5,
            status: "active",
          },
        ],
      });

      const result = await hook.confirmBatchAdd([
        { product_id: "p1", quantity: 1 },
      ]);

      expect(result).toBe(false);
    });

    test("returns true for empty list", async () => {
      const hook = createHook();
      const result = await hook.confirmBatchAdd([]);
      expect(result).toBe(true);
      expect(mockAddListItemsBatch).not.toHaveBeenCalled();
    });
  });
});
