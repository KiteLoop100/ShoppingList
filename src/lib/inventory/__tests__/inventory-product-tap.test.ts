import { describe, test, expect } from "vitest";
import { findAldiProductForInventoryItem } from "../inventory-product-tap";
import type { InventoryItem } from "../inventory-types";
import type { Product } from "@/types";

const baseItem = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "inv-1",
  user_id: "u1",
  product_id: null,
  competitor_product_id: null,
  display_name: "Test",
  demand_group_code: null,
  thumbnail_url: null,
  quantity: 1,
  status: "sealed",
  source: "manual",
  source_receipt_id: null,
  added_at: "2025-01-01T00:00:00Z",
  opened_at: null,
  consumed_at: null,
  best_before: null,
  purchase_date: null,
  is_frozen: false,
  frozen_at: null,
  thawed_at: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...over,
});

const minimalProduct = (id: string): Product =>
  ({
    product_id: id,
    name: "P",
    country: "DE",
    demand_group_code: "AK",
    assortment_type: "daily_range",
    availability: "national",
    status: "active",
    source: "admin",
  }) as Product;

describe("findAldiProductForInventoryItem", () => {
  test("returns matching ALDI product when product_id is set", () => {
    const p = minimalProduct("pid-1");
    const item = baseItem({ product_id: "pid-1" });
    expect(findAldiProductForInventoryItem(item, [p])).toBe(p);
  });

  test("returns null when product_id is null", () => {
    const item = baseItem({ product_id: null });
    expect(findAldiProductForInventoryItem(item, [minimalProduct("x")])).toBeNull();
  });

  test("returns null when no product matches", () => {
    const item = baseItem({ product_id: "missing" });
    expect(findAldiProductForInventoryItem(item, [minimalProduct("other")])).toBeNull();
  });
});
