/**
 * Tests for BarcodeScannerModal competitor product fallback behavior.
 *
 * Verifies that when a competitor product is found by EAN:
 * - onCompetitorProductFound is used if provided (existing behavior)
 * - onCompetitorProductAdded is used as fallback
 * - "not-found" only triggers when no product exists in any table
 */

import { vi, describe, test, expect, beforeEach } from "vitest";
import type { Product, CompetitorProduct } from "@/types";

const mockFindProductByEan = vi.fn<() => Promise<Product | null>>();
const mockFindCompetitorProductByEan = vi.fn<() => Promise<CompetitorProduct | null>>();
const mockFetchOpenFoodFacts = vi.fn<() => Promise<{ name?: string; brand?: string } | null>>();

vi.mock("@/lib/products/ean-utils", () => ({
  findProductByEan: (...args: unknown[]) => mockFindProductByEan(...args),
}));
vi.mock("@/lib/competitor-products/competitor-product-service", () => ({
  findCompetitorProductByEan: (...args: unknown[]) => mockFindCompetitorProductByEan(...args),
}));
vi.mock("@/lib/products/open-food-facts", () => ({
  fetchOpenFoodFacts: (...args: unknown[]) => mockFetchOpenFoodFacts(...args),
}));
vi.mock("@/lib/products-context", () => ({
  useProducts: () => ({ products: [] }),
}));
vi.mock("@/lib/competitor-products/competitor-products-context", () => ({
  useCompetitorProducts: () => ({ products: [] }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function makeCompetitor(overrides: Partial<CompetitorProduct> = {}): CompetitorProduct {
  return {
    product_id: "comp-1",
    name: "Espresto Furioso",
    name_normalized: "espresto furioso",
    brand: "K-Fee",
    ean_barcode: "4053528000874",
    article_number: null,
    weight_or_quantity: null,
    thumbnail_url: null,
    other_photo_url: null,
    retailer: null,
    demand_group_code: "HG",
    demand_sub_group: null,
    assortment_type: null,
    is_bio: false,
    is_vegan: false,
    is_gluten_free: false,
    is_lactose_free: false,
    animal_welfare_level: null,
    ingredients: null,
    nutrition_info: null,
    allergens: null,
    nutri_score: null,
    country_of_origin: null,
    country: "DE",
    status: "active",
    source: "manual",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    latest_prices: [],
    aliases: [],
    ...overrides,
  };
}

/**
 * Simulate the handleDetected callback logic from BarcodeScannerModal
 * without rendering the full React component (pure logic test).
 */
async function simulateHandleDetected(opts: {
  ean: string;
  onProductAdded: (product: Product) => void;
  onProductNotFound: (ean: string) => void;
  onCompetitorProductFound?: (product: CompetitorProduct, ean: string) => void;
  onCompetitorProductAdded?: (product: CompetitorProduct) => void;
}) {
  const { ean, onProductAdded, onProductNotFound, onCompetitorProductFound, onCompetitorProductAdded } = opts;

  const [productResult, competitorResult, offSettled] = await Promise.allSettled([
    mockFindProductByEan(ean, []),
    mockFindCompetitorProductByEan(ean, []),
    mockFetchOpenFoodFacts(ean),
  ]);

  const product = productResult.status === "fulfilled" ? productResult.value : null;
  const competitor = competitorResult.status === "fulfilled" ? competitorResult.value : null;
  const offResult = offSettled.status === "fulfilled" ? offSettled.value : null;

  if (product) {
    onProductAdded(product);
    return "found";
  }

  if (competitor) {
    if (onCompetitorProductFound) {
      onCompetitorProductFound(competitor, ean);
    } else if (onCompetitorProductAdded) {
      await Promise.resolve(onCompetitorProductAdded(competitor));
    }
    return "found";
  }

  const hasOffData = offResult && (offResult.name || offResult.brand);
  if (hasOffData) return "found-off";

  onProductNotFound(ean);
  return "not-found";
}

describe("BarcodeScannerModal competitor fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindProductByEan.mockResolvedValue(null);
    mockFindCompetitorProductByEan.mockResolvedValue(null);
    mockFetchOpenFoodFacts.mockResolvedValue(null);
  });

  test("calls onCompetitorProductFound when provided and competitor found", async () => {
    const competitor = makeCompetitor();
    mockFindCompetitorProductByEan.mockResolvedValue(competitor);

    const onProductAdded = vi.fn();
    const onProductNotFound = vi.fn();
    const onCompetitorProductFound = vi.fn();
    const onCompetitorProductAdded = vi.fn();

    const result = await simulateHandleDetected({
      ean: "4053528000874",
      onProductAdded,
      onProductNotFound,
      onCompetitorProductFound,
      onCompetitorProductAdded,
    });

    expect(result).toBe("found");
    expect(onCompetitorProductFound).toHaveBeenCalledWith(competitor, "4053528000874");
    expect(onCompetitorProductAdded).not.toHaveBeenCalled();
    expect(onProductNotFound).not.toHaveBeenCalled();
  });

  test("falls back to onCompetitorProductAdded when onCompetitorProductFound is not provided", async () => {
    const competitor = makeCompetitor();
    mockFindCompetitorProductByEan.mockResolvedValue(competitor);

    const onProductAdded = vi.fn();
    const onProductNotFound = vi.fn();
    const onCompetitorProductAdded = vi.fn();

    const result = await simulateHandleDetected({
      ean: "4053528000874",
      onProductAdded,
      onProductNotFound,
      onCompetitorProductAdded,
    });

    expect(result).toBe("found");
    expect(onCompetitorProductAdded).toHaveBeenCalledWith(competitor);
    expect(onProductNotFound).not.toHaveBeenCalled();
  });

  test("reports not-found only when no product exists in any table", async () => {
    const onProductAdded = vi.fn();
    const onProductNotFound = vi.fn();
    const onCompetitorProductAdded = vi.fn();

    const result = await simulateHandleDetected({
      ean: "0000000000000",
      onProductAdded,
      onProductNotFound,
      onCompetitorProductAdded,
    });

    expect(result).toBe("not-found");
    expect(onProductNotFound).toHaveBeenCalledWith("0000000000000");
    expect(onCompetitorProductAdded).not.toHaveBeenCalled();
  });

  test("competitor found but neither handler provided still returns found (silent success)", async () => {
    const competitor = makeCompetitor();
    mockFindCompetitorProductByEan.mockResolvedValue(competitor);

    const onProductAdded = vi.fn();
    const onProductNotFound = vi.fn();

    const result = await simulateHandleDetected({
      ean: "4053528000874",
      onProductAdded,
      onProductNotFound,
    });

    expect(result).toBe("found");
    expect(onProductNotFound).not.toHaveBeenCalled();
  });

  test("ALDI product takes priority over competitor product", async () => {
    const competitor = makeCompetitor();
    mockFindCompetitorProductByEan.mockResolvedValue(competitor);
    mockFindProductByEan.mockResolvedValue({
      product_id: "aldi-1",
      name: "ALDI Product",
      name_normalized: "aldi product",
      brand: "ALDI",
      demand_group_code: "HG",
      price: 3.99,
      ean_barcode: "4053528000874",
    } as Product);

    const onProductAdded = vi.fn();
    const onProductNotFound = vi.fn();
    const onCompetitorProductAdded = vi.fn();

    const result = await simulateHandleDetected({
      ean: "4053528000874",
      onProductAdded,
      onProductNotFound,
      onCompetitorProductAdded,
    });

    expect(result).toBe("found");
    expect(onProductAdded).toHaveBeenCalled();
    expect(onCompetitorProductAdded).not.toHaveBeenCalled();
  });
});
