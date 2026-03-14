import { describe, test, expect, vi } from "vitest";
import {
  matchProductToListItem,
  matchEanToListItem,
  handleCartScan,
} from "../scan-to-cart";
import type { ListItem, Product, CompetitorProduct } from "@/types";

function makeListItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Test Milk",
    quantity: 1,
    is_checked: false,
    checked_at: null,
    sort_position: 0,
    demand_group_code: "MO",
    added_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: "prod-1",
    name: "ALDI Milch 3.5%",
    name_normalized: "aldi milch 3.5%",
    brand: "ALDI",
    demand_group_code: "MO",
    price: 1.09,
    price_updated_at: null,
    assortment_type: "daily_range",
    availability: "national",
    region: null,
    country: "DE",
    special_start_date: null,
    special_end_date: null,
    status: "active",
    source: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ean_barcode: "4001234567890",
    ...overrides,
  };
}

describe("matchProductToListItem", () => {
  test("finds matching unchecked item by product_id", () => {
    const items = [makeListItem({ product_id: "prod-1", is_checked: false })];
    const result = matchProductToListItem("prod-1", items);
    expect(result).not.toBeNull();
    expect(result!.listItem.item_id).toBe("item-1");
    expect(result!.isAlreadyInCart).toBe(false);
  });

  test("detects already-checked item as in cart", () => {
    const items = [makeListItem({ product_id: "prod-1", is_checked: true })];
    const result = matchProductToListItem("prod-1", items);
    expect(result).not.toBeNull();
    expect(result!.isAlreadyInCart).toBe(true);
  });

  test("returns null when no match", () => {
    const items = [makeListItem({ product_id: "prod-99" })];
    const result = matchProductToListItem("prod-1", items);
    expect(result).toBeNull();
  });
});

describe("matchEanToListItem", () => {
  test("matches via product EAN variants", () => {
    const product = makeProduct({ product_id: "prod-1", ean_barcode: "4001234567890" });
    const items = [makeListItem({ product_id: "prod-1" })];
    const result = matchEanToListItem("4001234567890", items, [product]);
    expect(result).not.toBeNull();
    expect(result!.listItem.item_id).toBe("item-1");
  });

  test("matches EAN-8 to EAN-13 padded variant", () => {
    const product = makeProduct({ product_id: "prod-1", ean_barcode: "12345678" });
    const items = [makeListItem({ product_id: "prod-1" })];
    const result = matchEanToListItem("0000012345678", items, [product]);
    expect(result).not.toBeNull();
  });

  test("returns null when no product in list matches EAN", () => {
    const product = makeProduct({ product_id: "prod-99", ean_barcode: "9999999999999" });
    const items = [makeListItem({ product_id: "prod-1" })];
    const result = matchEanToListItem("9999999999999", items, [product]);
    expect(result).toBeNull();
  });
});

describe("handleCartScan", () => {
  const mockProducts = [makeProduct()];

  vi.mock("@/lib/products/ean-utils", async () => {
    const actual = await vi.importActual<typeof import("@/lib/products/ean-utils")>("@/lib/products/ean-utils");
    return {
      ...actual,
      findProductByEan: vi.fn(async (ean: string, products: Product[]) => {
        return products.find(
          (p) => p.ean_barcode === ean
        ) ?? null;
      }),
    };
  });

  vi.mock("@/lib/competitor-products/competitor-product-service", () => ({
    findCompetitorProductByEan: vi.fn(async () => null),
  }));

  test("returns checked_off when product matches unchecked list item", async () => {
    const items = [makeListItem({ product_id: "prod-1", is_checked: false })];
    const result = await handleCartScan("4001234567890", items, mockProducts, []);
    expect(result.type).toBe("checked_off");
    expect(result.itemId).toBe("item-1");
    expect(result.productName).toBe("ALDI Milch 3.5%");
  });

  test("returns duplicate_incremented when product already checked", async () => {
    const items = [makeListItem({ product_id: "prod-1", is_checked: true, quantity: 2 })];
    const result = await handleCartScan("4001234567890", items, mockProducts, []);
    expect(result.type).toBe("duplicate_incremented");
    expect(result.newQuantity).toBe(3);
  });

  test("returns extra_added when product not on list", async () => {
    const items = [makeListItem({ product_id: "prod-99" })];
    const result = await handleCartScan("4001234567890", items, mockProducts, []);
    expect(result.type).toBe("extra_added");
    expect(result.productName).toBe("ALDI Milch 3.5%");
  });

  test("returns needs_price when product found but no price", async () => {
    const noPriceProduct = makeProduct({ price: null });
    const items: ListItem[] = [];
    const result = await handleCartScan("4001234567890", items, [noPriceProduct], []);
    expect(result.type).toBe("needs_price");
  });

  test("returns product_not_found when EAN has no match", async () => {
    const result = await handleCartScan("0000000000000", [], mockProducts, []);
    expect(result.type).toBe("product_not_found");
    expect(result.ean).toBe("0000000000000");
  });
});
