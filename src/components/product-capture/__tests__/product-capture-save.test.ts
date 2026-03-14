import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/competitor-products/competitor-product-service", () => ({
  findOrCreateCompetitorProduct: vi.fn(),
  addCompetitorPrice: vi.fn(),
  updateCompetitorProduct: vi.fn(),
}));

vi.mock("@/lib/competitor-products/upload-competitor-photo", () => ({
  uploadCompetitorPhoto: vi.fn(),
}));

vi.mock("@/lib/retailers/retailers", () => ({
  isHomeRetailer: vi.fn((name: string) => {
    const lower = name.toLowerCase().trim();
    return ["aldi", "aldi süd", "aldi sud", "hofer"].includes(lower);
  }),
}));

vi.mock("@/lib/products/duplicate-check", () => ({
  assertNoDuplicate: vi.fn(),
  DuplicateProductError: class DuplicateProductError extends Error {
    constructor(public readonly duplicate: unknown) {
      super("Duplicate");
      this.name = "DuplicateProductError";
    }
  },
}));

const realFetch = vi.fn();
global.fetch = realFetch;

import { saveProduct } from "../product-capture-save";
import {
  findOrCreateCompetitorProduct,
  addCompetitorPrice,
  updateCompetitorProduct,
} from "@/lib/competitor-products/competitor-product-service";
import { uploadCompetitorPhoto } from "@/lib/competitor-products/upload-competitor-photo";
import type { ProductCaptureValues } from "../hooks/use-product-capture-form";

function makeValues(overrides: Partial<ProductCaptureValues> = {}): ProductCaptureValues {
  return {
    name: "Test Product",
    brand: "Test Brand",
    retailer: "LIDL",
    customRetailer: "",
    demandGroupCode: "50",
    demandSubGroup: "",
    ean: "1234567890123",
    articleNumber: "ART001",
    price: "2,99",
    weightOrQuantity: "500g",
    assortmentType: "daily_range",
    isBio: false,
    isVegan: false,
    isGlutenFree: false,
    isLactoseFree: false,
    animalWelfareLevel: null,
    aliases: [],
    ...overrides,
  };
}

