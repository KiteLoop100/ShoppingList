import { describe, test, expect } from "vitest";
import { modalReducer, initialState } from "../use-list-modals";
import type { Product, CompetitorProduct } from "@/types";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    product_id: "p1", name: "Milk", name_normalized: "milk", brand: null,
    demand_group_code: "01", price: 1.29, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    ...overrides,
  };
}

function makeCompetitorProduct(overrides: Partial<CompetitorProduct> = {}): CompetitorProduct {
  return {
    product_id: "cp1", name: "LIDL Milk", name_normalized: "lidl milk",
    brand: "Milbona", ean_barcode: null, article_number: null,
    weight_or_quantity: null, country: "DE", thumbnail_url: null,
    other_photo_url: null, category_id: null,
    demand_group_code: null, demand_sub_group: null, assortment_type: null,
    status: "active",
    is_bio: false, is_vegan: false, is_gluten_free: false, is_lactose_free: false,
    animal_welfare_level: null, ingredients: null, nutrition_info: null,
    allergens: null, nutri_score: null, country_of_origin: null, retailer: null,
    created_at: "", updated_at: "",
    ...overrides,
  };
}

function makeListItem(overrides: Partial<ListItemWithMeta> = {}): ListItemWithMeta {
  return {
    item_id: "i1", list_id: "l1", product_id: "p1", custom_name: null,
    display_name: "Milk", quantity: 1, is_checked: false, checked_at: null,
    sort_position: 0, demand_group_code: "01", added_at: "",
    demand_group_name: "Dairy", demand_group_icon: "", demand_group_sort_position: 1,
    category_name: "Dairy", category_icon: "", category_sort_position: 1, price: 1.29,
    ...overrides,
  } as ListItemWithMeta;
}

