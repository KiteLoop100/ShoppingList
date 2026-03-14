import { describe, test, expect, vi, beforeEach } from "vitest";
import type { PhotoInput } from "../types";

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

vi.mock("@/lib/barcode-from-image", () => ({
  decodeEanFromImageBuffer: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/categories/constants", () => ({
  loadDemandGroups: vi.fn().mockResolvedValue([]),
  loadDemandSubGroups: vi.fn().mockResolvedValue([]),
  buildDemandGroupsAndSubGroupsPrompt: vi.fn().mockReturnValue("mock prompt"),
}));

import { callClaudeJSON } from "@/lib/api/claude-client";
import { decodeEanFromImageBuffer } from "@/lib/barcode-from-image";
import { extractProductInfo, scanBarcodesFromAll } from "../extract-product-info";

const mockedCallClaude = vi.mocked(callClaudeJSON);
const mockedDecodeEan = vi.mocked(decodeEanFromImageBuffer);

function makeTestImage(): PhotoInput {
  return {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    mediaType: "image/jpeg",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scanBarcodesFromAll", () => {
  test("returns EAN from barcode scan", async () => {
    mockedDecodeEan
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("4001234567890");

    const results = await scanBarcodesFromAll([makeTestImage(), makeTestImage()]);
    expect(results).toEqual([null, "4001234567890"]);
  });

  test("handles scan errors gracefully", async () => {
    mockedDecodeEan.mockRejectedValueOnce(new Error("scan failed"));

    const results = await scanBarcodesFromAll([makeTestImage()]);
    expect(results).toEqual([null]);
  });
});

describe("extractProductInfo", () => {
  test("extracts full product data from Claude response", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Bio Hafermilch Barista",
      brand: "Oatly",
      ean_barcode: "7394376616037",
      article_number: null,
      price: 2.49,
      retailer_from_price_tag: "REWE",
      unit_price: "1 L = 2,49 EUR",
      weight_or_quantity: "1 L",
      ingredients: "Wasser, Hafer 10%, Sonnenblumenöl...",
      nutrition_info: {
        energy_kcal: 46,
        fat: 3.0,
        saturated_fat: 0.3,
        carbs: 6.5,
        sugar: 4.0,
        fiber: 0.8,
        protein: 1.0,
        salt: 0.1,
      },
      allergens: "Hafer",
      nutri_score: "A",
      is_bio: true,
      is_vegan: true,
      is_gluten_free: false,
      is_lactose_free: true,
      animal_welfare_level: null,
      country_of_origin: "Schweden",
      suspicious_content: false,
    });

    const result = await extractProductInfo([makeTestImage()], null);

    expect(result.data.name).toBe("Bio Hafermilch Barista");
    expect(result.data.brand).toBe("Oatly");
    expect(result.data.price).toBe(2.49);
    expect(result.data.nutri_score).toBe("A");
    expect(result.data.is_bio).toBe(true);
    expect(result.data.is_vegan).toBe(true);
    expect(result.data.nutrition_info?.energy_kcal).toBe(46);
    expect(result.data.nutrition_info?.saturated_fat).toBe(0.3);
    expect(result.data.allergens).toBe("Hafer");
    expect(result.data.country_of_origin).toBe("Schweden");
    expect(result.suspicious_content).toBe(false);
  });

  test("overrides AI EAN with scanned EAN", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Test Product",
      ean_barcode: "0000000000000",
      suspicious_content: false,
    });

    const result = await extractProductInfo(
      [makeTestImage()],
      "4001234567890",
    );

    expect(result.data.ean_barcode).toBe("4001234567890");
  });

  test("handles missing fields gracefully", async () => {
    mockedCallClaude.mockResolvedValueOnce({});

    const result = await extractProductInfo([makeTestImage()], null);

    expect(result.data.name).toBeNull();
    expect(result.data.brand).toBeNull();
    expect(result.data.nutrition_info).toBeNull();
    expect(result.data.is_bio).toBe(false);
    expect(result.data.nutri_score).toBeNull();
  });

  test("normalizes nutri_score to uppercase", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Test",
      nutri_score: "b",
      suspicious_content: false,
    });

    const result = await extractProductInfo([makeTestImage()], null);
    expect(result.data.nutri_score).toBe("B");
  });

  test("rejects invalid nutri_score values", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Test",
      nutri_score: "X",
      suspicious_content: false,
    });

    const result = await extractProductInfo([makeTestImage()], null);
    expect(result.data.nutri_score).toBeNull();
  });

  test("returns null nutrition_info when all values are null", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Test",
      nutrition_info: {
        energy_kcal: null,
        fat: null,
        carbs: null,
        protein: null,
        salt: null,
      },
      suspicious_content: false,
    });

    const result = await extractProductInfo([makeTestImage()], null);
    expect(result.data.nutrition_info).toBeNull();
  });

  test("returns suspicious_content from Claude response", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: null,
      suspicious_content: true,
    });

    const result = await extractProductInfo([makeTestImage()], null);
    expect(result.suspicious_content).toBe(true);
  });

  test("defaults suspicious_content to false when not in response", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      name: "Test",
    });

    const result = await extractProductInfo([makeTestImage()], null);
    expect(result.suspicious_content).toBe(false);
  });
});