describe("saveProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("routes to ALDI API when retailer is ALDI", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-123" }),
    });

    const result = await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(result.productType).toBe("aldi");
    expect(result.productId).toBe("aldi-123");
    expect(realFetch).toHaveBeenCalledWith(
      "/api/products/create-manual",
      expect.objectContaining({ method: "POST" }),
    );
    expect(findOrCreateCompetitorProduct).not.toHaveBeenCalled();
  });

  test("routes to competitor service when retailer is not ALDI", async () => {
    vi.mocked(findOrCreateCompetitorProduct).mockResolvedValueOnce({
      product_id: "comp-456",
      name: "Test Product",
      name_normalized: "test product",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: null,
      country: "DE",
      retailer: "LIDL",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      demand_group_code: null,
      demand_sub_group: null,
      assortment_type: null,
      status: "active",
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
      created_at: "",
      updated_at: "",
    });

    const result = await saveProduct({
      values: makeValues({ retailer: "LIDL" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(result.productType).toBe("competitor");
    expect(result.productId).toBe("comp-456");
    expect(findOrCreateCompetitorProduct).toHaveBeenCalled();
    expect(addCompetitorPrice).toHaveBeenCalledWith("comp-456", "LIDL", 2.99);
  });

  test("updates existing competitor product in edit mode", async () => {
    const editProduct = {
      product_id: "existing-789",
      name: "Old Name",
      name_normalized: "old name",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: null,
      country: "DE",
      retailer: "REWE",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      demand_group_code: null,
      demand_sub_group: null,
      assortment_type: null,
      status: "active" as const,
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
      created_at: "",
      updated_at: "",
    };

    const result = await saveProduct({
      values: makeValues({ retailer: "REWE", name: "Updated Name", isBio: true }),
      editAldiProduct: null,
      editCompetitorProduct: editProduct,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(result.productType).toBe("competitor");
    expect(result.productId).toBe("existing-789");
    expect(updateCompetitorProduct).toHaveBeenCalledWith(
      "existing-789",
      expect.objectContaining({ name: "Updated Name", is_bio: true }),
    );
    expect(findOrCreateCompetitorProduct).not.toHaveBeenCalled();
  });

  test("sends dietary flags to ALDI API", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-bio" }),
    });

    await saveProduct({
      values: makeValues({
        retailer: "ALDI",
        isBio: true,
        isVegan: true,
        isGlutenFree: false,
        isLactoseFree: true,
        animalWelfareLevel: 2,
      }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    const fetchCall = realFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.is_bio).toBe(true);
    expect(body.is_vegan).toBe(true);
    expect(body.is_gluten_free).toBeNull();
    expect(body.is_lactose_free).toBe(true);
    expect(body.animal_welfare_level).toBe(2);
  });

  test("does not add price for competitor in edit mode", async () => {
    const editProduct = {
      product_id: "edit-no-price",
      name: "Existing",
      name_normalized: "existing",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: null,
      country: "DE",
      retailer: "EDEKA",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      demand_group_code: null,
      demand_sub_group: null,
      assortment_type: null,
      status: "active" as const,
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
      created_at: "",
      updated_at: "",
    };

    await saveProduct({
      values: makeValues({ retailer: "EDEKA", price: "3,99" }),
      editAldiProduct: null,
      editCompetitorProduct: editProduct,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(addCompetitorPrice).not.toHaveBeenCalled();
  });

  test("uploads WebP thumbnail with correct MIME type and extension", async () => {
    vi.mocked(findOrCreateCompetitorProduct).mockResolvedValueOnce({
      product_id: "comp-webp",
      name: "Maggi",
      name_normalized: "maggi",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: null,
      country: "DE",
      retailer: "REWE",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      demand_group_code: null,
      demand_sub_group: null,
      assortment_type: null,
      status: "active",
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
      created_at: "",
      updated_at: "",
    });

    const fakeBlob = new Blob(["fake-image"], { type: "image/webp" });
    realFetch.mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) });
    vi.mocked(uploadCompetitorPhoto).mockResolvedValueOnce("https://storage/comp-webp_front.webp");

    const dummyFile = new File(["photo"], "photo.jpg", { type: "image/jpeg" });

    await saveProduct({
      values: makeValues({ retailer: "REWE", price: "" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "data:image/webp;base64,AAAA",
      photoFiles: [dummyFile],
      country: "DE",
    });

    expect(uploadCompetitorPhoto).toHaveBeenCalledWith(
      "comp-webp",
      expect.objectContaining({ name: "thumbnail.webp", type: "image/webp" }),
      "front",
    );
    expect(updateCompetitorProduct).toHaveBeenCalledWith("comp-webp", {
      thumbnail_url: "https://storage/comp-webp_front.webp",
    });
  });

  test("returns thumbnailUrl in SaveResult for ALDI products", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-t", thumbnail_url: "https://cdn/thumb.jpg" }),
    });

    const result = await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "data:image/webp;base64,AAAA",
      photoFiles: [],
      country: "DE",
    });

    expect(result.thumbnailUrl).toBe("https://cdn/thumb.jpg");
  });

  test("returns thumbnailUrl in SaveResult for competitor products", async () => {
    vi.mocked(findOrCreateCompetitorProduct).mockResolvedValueOnce({
      product_id: "comp-t", name: "T", name_normalized: "t",
      brand: null, ean_barcode: null, article_number: null,
      weight_or_quantity: null, country: "DE", retailer: "REWE",
      thumbnail_url: null, other_photo_url: null, category_id: null,
      demand_group_code: null, demand_sub_group: null, assortment_type: null,
      status: "active", is_bio: false, is_vegan: false, is_gluten_free: false,
      is_lactose_free: false, animal_welfare_level: null, ingredients: null,
      nutrition_info: null, allergens: null, nutri_score: null,
      country_of_origin: null, created_at: "", updated_at: "",
    });

    const fakeBlob = new Blob(["img"], { type: "image/webp" });
    realFetch.mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) });
    vi.mocked(uploadCompetitorPhoto).mockResolvedValueOnce("https://cdn/comp-t.webp");

    const result = await saveProduct({
      values: makeValues({ retailer: "REWE", price: "" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "data:image/webp;base64,AAAA",
      photoFiles: [new File(["p"], "p.jpg", { type: "image/jpeg" })],
      country: "DE",
    });

    expect(result.thumbnailUrl).toBe("https://cdn/comp-t.webp");
  });

  test("returns null thumbnailUrl when no thumbnail processed", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-no-t" }),
    });

    const result = await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(result.thumbnailUrl).toBeNull();
  });

  test("returns existing_product_id on duplicate response", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        duplicate: true,
        product_id: "dup-111",
        existing_product_id: "dup-111",
        message: "Duplicate",
      }),
    });

    const result = await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: null,
      photoFiles: [],
      country: "DE",
    });

    expect(result.productType).toBe("aldi");
    expect(result.productId).toBe("dup-111");
  });

  test("sends thumbnail_base64 when processedThumbnail is a data URI", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-thumb" }),
    });

    await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "data:image/webp;base64,AABBCC",
      photoFiles: [],
      country: "DE",
    });

    const fetchCall = realFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.thumbnail_base64).toBe("AABBCC");
    expect(body.thumbnail_format).toBe("image/webp");
    expect(body.thumbnail_url).toBeNull();
  });

  test("sends thumbnail_url when processedThumbnail is an HTTPS URL", async () => {
    realFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, product_id: "aldi-url" }),
    });

    await saveProduct({
      values: makeValues({ retailer: "ALDI" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "https://example.com/thumb.jpg",
      photoFiles: [],
      country: "DE",
    });

    const fetchCall = realFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.thumbnail_url).toBe("https://example.com/thumb.jpg");
    expect(body.thumbnail_base64).toBeNull();
    expect(body.thumbnail_format).toBeNull();
  });

  test("uploads JPEG thumbnail with correct MIME type when not WebP", async () => {
    vi.mocked(findOrCreateCompetitorProduct).mockResolvedValueOnce({
      product_id: "comp-jpg",
      name: "Test",
      name_normalized: "test",
      brand: null,
      ean_barcode: null,
      article_number: null,
      weight_or_quantity: null,
      country: "DE",
      retailer: "LIDL",
      thumbnail_url: null,
      other_photo_url: null,
      category_id: null,
      demand_group_code: null,
      demand_sub_group: null,
      assortment_type: null,
      status: "active",
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
      created_at: "",
      updated_at: "",
    });

    const fakeBlob = new Blob(["fake-image"], { type: "image/jpeg" });
    realFetch.mockResolvedValueOnce({ blob: () => Promise.resolve(fakeBlob) });
    vi.mocked(uploadCompetitorPhoto).mockResolvedValueOnce("https://storage/comp-jpg_front.jpg");

    const dummyFile = new File(["photo"], "photo.jpg", { type: "image/jpeg" });

    await saveProduct({
      values: makeValues({ retailer: "LIDL", price: "" }),
      editAldiProduct: null,
      editCompetitorProduct: null,
      extractedDetails: null,
      processedThumbnail: "data:image/jpeg;base64,AAAA",
      photoFiles: [dummyFile],
      country: "DE",
    });

    expect(uploadCompetitorPhoto).toHaveBeenCalledWith(
      "comp-jpg",
      expect.objectContaining({ name: "thumbnail.jpg", type: "image/jpeg" }),
      "front",
    );
  });
});
