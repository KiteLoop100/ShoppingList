import { describe, expect, test, vi, beforeEach } from "vitest";
import { addCookChatMissingIngredientsToList, addRecipeIngredientsToList } from "@/lib/recipe/add-to-list";
import type { PantryCheckResult } from "@/lib/recipe/types";
import type { Product } from "@/types";
import * as list from "@/lib/list";
import * as assignCategory from "@/lib/category/assign-category";

vi.mock("@/lib/list", () => ({
  getListItems: vi.fn(),
  addListItem: vi.fn(),
}));

vi.mock("@/lib/category/assign-category", () => ({
  assignDemandGroup: vi.fn(),
}));

const mockProduct: Product = {
  product_id: "p1",
  name: "ALDI Nudeln",
  name_normalized: "aldi nudeln",
  brand: null,
  demand_group_code: "AK",
  price: null,
  price_updated_at: null,
  assortment_type: "daily_range",
  availability: "national",
  region: null,
  country: "DE",
  special_start_date: null,
  special_end_date: null,
  status: "active",
  source: "admin",
  created_at: "",
  updated_at: "",
  /** Used to convert recipe g → pack count for the list */
  weight_or_quantity: "500 g",
};

function basePantry(over: Partial<PantryCheckResult>): PantryCheckResult {
  return {
    ingredient: {
      name: "Pasta",
      amount: 400,
      unit: "g",
      category: "Nudeln",
      notes: "",
      is_optional: false,
    },
    aldi_product: mockProduct,
    match_tier: 1,
    match_confidence: 0.9,
    is_substitute: false,
    in_pantry: false,
    pantry_status: "not_present",
    pantry_quantity_sufficient: false,
    quantity_needed: 400,
    quantity_to_buy: 400,
    ...over,
  };
}

describe("addRecipeIngredientsToList", () => {
  beforeEach(() => {
    vi.mocked(list.getListItems).mockReset();
    vi.mocked(list.addListItem).mockReset();
    vi.mocked(assignCategory.assignDemandGroup).mockReset();
  });

  test("inserts new ALDI line when list had no unchecked merge match", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    vi.mocked(list.addListItem).mockResolvedValue({
      item_id: "new-item",
      list_id: "L1",
      product_id: mockProduct.product_id,
      custom_name: null,
      display_name: mockProduct.name,
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: 0,
      demand_group_code: "AK",
      added_at: "",
    });

    const r = addRecipeIngredientsToList([basePantry({})], "L1");
    const out = await r;

    expect(out.added_count).toBe(1);
    expect(out.increased_count).toBe(0);
    expect(out.skipped_count).toBe(0);
    expect(list.addListItem).toHaveBeenCalledTimes(1);
  });

  test("counts merge as increased when unchecked item id already existed", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([
      {
        item_id: "existing",
        list_id: "L1",
        product_id: mockProduct.product_id,
        custom_name: null,
        display_name: mockProduct.name,
        quantity: 1,
        is_checked: false,
        checked_at: null,
        sort_position: 0,
        demand_group_code: "AK",
        added_at: "",
      },
    ]);
    vi.mocked(list.addListItem).mockResolvedValue({
      item_id: "existing",
      list_id: "L1",
      product_id: mockProduct.product_id,
      custom_name: null,
      display_name: mockProduct.name,
      quantity: 3,
      is_checked: false,
      checked_at: null,
      sort_position: 0,
      demand_group_code: "AK",
      added_at: "",
    });

    const out = await addRecipeIngredientsToList([basePantry({ quantity_to_buy: 600 })], "L1");

    expect(out.added_count).toBe(0);
    expect(out.increased_count).toBe(1);
    expect(list.addListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: mockProduct.product_id,
        quantity: 2,
      }),
    );
  });

  test("adds free-text row for review_substitute_choice original", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    vi.mocked(assignCategory.assignDemandGroup).mockResolvedValue({
      demand_group_code: "AK",
      demand_group_name: "",
    });
    vi.mocked(list.addListItem).mockResolvedValue({
      item_id: "ft1",
      list_id: "L1",
      product_id: null,
      custom_name: "Guanciale",
      display_name: "Guanciale",
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: 0,
      demand_group_code: "AK",
      added_at: "",
    });

    const out = await addRecipeIngredientsToList(
      [
        basePantry({
          review_substitute_choice: "original",
          aldi_product: mockProduct,
          quantity_to_buy: 1,
          ingredient: {
            name: "Guanciale",
            amount: 150,
            unit: "g",
            category: "Fleisch",
            notes: "",
            is_optional: false,
          },
        }),
      ],
      "L1",
    );

    expect(out.added_count).toBe(1);
    expect(assignCategory.assignDemandGroup).toHaveBeenCalledWith("Guanciale");
    expect(list.addListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: null,
        display_name: "Guanciale",
        quantity: 1,
      }),
    );
  });

  test("skips rows with review_excluded_from_list", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    const out = await addRecipeIngredientsToList(
      [basePantry({ review_excluded_from_list: true })],
      "L1",
    );
    expect(out.skipped_count).toBe(1);
    expect(list.addListItem).not.toHaveBeenCalled();
  });
});

describe("addCookChatMissingIngredientsToList", () => {
  beforeEach(() => {
    vi.mocked(list.getListItems).mockReset();
    vi.mocked(list.addListItem).mockReset();
    vi.mocked(assignCategory.assignDemandGroup).mockReset();
  });

  test("adds ALDI line when quantity_to_buy is positive", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    vi.mocked(list.addListItem).mockResolvedValue({
      item_id: "new-item",
      list_id: "L1",
      product_id: mockProduct.product_id,
      custom_name: null,
      display_name: mockProduct.name,
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: 0,
      demand_group_code: "AK",
      added_at: "",
    });

    const out = await addCookChatMissingIngredientsToList([basePantry({ quantity_to_buy: 400 })], "L1");
    expect(out.added_count).toBe(1);
    expect(list.addListItem).toHaveBeenCalledTimes(1);
    expect(list.addListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: mockProduct.product_id,
        quantity: 1,
      }),
    );
  });

  test("skips rows with zero quantity_to_buy", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    const out = await addCookChatMissingIngredientsToList(
      [basePantry({ quantity_to_buy: 0, in_pantry: true })],
      "L1",
    );
    expect(out.skipped_count).toBe(1);
    expect(list.addListItem).not.toHaveBeenCalled();
  });

  test("adds free-text when no aldi_product", async () => {
    vi.mocked(list.getListItems).mockResolvedValue([]);
    vi.mocked(assignCategory.assignDemandGroup).mockResolvedValue({
      demand_group_code: "AK",
      demand_group_name: "",
    });
    vi.mocked(list.addListItem).mockResolvedValue({
      item_id: "ft1",
      list_id: "L1",
      product_id: null,
      custom_name: "Sahne",
      display_name: "Sahne",
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: 0,
      demand_group_code: "AK",
      added_at: "",
    });

    const out = await addCookChatMissingIngredientsToList(
      [
        basePantry({
          aldi_product: null,
          match_tier: 4,
          quantity_to_buy: 1,
          ingredient: {
            name: "Sahne",
            amount: 200,
            unit: "ml",
            category: "Milch",
            notes: "",
            is_optional: false,
          },
        }),
      ],
      "L1",
    );

    expect(out.added_count).toBe(1);
    expect(assignCategory.assignDemandGroup).toHaveBeenCalledWith("Sahne");
  });
});