describe("modalReducer", () => {
  test("initial state has all modals closed", () => {
    expect(initialState.detailProduct).toBeNull();
    expect(initialState.detailListItemId).toBeNull();
    expect(initialState.detailListItemComment).toBeNull();
    expect(initialState.editProduct).toBeNull();
    expect(initialState.genericPickerItem).toBeNull();
    expect(initialState.competitorFormOpen).toBe(false);
    expect(initialState.checkedOpen).toBe(false);
  });

  test("OPEN_DETAIL / CLOSE_DETAIL", () => {
    const product = makeProduct();
    let s = modalReducer(initialState, { type: "OPEN_DETAIL", product, itemId: "i1", itemComment: "test note" });
    expect(s.detailProduct).toEqual(product);
    expect(s.detailListItemId).toBe("i1");
    expect(s.detailListItemComment).toBe("test note");

    s = modalReducer(s, { type: "CLOSE_DETAIL" });
    expect(s.detailProduct).toBeNull();
    expect(s.detailListItemId).toBeNull();
    expect(s.detailListItemComment).toBeNull();
  });

  test("OPEN_DETAIL with null comment", () => {
    const product = makeProduct();
    const s = modalReducer(initialState, { type: "OPEN_DETAIL", product, itemId: "i2", itemComment: null });
    expect(s.detailProduct).toEqual(product);
    expect(s.detailListItemId).toBe("i2");
    expect(s.detailListItemComment).toBeNull();
  });

  test("DETAIL_TO_EDIT transitions from detail to capture modal", () => {
    const product = makeProduct();
    let s = modalReducer(initialState, { type: "OPEN_DETAIL", product, itemId: "i1", itemComment: "note" });
    s = modalReducer(s, { type: "DETAIL_TO_EDIT", product });
    expect(s.detailProduct).toBeNull();
    expect(s.detailListItemId).toBeNull();
    expect(s.detailListItemComment).toBeNull();
    expect(s.captureOpen).toBe(true);
    expect(s.captureConfig?.mode).toBe("edit");
    expect(s.captureConfig?.editAldiProduct).toEqual(product);
    expect(s.captureConfig?.hiddenFields).toContain("retailer");
  });

  test("OPEN_GENERIC_PICKER / CLOSE_GENERIC_PICKER", () => {
    const item = makeListItem();
    let s = modalReducer(initialState, { type: "OPEN_GENERIC_PICKER", item });
    expect(s.genericPickerItem).toEqual(item);

    s = modalReducer(s, { type: "CLOSE_GENERIC_PICKER" });
    expect(s.genericPickerItem).toBeNull();
  });

  test("OPEN_ELSEWHERE_PICKER / CLOSE_ELSEWHERE_PICKER", () => {
    const item = makeListItem();
    let s = modalReducer(initialState, { type: "OPEN_ELSEWHERE_PICKER", item });
    expect(s.elsewherePickerItem).toEqual(item);

    s = modalReducer(s, { type: "CLOSE_ELSEWHERE_PICKER" });
    expect(s.elsewherePickerItem).toBeNull();
  });

  test("OPEN_COMPETITOR_FORM routes to capture modal", () => {
    const s = modalReducer(initialState, {
      type: "OPEN_COMPETITOR_FORM",
      defaults: { name: "Test", retailer: "LIDL" },
      itemId: "item-1",
    });
    expect(s.captureOpen).toBe(true);
    expect(s.captureConfig?.mode).toBe("create");
    expect(s.captureConfig?.initialValues?.name).toBe("Test");
    expect(s.captureConfig?.initialValues?.retailer).toBe("LIDL");
    expect(s.captureConfig?.itemId).toBe("item-1");
  });

  test("CLOSE_COMPETITOR_FORM clears editProduct", () => {
    const cp = makeCompetitorProduct();
    let s = modalReducer(initialState, { type: "SET_COMPETITOR_EDIT", product: cp });
    expect(s.competitorFormEditProduct).toEqual(cp);

    s = modalReducer(s, { type: "CLOSE_COMPETITOR_FORM" });
    expect(s.competitorFormOpen).toBe(false);
    expect(s.competitorFormEditProduct).toBeNull();
  });

  test("OPEN_CAPTURE / CLOSE_CAPTURE", () => {
    const product = makeProduct();
    let s = modalReducer(initialState, {
      type: "OPEN_CAPTURE",
      config: { mode: "edit", editAldiProduct: product, hiddenFields: ["retailer"] },
    });
    expect(s.captureOpen).toBe(true);
    expect(s.captureConfig?.mode).toBe("edit");
    expect(s.captureConfig?.editAldiProduct).toEqual(product);

    s = modalReducer(s, { type: "CLOSE_CAPTURE" });
    expect(s.captureOpen).toBe(false);
    expect(s.captureConfig).toBeNull();
  });

  test("EDIT_FROM_COMPETITOR_DETAIL transitions to capture modal", () => {
    const cp = makeCompetitorProduct();
    let s = modalReducer(initialState, { type: "OPEN_COMPETITOR_DETAIL", product: cp, retailer: "LIDL" });
    expect(s.detailCompetitorProduct).toEqual(cp);

    s = modalReducer(s, { type: "EDIT_FROM_COMPETITOR_DETAIL", product: cp });
    expect(s.detailCompetitorProduct).toBeNull();
    expect(s.detailCompetitorRetailer).toBeNull();
    expect(s.captureOpen).toBe(true);
    expect(s.captureConfig?.mode).toBe("edit");
    expect(s.captureConfig?.editCompetitorProduct).toEqual(cp);
  });

  test("TOGGLE_CHECKED_SECTION toggles", () => {
    let s = modalReducer(initialState, { type: "TOGGLE_CHECKED_SECTION" });
    expect(s.checkedOpen).toBe(true);
    s = modalReducer(s, { type: "TOGGLE_CHECKED_SECTION" });
    expect(s.checkedOpen).toBe(false);
  });

  test("OPEN_CHECKOFF_PROMPT / CLOSE_CHECKOFF_PROMPT", () => {
    const item = makeListItem();
    let s = modalReducer(initialState, { type: "OPEN_CHECKOFF_PROMPT", item });
    expect(s.checkoffPromptItem).toEqual(item);

    s = modalReducer(s, { type: "CLOSE_CHECKOFF_PROMPT" });
    expect(s.checkoffPromptItem).toBeNull();
  });

  test("OPEN_EDIT / CLOSE_EDIT", () => {
    const product = makeProduct();
    let s = modalReducer(initialState, { type: "OPEN_EDIT", product });
    expect(s.editProduct).toEqual(product);

    s = modalReducer(s, { type: "CLOSE_EDIT" });
    expect(s.editProduct).toBeNull();
  });
});
